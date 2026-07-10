import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import electronBridge from '../../services/electronBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local temp directory for storing files from Electron EXE
const TEMP_DIR = path.join(__dirname, '../../temp_sync');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Store sync metadata
const syncMetadata = new Map();

// Generate a unique token for each sync request
const generateSyncToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Clean up old temp files (older than 1 hour)
const cleanupOldFiles = () => {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        files.forEach(file => {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > oneHour) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up old temp file: ${file}`);
            }
        });
    } catch (error) {
        console.error('Error cleaning up temp files:', error);
    }
};

// Run cleanup periodically
setInterval(cleanupOldFiles, 30 * 60 * 1000); // Every 30 minutes

// Also cleanup Electron EXE temp files periodically
setInterval(async () => {
    try {
        await electronBridge.cleanupAllTemp();
        console.log('Cleaned up Electron EXE temp files');
    } catch (error) {
        console.error('Error cleaning up Electron temp files:', error);
    }
}, 60 * 60 * 1000); // Every hour


export const initiateSync = async (req, res) => {
    try {
        // Check if Electron EXE is available
        const healthCheck = await electronBridge.healthCheck();
        if (!healthCheck.available) {
            return res.status(503).json({ 
                error: 'Electron EXE is not available', 
                details: healthCheck.error 
            });
        }

        // Request Electron EXE to create temporary database
        const tempDbResult = await electronBridge.createTempDb();
        
        if (!tempDbResult.success) {
            return res.status(500).json({ 
                error: 'Failed to create temporary database in Electron EXE',
                details: tempDbResult.error 
            });
        }

        // Generate unique sync token
        const syncToken = generateSyncToken();
        
        // Store metadata for this sync session
        syncMetadata.set(syncToken, {
            electronTimestamp: tempDbResult.timestamp,
            electronTempPath: tempDbResult.tempDbPath,
            createdAt: Date.now()
        });

        // Get file info from Electron
        const dbInfo = await electronBridge.getDbInfo();

        res.json({
            success: true,
            syncToken,
            token: syncToken, // For React Native compatibility
            fileSize: dbInfo.info?.dbSize || tempDbResult.fileSize,
            timestamp: tempDbResult.timestamp,
            message: 'Sync initiated. Use the token to download the database.'
        });

    } catch (error) {
        console.error('Sync initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate sync' });
    }
};

export const downloadDatabase = async (req, res) => {
    try {
        const { syncToken } = req.params;
        
        // Get sync metadata
        const metadata = syncMetadata.get(syncToken);
        if (!metadata) {
            return res.status(404).json({ error: 'Sync token expired or invalid' });
        }

        // Get temp database path from Electron EXE
        const tempDbResult = await electronBridge.getTempDb(metadata.electronTimestamp);
        
        if (!tempDbResult.success || !tempDbResult.tempDbPath) {
            return res.status(404).json({ 
                error: 'Temporary database not found in Electron EXE',
                details: tempDbResult.error 
            });
        }

        const electronTempPath = tempDbResult.tempDbPath;

        // Check if file exists in Electron EXE
        if (!fs.existsSync(electronTempPath)) {
            return res.status(404).json({ error: 'Database file not found in Electron EXE' });
        }

        // Send the file from Electron EXE
        res.download(electronTempPath, 'data.db', (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            } else {
                // Cleanup after successful download
                cleanupSyncSession(syncToken, metadata.electronTimestamp);
            }
        });

    } catch (error) {
        console.error('Database download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download database' });
        }
    }
};

// Helper function to cleanup sync session
const cleanupSyncSession = async (syncToken, electronTimestamp) => {
    try {
        // Cleanup in Electron EXE
        await electronBridge.cleanupTempDb(electronTimestamp);
        
        // Remove metadata
        syncMetadata.delete(syncToken);
        
        console.log(`Sync session cleaned up: ${syncToken}`);
    } catch (error) {
        console.error('Error during sync cleanup:', error);
    }
};

export const getSyncStatus = async (req, res) => {
    try {
        const { syncToken } = req.params;
        
        // Get sync metadata
        const metadata = syncMetadata.get(syncToken);
        if (!metadata) {
            return res.json({ valid: false, message: 'Token expired or invalid' });
        }

        // Check if temp database still exists in Electron EXE
        const tempDbResult = await electronBridge.getTempDb(metadata.electronTimestamp);
        
        if (!tempDbResult.success || !tempDbResult.tempDbPath) {
            return res.json({ valid: false, message: 'Database no longer available in Electron EXE' });
        }

        const electronTempPath = tempDbResult.tempDbPath;
        
        if (!fs.existsSync(electronTempPath)) {
            return res.json({ valid: false, message: 'Database file not found' });
        }

        const stats = fs.statSync(electronTempPath);
        const age = Date.now() - metadata.createdAt;
        const maxAge = 60 * 60 * 1000; // 1 hour

        res.json({
            valid: true,
            fileSize: stats.size,
            age: Math.floor(age / 1000), // age in seconds
            expiresIn: Math.floor((maxAge - age) / 1000), // seconds until expiration
            electronTimestamp: metadata.electronTimestamp
        });

    } catch (error) {
        console.error('Sync status error:', error);
        res.status(500).json({ error: 'Failed to check sync status' });
    }
};

// New endpoint: Get database information
export const getDbInfo = async (req, res) => {
    try {
        const dbInfo = await electronBridge.getDbInfo();
        res.json(dbInfo);
    } catch (error) {
        console.error('Get DB info error:', error);
        res.status(500).json({ error: 'Failed to get database information' });
    }
};

// New endpoint: Get tables from database
export const getTables = async (req, res) => {
    try {
        const { syncToken } = req.params;
        const metadata = syncMetadata.get(syncToken);
        
        if (!metadata) {
            return res.status(404).json({ error: 'Sync token expired or invalid' });
        }

        const tablesResult = await electronBridge.getTables(metadata.electronTimestamp);
        res.json(tablesResult);
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: 'Failed to get tables' });
    }
};

// New endpoint: Get table data preview
export const getTablePreview = async (req, res) => {
    try {
        const { syncToken, tableName } = req.params;
        const metadata = syncMetadata.get(syncToken);
        
        if (!metadata) {
            return res.status(404).json({ error: 'Sync token expired or invalid' });
        }

        const countResult = await electronBridge.getTableCount(metadata.electronTimestamp, tableName);
        res.json(countResult);
    } catch (error) {
        console.error('Get table preview error:', error);
        res.status(500).json({ error: 'Failed to get table preview' });
    }
};

// Run a startup health check to verify connection to Electron EXE
(async () => {
    try {
        // Wait a brief moment to let other initialization tasks complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        const health = await electronBridge.healthCheck();
        if (health.available) {
            console.log('✅ Connection to Electron EXE sync server established.');
        } else {
            console.warn('⚠️ Warning: Electron EXE sync server is not running or not reachable. Sync features will fail.');
        }
    } catch (err) {
        console.warn('⚠️ Warning: Electron EXE sync server is not running or not reachable. Sync features will fail.');
    }
})();

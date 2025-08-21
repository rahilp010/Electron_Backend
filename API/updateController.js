// api/update.js - Place this in your Vercel backend project

import { config } from "../config/config.js";

export default function handler(req, res) {
    // Enable CORS for your Electron app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Get platform info from query params or headers
        const platform = req.query.platform || req.headers.platform || 'win32';
        const arch = req.query.arch || req.headers.arch || 'x64';
        const currentVersion = req.query.version || req.headers.version || '0.0.0';

        console.log(`Update check - Platform: ${platform}, Arch: ${arch}, Current: ${currentVersion}`);

        // Your update configuration
        const latestVersion = '1.1.0';
        const updateInfo = {
            version: latestVersion,
            readme: `What's new in v${latestVersion}:
• Improved performance and stability
• Bug fixes and security updates
• New features and enhancements
• Better user interface`,
            pub_date: new Date().toISOString(),

            // Platform-specific download URLs
            platforms: {
                win32: {
                    update: config.url,
                    name: 'electron-win32-x64.zip',
                    notes: 'Windows installer'
                }
            }
        };

        // Check if update is needed
        if (isVersionNewer(currentVersion, latestVersion)) {
            const platformInfo = updateInfo.platforms[platform] || updateInfo.platforms.win32;

            const response = {
                version: updateInfo.version,
                readme: updateInfo.readme,
                pub_date: updateInfo.pub_date,
                update: platformInfo.update,
                name: platformInfo.name,
                notes: platformInfo.notes,
                // Additional metadata
                platform: platform,
                arch: arch,
                size: getPlatformFileSize(platform), // Optional: add file sizes
            };

            console.log(`Update available: ${latestVersion} for ${platform}`);
            res.status(200).json(response);
        } else {
            console.log(`No update needed. Current: ${currentVersion}, Latest: ${latestVersion}`);
            res.status(204).end(); // No Content - no update available
        }

    } catch (error) {
        console.error('Update API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Update check failed'
        });
    }
}

// Helper function to compare versions
function isVersionNewer(current, latest) {
    try {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);

        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
            const currentPart = currentParts[i] || 0;
            const latestPart = latestParts[i] || 0;

            if (latestPart > currentPart) return true;
            if (latestPart < currentPart) return false;
        }

        return false; // Versions are equal
    } catch (error) {
        console.error('Version comparison error:', error);
        return false;
    }
}

// Optional: Helper function to get file sizes (you can implement this)
function getPlatformFileSize(platform) {
    const sizes = {
        win32: '45.2 MB',
        darwin: '52.1 MB',
        linux: '48.7 MB'
    };
    return sizes[platform] || 'Unknown';
}
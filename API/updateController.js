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
        const latestVersion = '1.1.0.1';

        // Check if update is needed
        if (!isVersionNewer(currentVersion, latestVersion)) {
            console.log(`No update needed. Current: ${currentVersion}, Latest: ${latestVersion}`);
            return res.status(204).end(); // No Content - no update available
        }

        // Format response according to electron-simple-updater's expected format
        const response = {
            version: latestVersion,
            readme: `What's new in v${latestVersion}:\n• Improved performance and stability\n• Bug fixes and security updates\n• New features and enhancements\n• Better user interface`,
            pub_date: new Date().toISOString(),
            update: 'https://www.dropbox.com/scl/fi/q2ioqg7usaecdxjmk6igu/electron-win32-x64.zip?rlkey=b7aaotkngf2m7l9cmnfzt3zn9&st=gjomyz5a&dl=1',
            name: 'electron-win32-x64.zip',
            notes: 'Windows installer',
            platform: 'win32',
            arch: 'x64',
            size: '120.2 MB'
        };

        console.log(`Update available: ${latestVersion} for ${platform}`);
        res.status(200).json(response);

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
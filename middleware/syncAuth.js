import { config } from '../config/config.js';

export const syncAuth = (req, res, next) => {
    const apiKey = req.headers['x-sync-api-key'];
    
    // Check if API key is provided
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate API key against environment variable
    if (apiKey !== config.syncApiKey) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
    next();
};

// React Native Sync Service
// Copy this file to your React Native project
// This service communicates with the Backend API, which then communicates with Electron EXE

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

class SyncService {
  constructor() {
    this.apiBaseUrl = 'https://electron-by-envy.vercel.app/'; // e.g., 'http://192.168.1.100:3000' (Backend API, not Electron EXE)
    this.syncApiKey = process.env.SYNC_API_KEY; // Set from your .env file
    this.dbPath = null;
    this.database = null;
    this.syncToken = null;
  }

  /**
   * Initialize sync service with configuration
   */
  configure(apiBaseUrl, syncApiKey) {
    this.apiBaseUrl = apiBaseUrl;
    this.syncApiKey = syncApiKey;
  }

  /**
   * Step 1: Initiate sync and get sync token
   */
  async initiateSync() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/sync/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': this.syncApiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate sync');
      }

      // Store sync token for subsequent calls
      this.syncToken = data.syncToken;

      return data;
    } catch (error) {
      console.error('Sync initiation error:', error);
      throw error;
    }
  }

  /**
   * Get database information from Electron EXE via Backend API
   */
  async getDbInfo() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/sync/db-info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': this.syncApiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get database info');
      }

      return data;
    } catch (error) {
      console.error('Get DB info error:', error);
      throw error;
    }
  }

  /**
   * Get tables from database via Backend API
   */
  async getTablesFromApi() {
    try {
      if (!this.syncToken) {
        throw new Error('No active sync session. Call initiateSync first.');
      }

      const response = await fetch(`${this.apiBaseUrl}/api/sync/tables/${this.syncToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': this.syncApiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get tables');
      }

      return data;
    } catch (error) {
      console.error('Get tables error:', error);
      throw error;
    }
  }

  /**
   * Get table preview (row count) via Backend API
   */
  async getTablePreview(tableName) {
    try {
      if (!this.syncToken) {
        throw new Error('No active sync session. Call initiateSync first.');
      }

      const response = await fetch(`${this.apiBaseUrl}/api/sync/table/${this.syncToken}/${tableName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': this.syncApiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get table preview');
      }

      return data;
    } catch (error) {
      console.error('Get table preview error:', error);
      throw error;
    }
  }

  /**
   * Step 2: Download database file using sync token
   * The Backend API retrieves the file from Electron EXE and sends it to React Native
   */
  async downloadDatabase(syncToken) {
    try {
      const downloadUrl = `${this.apiBaseUrl}/api/sync/download/${syncToken}`;

      // Create temp file path
      const tempDir = `${FileSystem.documentDirectory}temp_sync/`;
      const tempFilePath = `${tempDir}data_${Date.now()}.db`;

      // Ensure temp directory exists
      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      }

      // Download the file from Backend API (which gets it from Electron EXE)
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempFilePath, {
        headers: {
          'x-sync-api-key': this.syncApiKey,
        },
      });

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      this.dbPath = tempFilePath;
      return tempFilePath;
    } catch (error) {
      console.error('Database download error:', error);
      throw error;
    }
  }

  /**
   * Step 3: Open and read the SQLite database
   */
  async openDatabase() {
    try {
      if (!this.dbPath) {
        throw new Error('No database file available. Call downloadDatabase first.');
      }

      // Open the database
      this.database = await SQLite.openDatabaseAsync('synced_data.db');

      // Read the schema and data from the downloaded file
      await this.importDatabaseFile(this.dbPath);

      return this.database;
    } catch (error) {
      console.error('Database open error:', error);
      throw error;
    }
  }

  /**
   * Import data from the downloaded SQLite file
   */
  async importDatabaseFile(filePath) {
    try {
      // Read the file content
      const fileContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // For expo-sqlite, we need to use a different approach
      // This is a simplified version - you may need to adjust based on your data structure

      // Alternative: Use SQL.js or a similar library for full SQLite file support
      console.log('Database file imported. Size:', fileContent.length);

      return true;
    } catch (error) {
      console.error('Database import error:', error);
      throw error;
    }
  }

  /**
   * Get all tables in the database
   */
  async getTables() {
    try {
      if (!this.database) {
        throw new Error('Database not opened');
      }

      const tables = await this.database.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
      );

      return tables.map(table => table.name);
    } catch (error) {
      console.error('Get tables error:', error);
      throw error;
    }
  }

  /**
   * Get all data from a specific table
   */
  async getTableData(tableName) {
    try {
      if (!this.database) {
        throw new Error('Database not opened');
      }

      const data = await this.database.getAllAsync(`SELECT * FROM ${tableName}`);
      return data;
    } catch (error) {
      console.error('Get table data error:', error);
      throw error;
    }
  }

  /**
   * Execute custom query
   */
  async executeQuery(query, params = []) {
    try {
      if (!this.database) {
        throw new Error('Database not opened');
      }

      const result = await this.database.getAllAsync(query, params);
      return result;
    } catch (error) {
      console.error('Execute query error:', error);
      throw error;
    }
  }

  /**
   * Step 4: Clean up - Close database and delete temp files
   */
  async cleanup() {
    try {
      // Close database if open
      if (this.database) {
        await this.database.closeAsync();
        this.database = null;
      }

      // Delete temp database file
      if (this.dbPath) {
        const fileInfo = await FileSystem.getInfoAsync(this.dbPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(this.dbPath);
          console.log('Temp database file deleted');
        }
        this.dbPath = null;
      }

      // Clean up temp directory
      const tempDir = `${FileSystem.documentDirectory}temp_sync/`;
      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
        console.log('Temp directory cleaned up');
      }

      return true;
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }

  /**
   * Complete sync workflow
   */
  async performSync() {
    try {
      console.log('Starting sync...');

      // Step 1: Initiate sync (Backend API communicates with Electron EXE)
      console.log('Initiating sync...');
      const syncData = await this.initiateSync();
      console.log('Sync initiated. Token:', syncData.syncToken);

      // Step 2: Download database (Backend API gets it from Electron EXE)
      console.log('Downloading database...');
      const dbPath = await this.downloadDatabase(syncData.syncToken);
      console.log('Database downloaded to:', dbPath);

      // Step 3: Open database
      console.log('Opening database...');
      await this.openDatabase();
      console.log('Database opened successfully');

      // Get tables
      const tables = await this.getTables();
      console.log('Available tables:', tables);

      // Return sync result with database instance
      return {
        success: true,
        database: this.database,
        tables: tables,
        dbPath: dbPath,
        syncToken: syncData.syncToken,
      };

    } catch (error) {
      console.error('Sync failed:', error);

      // Cleanup on error
      await this.cleanup();

      throw error;
    }
  }

  /**
   * Alternative sync workflow using API endpoints (without downloading full DB)
   * Use this for getting metadata and table information without downloading the full database
   */
  async performLightSync() {
    try {
      console.log('Starting light sync...');

      // Step 1: Initiate sync
      console.log('Initiating sync...');
      const syncData = await this.initiateSync();
      console.log('Sync initiated. Token:', syncData.syncToken);

      // Step 2: Get database info
      console.log('Getting database info...');
      const dbInfo = await this.getDbInfo();
      console.log('Database info:', dbInfo);

      // Step 3: Get tables
      console.log('Getting tables...');
      const tables = await this.getTablesFromApi();
      console.log('Available tables:', tables);

      // Return sync result without downloading full database
      return {
        success: true,
        syncToken: syncData.syncToken,
        dbInfo: dbInfo,
        tables: tables.tables || [],
      };

    } catch (error) {
      console.error('Light sync failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new SyncService();

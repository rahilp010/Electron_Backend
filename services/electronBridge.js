import http from 'http';
import { config } from '../config/config.js';

/**
 * Electron Bridge Service
 * Communicates with the Electron EXE via HTTP to access sync functionality
 */
class ElectronBridge {
  constructor() {
    this.electronHost = config.electronHost;
    this.electronPort = config.electronSyncPort;
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Make HTTP request to Electron EXE
   */
  async request(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.electronHost,
        port: this.electronPort,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'x-sync-api-key': config.syncApiKey
        },
        timeout: this.timeout,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(response.error || `HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Electron EXE connection failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Electron EXE request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Get database information from Electron EXE
   */
  async getDbInfo() {
    try {
      const response = await this.request('/api/sync/db-info', 'GET');
      return response;
    } catch (error) {
      console.error('Failed to get DB info from Electron:', error);
      throw error;
    }
  }

  /**
   * Create temporary database in Electron EXE
   */
  async createTempDb() {
    try {
      const response = await this.request('/api/sync/create-temp-db', 'POST');
      return response;
    } catch (error) {
      console.error('Failed to create temp DB in Electron:', error);
      throw error;
    }
  }

  /**
   * Get temporary database path from Electron EXE
   */
  async getTempDb(timestamp) {
    try {
      const response = await this.request(`/api/sync/get-temp-db?timestamp=${timestamp}`, 'GET');
      return response;
    } catch (error) {
      console.error('Failed to get temp DB from Electron:', error);
      throw error;
    }
  }

  /**
   * Cleanup specific temporary database in Electron EXE
   */
  async cleanupTempDb(timestamp) {
    try {
      const response = await this.request(`/api/sync/cleanup-temp-db?timestamp=${timestamp}`, 'DELETE');
      return response;
    } catch (error) {
      console.error('Failed to cleanup temp DB in Electron:', error);
      throw error;
    }
  }

  /**
   * Cleanup all temporary databases in Electron EXE
   */
  async cleanupAllTemp() {
    try {
      const response = await this.request('/api/sync/cleanup-all-temp', 'DELETE');
      return response;
    } catch (error) {
      console.error('Failed to cleanup all temp DBs in Electron:', error);
      throw error;
    }
  }

  /**
   * Get tables from temporary database
   */
  async getTables(timestamp) {
    try {
      const response = await this.request(`/api/sync/tables?timestamp=${timestamp}`, 'GET');
      return response;
    } catch (error) {
      console.error('Failed to get tables from Electron:', error);
      throw error;
    }
  }

  /**
   * Get table row count
   */
  async getTableCount(timestamp, tableName) {
    try {
      const response = await this.request(
        `/api/sync/table-count?timestamp=${timestamp}&table=${tableName}`,
        'GET'
      );
      return response;
    } catch (error) {
      console.error('Failed to get table count from Electron:', error);
      throw error;
    }
  }

  /**
   * Prepare database sync file (snapshot, encrypt, upload, signed URL)
   */
  async prepareSyncFile(requestId, deviceId) {
    try {
      const response = await this.request('/api/sync/create-temp-db', 'POST', { requestId, deviceId });
      return response;
    } catch (error) {
      console.error('Failed to prepare sync file in Electron:', error);
      throw error;
    }
  }

  /**
   * Cleanup temporary sync file on Supabase Storage
   */
  async cleanupSyncFile(requestId) {
    try {
      const response = await this.request(`/api/sync/cleanup-temp-db?requestId=${requestId}`, 'DELETE');
      return response;
    } catch (error) {
      console.error('Failed to cleanup sync file in Electron:', error);
      throw error;
    }
  }

  /**
   * Check if Electron EXE is available
   */
  async healthCheck() {
    try {
      const response = await this.request('/api/health', 'GET');
      return response;
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

export default new ElectronBridge();

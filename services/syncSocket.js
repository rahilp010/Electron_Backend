import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { config } from '../config/config.js';
import { PRESET_KEYS } from '../API/activation/activationController.js';

// Map to store desktop clients: apiKey -> WebSocket connection
const desktopConnections = new Map();

// Map to store active sync sessions: requestId -> session details
const syncSessions = new Map();

export const initSyncSocket = (server) => {
  const wss = new WebSocketServer({ noServer: true });
  
  // Attach connection upgrade handler to the HTTP server for '/sync' pathname
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      console.log(`[SYNC-SOCKET] Upgrade request received. Path: ${url.pathname}, Query params: ${url.search}`);
      
      if (url.pathname === '/sync') {
        const apiKey = url.searchParams.get('apiKey');
        const role = url.searchParams.get('role'); // 'desktop' or 'phone'
        console.log(`[SYNC-SOCKET] Upgrading connection for role: ${role || 'unknown'}`);
        
        const cleanApiKey = String(apiKey || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const rawApiKey = String(apiKey || '').toUpperCase().trim();
        const masterKey = (config.syncApiKey || '320e016f7a59776fe9dc4cd36d4cc4594cb859379843a9fcef74de5f005eb5ff').toUpperCase();
        const isMaster = apiKey === config.syncApiKey || cleanApiKey === masterKey || rawApiKey === masterKey;
        const isPreset = PRESET_KEYS && (PRESET_KEYS.has(cleanApiKey) || PRESET_KEYS.has(rawApiKey));

        // Validate Sync API Key (Device Authorization)
        if (!apiKey || (!isMaster && !isPreset)) {
          console.warn(`[SYNC-SOCKET] Unauthorized upgrade attempt rejected. Provided apiKey: ${apiKey}`);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.apiKey = apiKey;
          ws.cleanApiKey = cleanApiKey;
          ws.role = role;
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      console.error('[SYNC-SOCKET] Upgrade request handler error:', err);
      socket.destroy();
    }
  });

  // Handle successful WebSocket connection
  wss.on('connection', (ws) => {
    console.log(`[SYNC-SOCKET] Client connected. Role: ${ws.role}, Key: ${ws.cleanApiKey || ws.apiKey}`);
    
    if (ws.role === 'desktop') {
      // Register desktop connection strictly by cleanKey and raw key
      const key = ws.cleanApiKey || ws.apiKey;
      desktopConnections.set(key, ws);
      if (ws.apiKey) {
        desktopConnections.set(String(ws.apiKey).trim().toUpperCase(), ws);
      }
      console.log(`[SYNC-SOCKET] Desktop connection registered strictly for key: ${key}`);
    }
    
    ws.on('message', async (message) => {
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message.toString());
      } catch (err) {
        console.error('[SYNC-SOCKET] Failed to parse JSON message:', err.message);
        return;
      }
      
      const { type, requestId, deviceId, success, file, downloadUrl, expiresAt, error } = parsedMessage;
      
      switch (type) {
        // --- Messages from Phone ---
        case 'SYNC_REQUEST': {
          console.log(`[SYNC-SOCKET] Phone SYNC_REQUEST for activation key: ${ws.apiKey} (Device: ${deviceId || 'unknown'})`);
          
          const reqId = requestId || crypto.randomUUID();
          
          // Strict Activation Key Authorization Check
          const cleanKey = ws.cleanApiKey;
          const rawKey = String(ws.apiKey || '').trim().toUpperCase();
          const desktopWs = desktopConnections.get(cleanKey) || desktopConnections.get(rawKey);

          if (!desktopWs || desktopWs.readyState !== ws.OPEN) {
            console.warn(`[SYNC-SOCKET] Sync rejected. Desktop client for activation key '${ws.apiKey}' is offline.`);
            ws.send(JSON.stringify({
              type: 'SYNC_FAILED',
              requestId: reqId,
              error: `Desktop client for activation key ${ws.apiKey} is offline. Please launch the Electron Desktop app configured with key ${ws.apiKey}.`
            }));
            return;
          }
          
          // Store active sync session
          const session = {
            phoneWs: ws,
            desktopWs: desktopWs,
            apiKey: ws.apiKey,
            requestId: reqId,
            status: 'SYNC_PREPARING',
            createdAt: Date.now()
          };
          syncSessions.set(reqId, session);
          
          // Notify Phone: SYNC_PREPARING
          ws.send(JSON.stringify({
            type: 'SYNC_PREPARING',
            requestId: reqId
          }));
          
          // Request Desktop to prepare snapshot, encrypt, upload, signed URL
          desktopWs.send(JSON.stringify({
            type: 'SYNC_PREPARE_REQUEST',
            requestId: reqId,
            phoneDeviceId: deviceId
          }));
          break;
        }
        
        case 'SYNC_COMPLETE': {
          console.log(`[SYNC-SOCKET] Phone reports SYNC_COMPLETE. Request ID: ${requestId}`);
          
          const session = syncSessions.get(requestId);
          if (session && session.desktopWs && session.desktopWs.readyState === ws.OPEN) {
            session.status = 'SYNC_COMPLETE';
            // Request Desktop to delete Supabase file
            session.desktopWs.send(JSON.stringify({
              type: 'SYNC_CLEANUP_REQUEST',
              requestId
            }));
          } else {
            syncSessions.delete(requestId);
          }
          break;
        }
        
        case 'SYNC_FAILED': {
          console.warn(`[SYNC-SOCKET] Phone reports SYNC_FAILED. Request ID: ${requestId}`);
          
          const session = syncSessions.get(requestId);
          if (session && session.desktopWs && session.desktopWs.readyState === ws.OPEN) {
            session.status = 'SYNC_FAILED';
            // Clean up temporary files on Desktop side
            session.desktopWs.send(JSON.stringify({
              type: 'SYNC_CLEANUP_REQUEST',
              requestId
            }));
          } else {
            syncSessions.delete(requestId);
          }
          break;
        }
        
        // --- Messages from Desktop ---
        case 'SYNC_PREPARE_RESPONSE': {
          console.log(`[SYNC-SOCKET] Desktop sent SYNC_PREPARE_RESPONSE. Request ID: ${requestId}, Success: ${success}`);
          
          const session = syncSessions.get(requestId);
          if (!session) {
            console.warn(`[SYNC-SOCKET] No active session found for prepared response: ${requestId}`);
            return;
          }
          
          if (session.phoneWs && session.phoneWs.readyState === ws.OPEN) {
            if (success) {
              session.status = 'SYNC_READY';
              // Forward file metadata and signed URL to the Phone
              session.phoneWs.send(JSON.stringify({
                type: 'SYNC_READY',
                requestId,
                file,
                downloadUrl,
                expiresAt
              }));
            } else {
              session.status = 'SYNC_FAILED';
              session.phoneWs.send(JSON.stringify({
                type: 'SYNC_FAILED',
                requestId,
                error: error || 'Desktop failed to prepare database sync'
              }));
              syncSessions.delete(requestId);
            }
          } else {
            // Phone is disconnected, request Desktop cleanup
            ws.send(JSON.stringify({
              type: 'SYNC_CLEANUP_REQUEST',
              requestId
            }));
            syncSessions.delete(requestId);
          }
          break;
        }
        
        case 'SYNC_CLEANUP_RESPONSE': {
          console.log(`[SYNC-SOCKET] Desktop completed SYNC_CLEANUP. Request ID: ${requestId}`);
          syncSessions.delete(requestId);
          break;
        }
        
        default:
          console.warn(`[SYNC-SOCKET] Unknown message type: ${type} from role: ${ws.role}`);
      }
    });
    
    ws.on('close', () => {
      console.log(`[SYNC-SOCKET] Client connection closed. Role: ${ws.role}`);
      
      if (ws.role === 'desktop') {
        // Remove active desktop connection
        const key = ws.cleanApiKey || ws.apiKey;
        for (const [k, conn] of desktopConnections.entries()) {
          if (conn === ws) {
            desktopConnections.delete(k);
          }
        }
        console.log(`[SYNC-SOCKET] Desktop connection unregistered for key: ${key}`);
      } else if (ws.role === 'phone') {
        // Handle phone disconnect during an active session
        for (const [reqId, session] of syncSessions.entries()) {
          if (session.phoneWs === ws) {
            // Only send cleanup if session is NOT complete or failed already
            if (session.status !== 'SYNC_COMPLETE' && session.status !== 'SYNC_FAILED') {
              console.warn(`[SYNC-SOCKET] Phone disconnected during active session: ${reqId}. Triggering desktop cleanup.`);
              if (session.desktopWs && session.desktopWs.readyState === ws.OPEN) {
                session.desktopWs.send(JSON.stringify({
                  type: 'SYNC_CLEANUP_REQUEST',
                  requestId: reqId
                }));
              }
            }
            syncSessions.delete(reqId);
          }
        }
      }
    });
    
    ws.on('error', (err) => {
      console.error('[SYNC-SOCKET] WebSocket client error:', err.message);
    });
  });
};
export { desktopConnections, syncSessions };

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = pkg
import QRCode from 'qrcode'
import WhatsAppMessage from '../../API/whatsapp/whatsappSchema.js'
import { normalizeWhatsAppNumber } from './whatsappUtils.js'
import { whatsappQueue } from './whatsappQueue.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let waClient = null
let currentStatus = 'DISCONNECTED' // INITIALIZING, QR_REQUIRED, CONNECTING, CONNECTED, DISCONNECTED, LOGGED_OUT, ERROR
let currentQRCode = null
let connectedPhone = null
let lastError = null
let initializationPromise = null
let readyTimeoutHandle = null

// How long we'll wait after a QR scan / authenticated event before giving up
// and surfacing an ERROR instead of hanging silently forever.
const READY_TIMEOUT_MS = 90000

const inMemoryLogs = []

function getSessionDirectory() {
  // Prefer the env var set by Electron's localServerManager (writable user directory outside project root)
  const defaultUserDir = path.join(process.env.APPDATA || process.env.USERPROFILE || 'C:\\ProgramData', 'ENVY_ERP', 'whatsapp-sessions')
  const sessionDir = process.env.WHATSAPP_SESSION_PATH || defaultUserDir
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }
  return sessionDir
}

function cleanupLegacySessions(sessionDir) {
  // Clean up old @open-wa/wa-automate session folders (prefixed with _IGNORE_)
  try {
    if (!fs.existsSync(sessionDir)) return
    const items = fs.readdirSync(sessionDir)
    for (const item of items) {
      if (item.startsWith('_IGNORE_')) {
        const fullPath = path.join(sessionDir, item)
        fs.rmSync(fullPath, { recursive: true, force: true })
        console.log('🗑️ Cleaned up legacy OpenWA session directory:', item)
      }
    }
  } catch (err) {
    console.warn('Session cleanup warning:', err.message)
  }
}

function removeStaleLockFiles(sessionDir, sessionName) {
  const lockFileNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort']
  const sessionFolder = path.join(sessionDir, `session-${sessionName}`)
  try {
    if (!fs.existsSync(sessionFolder)) return
    for (const lockFile of lockFileNames) {
      const lockPath = path.join(sessionFolder, lockFile)
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath)
        console.log(`🧹 Cleaned up stale browser lock file: ${lockPath}`)
      }
    }
  } catch (err) {
    console.warn('Lock file cleanup warning:', err.message)
  }
}

function getBrowserExecutablePath() {
  // Set WHATSAPP_USE_BUNDLED_CHROMIUM=true to skip system browser detection
  // entirely and let Puppeteer use its own bundled Chromium. Useful if a
  // system Chrome/Edge update ever gets ahead of what this whatsapp-web.js
  // / puppeteer-core version was tested against.
  if (process.env.WHATSAPP_USE_BUNDLED_CHROMIUM === 'true') {
    return null
  }

  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ]
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p
  }
  return null
}

function clearReadyTimeout() {
  if (readyTimeoutHandle) {
    clearTimeout(readyTimeoutHandle)
    readyTimeoutHandle = null
  }
}

function armReadyTimeout(stageLabel) {
  clearReadyTimeout()
  readyTimeoutHandle = setTimeout(() => {
    if (currentStatus !== 'CONNECTED') {
      console.error(`⏱️ WhatsApp Backend timed out waiting for 'ready' after ${stageLabel} (${READY_TIMEOUT_MS / 1000}s).`)
      currentStatus = 'ERROR'
      lastError = `Timed out waiting for WhatsApp to finish connecting after ${stageLabel}. This usually means the cached WhatsApp Web version or local browser is out of sync — try restarting, or set WHATSAPP_USE_BUNDLED_CHROMIUM=true.`
    }
  }, READY_TIMEOUT_MS)
}

async function safelyDestroyClient() {
  clearReadyTimeout()
  try {
    if (waClient) {
      await waClient.destroy()
    }
  } catch (err) {
    console.warn('safelyDestroyClient warning:', err.message)
  } finally {
    waClient = null
    currentStatus = 'DISCONNECTED'
  }
}

async function logMessageHistory({ clientId, phone, message, messageType, filePath, status, error }) {
  try {
    const doc = new WhatsAppMessage({
      clientId: clientId || null,
      phone,
      message: message || '',
      messageType: messageType || 'text',
      filePath: filePath || null,
      status,
      error: error || null
    })
    await doc.save()
  } catch (err) {
    console.warn('MongoDB log failed, saving to memory fallback:', err.message)
    inMemoryLogs.unshift({
      id: Date.now().toString(),
      clientId,
      phone,
      message,
      messageType,
      filePath,
      status,
      error,
      createdAt: new Date()
    })
  }
}

async function initializeWhatsAppInternal(retryCount = 0) {
  if (waClient && currentStatus === 'CONNECTED') {
    return { success: true, status: currentStatus, phone: connectedPhone }
  }

  currentStatus = 'INITIALIZING'
  lastError = null

  try {
    if (waClient) {
      await safelyDestroyClient()
    }

    const sessionDir = getSessionDirectory()
    cleanupLegacySessions(sessionDir)
    removeStaleLockFiles(sessionDir, 'ENVY_BACKEND_SESSION')

    const browserPath = getBrowserExecutablePath()

    const clientOptions = {
      authStrategy: new LocalAuth({
        clientId: 'ENVY_BACKEND_SESSION',
        dataPath: sessionDir
      }),
      // IMPORTANT: don't pin this to a fixed commit/version file. A frozen
      // WhatsApp Web build can drift out of sync with what WhatsApp's
      // servers currently expect, which lets auth succeed (device links
      // fine) but silently stalls the page before 'ready' ever fires, with
      // no thrown error. Using {version} lets the library resolve and cache
      // whatever the current live version actually is.
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html'
      },
      // Disables whatsapp-web.js's internal auth timeout so a slow WA Web
      // load doesn't get killed mid-way — our own armReadyTimeout() below
      // is what now decides when to give up.
      authTimeoutMs: 0,
      puppeteer: {
        // 'new' is the modern, more stable Chrome headless mode. The old
        // `headless: true` mode is known to have rendering/detection
        // issues with heavier single-page apps like WhatsApp Web on
        // current Chrome releases.
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        ...(browserPath ? { executablePath: browserPath } : {})
      }
    }

    waClient = new Client(clientOptions)

    // ── Event: QR Code ──
    waClient.on('qr', async (qr) => {
      console.log('⚡ WhatsApp Backend QR Code generated')
      try {
        currentQRCode = await QRCode.toDataURL(qr)
      } catch (e) {
        currentQRCode = qr
      }
      currentStatus = 'QR_REQUIRED'
      armReadyTimeout('QR generation')
    })

    // ── Event: Loading screen (diagnostic — shows real page-load progress) ──
    waClient.on('loading_screen', (percent, message) => {
      console.log(`⏳ WhatsApp Backend loading: ${percent}% - ${message}`)
    })

    // ── Event: Authenticated ──
    waClient.on('authenticated', () => {
      console.log('🔐 WhatsApp Backend session authenticated')
      currentStatus = 'CONNECTING'
      currentQRCode = null
      armReadyTimeout('authentication')

      setTimeout(() => {
        try {
          if (waClient && waClient.info && waClient.info.wid) {
            console.log('✅ Connected phone detected on authenticated event:', waClient.info.wid.user)
            currentStatus = 'CONNECTED'
            connectedPhone = `+${waClient.info.wid.user}`
            clearReadyTimeout()
          }
        } catch (e) {}
      }, 2000)
    })

    // ── Event: Ready ──
    waClient.on('ready', () => {
      console.log('✅ WhatsApp Backend client is ready')
      currentStatus = 'CONNECTED'
      currentQRCode = null
      lastError = null
      clearReadyTimeout()

      try {
        if (waClient.info && waClient.info.wid) {
          connectedPhone = `+${waClient.info.wid.user}`
        }
      } catch (e) {
        console.log('Could not fetch host phone number:', e.message)
      }
    })

    // ── Event: Auth failure ──
    waClient.on('auth_failure', (msg) => {
      console.error('🔴 WhatsApp Backend auth failure:', msg)
      currentStatus = 'ERROR'
      lastError = `Authentication failed: ${msg}`
      clearReadyTimeout()
    })

    // ── Event: Disconnected ──
    waClient.on('disconnected', (reason) => {
      console.log('📵 WhatsApp Backend disconnected:', reason)
      currentStatus = 'DISCONNECTED'
      connectedPhone = null
      waClient = null
      clearReadyTimeout()
    })

    // ── Event: State change ──
    waClient.on('change_state', (state) => {
      console.log('📶 WhatsApp Backend state changed:', state)
    })

    // Start client
    await waClient.initialize()

    return { success: true, status: currentStatus, phone: connectedPhone }
  } catch (err) {
    console.error('❌ Failed to initialize WhatsApp client on backend:', err.message)

    await safelyDestroyClient()

    const isLockError =
      err.message?.includes('already running') ||
      err.message?.includes('userDataDir') ||
      err.message?.includes('SingletonLock')

    if (retryCount < 2 && isLockError) {
      console.warn(`⚠️ Detected locked session dir on attempt ${retryCount + 1}. Cleaning lock files and retrying in 1.5s...`)
      const sessionDir = getSessionDirectory()
      removeStaleLockFiles(sessionDir, 'ENVY_BACKEND_SESSION')
      currentStatus = 'DISCONNECTED'
      await new Promise((res) => setTimeout(res, 1500))
      return await initializeWhatsAppInternal(retryCount + 1)
    }

    lastError = err.message
    currentStatus = 'ERROR'

    return { success: false, status: 'ERROR', error: err.message }
  }
}

export async function initializeWhatsApp() {
  if (waClient && currentStatus === 'CONNECTED') {
    return { success: true, status: currentStatus, phone: connectedPhone }
  }

  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = initializeWhatsAppInternal().finally(() => {
    initializationPromise = null
  })

  return initializationPromise
}

export function getWhatsAppStatus() {
  if (waClient && (currentStatus === 'CONNECTING' || currentStatus === 'INITIALIZING' || currentStatus === 'QR_REQUIRED')) {
    try {
      if (waClient.info && waClient.info.wid) {
        currentStatus = 'CONNECTED'
        connectedPhone = `+${waClient.info.wid.user}`
        currentQRCode = null
        lastError = null
        clearReadyTimeout()
      }
    } catch (e) {}
  }

  return {
    status: currentStatus,
    phone: connectedPhone,
    qr: currentQRCode,
    error: lastError,
    queueCount: whatsappQueue.getPendingCount()
  }
}

export async function logoutWhatsApp() {
  try {
    if (waClient) {
      try {
        await waClient.logout()
        await waClient.destroy()
      } catch (e) {
        console.warn('Logout/destroy warning:', e.message)
      }
      waClient = null
    }
    connectedPhone = null
    currentQRCode = null
    currentStatus = 'LOGGED_OUT'
    clearReadyTimeout()
    return { success: true }
  } catch (err) {
    console.error('Error during WhatsApp backend logout:', err)
    return { success: false, error: err.message }
  }
}

export async function restartWhatsApp() {
  try {
    if (waClient) {
      try {
        await waClient.destroy()
      } catch (e) {
        console.warn('Destroy waClient warning:', e.message)
      }
      waClient = null
    }
    currentStatus = 'DISCONNECTED'
    currentQRCode = null
    connectedPhone = null
    clearReadyTimeout()
    return await initializeWhatsApp()
  } catch (err) {
    console.error('Error during WhatsApp backend restart:', err)
    return { success: false, error: err.message }
  }
}

export async function checkNumber(phone) {
  if (!waClient || currentStatus !== 'CONNECTED') {
    return { success: false, registered: false, error: 'WhatsApp is not connected.' }
  }

  const norm = normalizeWhatsAppNumber(phone)
  if (!norm.isValid) {
    return { success: false, registered: false, error: norm.error }
  }

  try {
    const isRegistered = await waClient.isRegisteredUser(norm.waId)
    return {
      success: true,
      registered: isRegistered,
      formatted: norm.formatted
    }
  } catch (err) {
    console.error('checkNumber error:', err)
    return { success: false, registered: false, error: err.message }
  }
}

export async function sendMessage(phone, message, clientId = null) {
  const norm = normalizeWhatsAppNumber(phone)
  if (!norm.isValid) {
    await logMessageHistory({
      clientId,
      phone,
      message,
      messageType: 'text',
      status: 'FAILED',
      error: norm.error
    })
    return { success: false, phone, error: norm.error }
  }

  if (!waClient || currentStatus !== 'CONNECTED') {
    const err = 'WhatsApp backend client is not connected. Please login via QR code first.'
    await logMessageHistory({
      clientId,
      phone: norm.formatted,
      message,
      messageType: 'text',
      status: 'FAILED',
      error: err
    })
    return { success: false, phone: norm.formatted, error: err }
  }

  return whatsappQueue.enqueue(async () => {
    try {
      const sendResult = await waClient.sendMessage(norm.waId, message)
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message,
        messageType: 'text',
        status: 'SENT',
        error: null
      })
      return {
        success: true,
        phone: norm.formatted,
        message: 'Message sent successfully',
        details: sendResult?.id?._serialized || sendResult
      }
    } catch (err) {
      console.error('sendMessage failed:', err)
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message,
        messageType: 'text',
        status: 'FAILED',
        error: err.message
      })
      return { success: false, phone: norm.formatted, error: err.message }
    }
  })
}

export async function sendDocument(phone, filePath, caption = '', clientId = null) {
  const norm = normalizeWhatsAppNumber(phone)
  if (!norm.isValid) {
    await logMessageHistory({
      clientId,
      phone,
      message: caption,
      messageType: 'document',
      filePath,
      status: 'FAILED',
      error: norm.error
    })
    return { success: false, phone, error: norm.error }
  }

  if (!fs.existsSync(filePath)) {
    const err = `File not found at path: ${filePath}`
    await logMessageHistory({
      clientId,
      phone: norm.formatted,
      message: caption,
      messageType: 'document',
      filePath,
      status: 'FAILED',
      error: err
    })
    return { success: false, phone: norm.formatted, error: err }
  }

  if (!waClient || currentStatus !== 'CONNECTED') {
    const err = 'WhatsApp backend client is not connected. Please login via QR code first.'
    await logMessageHistory({
      clientId,
      phone: norm.formatted,
      message: caption,
      messageType: 'document',
      filePath,
      status: 'FAILED',
      error: err
    })
    return { success: false, phone: norm.formatted, error: err }
  }

  return whatsappQueue.enqueue(async () => {
    try {
      const media = MessageMedia.fromFilePath(filePath)
      const sendResult = await waClient.sendMessage(norm.waId, media, {
        caption: caption || undefined,
        sendMediaAsDocument: true
      })
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message: caption,
        messageType: 'document',
        filePath,
        status: 'SENT',
        error: null
      })
      return {
        success: true,
        phone: norm.formatted,
        message: 'Document sent successfully',
        details: sendResult?.id?._serialized || sendResult
      }
    } catch (err) {
      console.error('sendDocument failed:', err)
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message: caption,
        messageType: 'document',
        filePath,
        status: 'FAILED',
        error: err.message
      })
      return { success: false, phone: norm.formatted, error: err.message }
    }
  })
}

export async function sendImage(phone, filePath, caption = '', clientId = null) {
  const norm = normalizeWhatsAppNumber(phone)
  if (!norm.isValid) {
    await logMessageHistory({
      clientId,
      phone,
      message: caption,
      messageType: 'image',
      filePath,
      status: 'FAILED',
      error: norm.error
    })
    return { success: false, phone, error: norm.error }
  }

  if (!fs.existsSync(filePath)) {
    const err = `Image file not found at path: ${filePath}`
    await logMessageHistory({
      clientId,
      phone: norm.formatted,
      message: caption,
      messageType: 'image',
      filePath,
      status: 'FAILED',
      error: err
    })
    return { success: false, phone: norm.formatted, error: err }
  }

  if (!waClient || currentStatus !== 'CONNECTED') {
    const err = 'WhatsApp backend client is not connected. Please login via QR code first.'
    await logMessageHistory({
      clientId,
      phone: norm.formatted,
      message: caption,
      messageType: 'image',
      filePath,
      status: 'FAILED',
      error: err
    })
    return { success: false, phone: norm.formatted, error: err }
  }

  return whatsappQueue.enqueue(async () => {
    try {
      const media = MessageMedia.fromFilePath(filePath)
      const sendResult = await waClient.sendMessage(norm.waId, media, {
        caption: caption || undefined
      })
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message: caption,
        messageType: 'image',
        filePath,
        status: 'SENT',
        error: null
      })
      return {
        success: true,
        phone: norm.formatted,
        message: 'Image sent successfully',
        details: sendResult?.id?._serialized || sendResult
      }
    } catch (err) {
      console.error('sendImage failed:', err)
      await logMessageHistory({
        clientId,
        phone: norm.formatted,
        message: caption,
        messageType: 'image',
        filePath,
        status: 'FAILED',
        error: err.message
      })
      return { success: false, phone: norm.formatted, error: err.message }
    }
  })
}

export async function getWhatsAppMessages(clientId = null) {
  try {
    const query = clientId ? { clientId } : {}
    const docs = await WhatsAppMessage.find(query).sort({ createdAt: -1 }).limit(100)
    return { success: true, data: docs }
  } catch (err) {
    console.warn('MongoDB query failed, using in-memory logs fallback:', err.message)
    const filtered = clientId ? inMemoryLogs.filter((l) => l.clientId === clientId) : inMemoryLogs
    return { success: true, data: filtered }
  }
}

export function destroyWhatsAppService() {
  clearReadyTimeout()
  console.log('🧹 WhatsApp service cleaned up.')
}
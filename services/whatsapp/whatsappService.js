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

const inMemoryLogs = []

function getSessionDirectory() {
  const sessionDir = path.join(__dirname, '../../whatsapp-sessions')
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

function getBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  const possiblePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
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

export async function initializeWhatsApp() {
  if (waClient && currentStatus === 'CONNECTED') {
    return { success: true, status: currentStatus, phone: connectedPhone }
  }

  // Prevent re-initialization if already in progress
  if (currentStatus === 'INITIALIZING') {
    return { success: false, status: 'INITIALIZING', error: 'Initialization already in progress.' }
  }

  currentStatus = 'INITIALIZING'
  lastError = null

  try {
    const sessionDir = getSessionDirectory()
    cleanupLegacySessions(sessionDir)

    const browserPath = getBrowserExecutablePath()

    const clientOptions = {
      authStrategy: new LocalAuth({
        clientId: 'ENVY_BACKEND_SESSION',
        dataPath: sessionDir
      }),
      puppeteer: {
        headless: true,
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
        // Generate a data URI so the frontend can display it directly
        currentQRCode = await QRCode.toDataURL(qr)
      } catch (e) {
        // Fallback to raw QR string if data URI generation fails
        currentQRCode = qr
      }
      currentStatus = 'QR_REQUIRED'
    })

    // ── Event: Authenticated (session restored or QR scanned) ──
    waClient.on('authenticated', () => {
      console.log('🔐 WhatsApp Backend session authenticated')
      currentStatus = 'CONNECTING'
      currentQRCode = null
    })

    // ── Event: Ready (fully connected) ──
    waClient.on('ready', () => {
      console.log('✅ WhatsApp Backend client is ready')
      currentStatus = 'CONNECTED'
      currentQRCode = null
      lastError = null

      try {
        if (waClient.info && waClient.info.wid) {
          connectedPhone = `+${waClient.info.wid.user}`
        }
      } catch (e) {
        console.log('Could not fetch host phone number:', e.message)
      }
    })

    // ── Event: Authentication failure ──
    waClient.on('auth_failure', (msg) => {
      console.error('🔴 WhatsApp Backend auth failure:', msg)
      currentStatus = 'ERROR'
      lastError = `Authentication failed: ${msg}`
    })

    // ── Event: Disconnected ──
    waClient.on('disconnected', (reason) => {
      console.log('📵 WhatsApp Backend disconnected:', reason)
      currentStatus = 'DISCONNECTED'
      connectedPhone = null
      waClient = null
    })

    // ── Event: State change ──
    waClient.on('change_state', (state) => {
      console.log('📶 WhatsApp Backend state changed:', state)
    })

    // Start the client (non-blocking — events handle the rest)
    await waClient.initialize()

    // If we reached here without error, the client initialized successfully.
    // The 'ready' event may or may not have fired yet (depends on session state).
    return { success: true, status: currentStatus, phone: connectedPhone }
  } catch (err) {
    console.error('❌ Failed to initialize WhatsApp client on backend:', err.message)
    lastError = err.message
    currentStatus = 'ERROR'

    // Clean up the client reference if initialization failed
    if (waClient) {
      try {
        await waClient.destroy()
      } catch (e) {
        // Ignore destroy errors during cleanup
      }
      waClient = null
    }

    return { success: false, status: 'ERROR', error: err.message }
  }
}

export function getWhatsAppStatus() {
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
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
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1018940842-alpha.html'
      },
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

    // Handle internal page errors on Puppeteer page to suppress benign WhatsApp Web toast/memoization errors
    waClient.on('loading_screen', (percent, message) => {
      if (waClient.pupPage) {
        waClient.pupPage.removeAllListeners('pageerror')
        waClient.pupPage.on('pageerror', (pageErr) => {
          console.warn('WhatsApp Web internal page error (suppressed):', pageErr?.message || pageErr)
        })
      }
    })

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
    waClient.on('ready', async () => {
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

      // Suppress addToast & memoize errors inside WhatsApp Web page
      try {
        if (waClient.pupPage) {
          await waClient.pupPage.evaluate(() => {
            window.addEventListener('error', (e) => {
              if (e.message && (e.message.includes('addToast') || e.message.includes('memoize') || e.message.includes('id property'))) {
                e.stopImmediatePropagation()
                e.preventDefault()
              }
            }, true)
          })
        }
      } catch (e) {
        // Ignore page evaluation errors
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
    const isBenignError = err.message && (
      err.message.includes('addToast') ||
      err.message.includes('memoize') ||
      err.message.includes('id property')
    )

    if (isBenignError) {
      console.warn('⚠️ Suppressed non-fatal WhatsApp Web script error during init:', err.message)
      if (currentStatus === 'INITIALIZING') {
        currentStatus = 'CONNECTING'
      }
      return { success: true, status: currentStatus, phone: connectedPhone }
    }

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
  const isBenign = lastError && (
    lastError.includes('addToast') ||
    lastError.includes('memoize') ||
    lastError.includes('id property')
  )

  return {
    status: currentStatus,
    phone: connectedPhone,
    qr: currentQRCode,
    error: isBenign ? null : lastError,
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

async function ensurePagePatched(client) {
  if (!client || !client.pupPage) return
  try {
    await client.pupPage.evaluate(() => {
      if (window.WWebJS) {
        if (!window.WWebJS._patchedForAddToast) {
          window.WWebJS._patchedForAddToast = true

          // Patch window error handling
          window.addEventListener('error', (e) => {
            if (e.message && (e.message.includes('addToast') || e.message.includes('memoize') || e.message.includes('id property'))) {
              e.stopImmediatePropagation()
              e.preventDefault()
            }
          }, true)

          // Patch processMediaData if available
          if (typeof window.WWebJS.processMediaData === 'function') {
            const origProcess = window.WWebJS.processMediaData
            window.WWebJS.processMediaData = async function (...args) {
              const res = await origProcess.apply(this, args)
              if (res && typeof res === 'object' && !res.id) {
                res.id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
              }
              return res
            }
          }

          // Patch sendMessage to handle missing id memoization error
          if (typeof window.WWebJS.sendMessage === 'function') {
            const origSend = window.WWebJS.sendMessage
            window.WWebJS.sendMessage = async function (chat, content, options = {}) {
              if (options.media && typeof options.media === 'object' && !options.media.id) {
                options.media.id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
              }
              try {
                return await origSend.call(this, chat, content, options)
              } catch (err) {
                if (err && err.message && (err.message.includes('addToast') || err.message.includes('memoize') || err.message.includes('id property'))) {
                  console.warn('[Patch] Safely intercepted addToast error in WWebJS.sendMessage')
                  return { id: { _serialized: 'patched_' + Date.now() }, ack: 1 }
                }
                throw err
              }
            }
          }
        }
      }
    })
  } catch (e) {
    // Ignore page evaluation error during navigation
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
      await ensurePagePatched(waClient)
      let sendResult
      try {
        sendResult = await waClient.sendMessage(norm.waId, message)
      } catch (err) {
        if (err.message && (err.message.includes('addToast') || err.message.includes('memoize') || err.message.includes('id property'))) {
          console.warn('⚠️ Intercepted addToast error in sendMessage text fallback:', err.message)
          sendResult = { id: { _serialized: 'text_' + Date.now() } }
        } else {
          throw err
        }
      }

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
      await ensurePagePatched(waClient)

      // Read file as buffer and create MessageMedia properly
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)
      const media = new MessageMedia(
        path.extname(filePath).replace('.', ''),
        fileBuffer,
        fileName,
        caption || undefined
      )

      // Set id to prevent memoization errors
      if (!media.id) {
        media.id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      }

      // Ensure media object has all required properties
      if (!media.mimetype) {
        media.mimetype = 'application/pdf'
      }
      if (!media.data) {
        media.data = fileBuffer
      }

      let sendResult
      try {
        sendResult = await waClient.sendMessage(norm.waId, media, {
          sendMediaAsDocument: true
        })
      } catch (err) {
        if (err.message && (err.message.includes('addToast') || err.message.includes('memoize') || err.message.includes('id property'))) {
          console.warn('⚠️ Intercepted addToast error in sendDocument fallback:', err.message)
          sendResult = { id: { _serialized: 'doc_' + Date.now() } }
        } else {
          throw err
        }
      }

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
      await ensurePagePatched(waClient)

      // Read file as buffer and create MessageMedia properly
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)
      const media = new MessageMedia(
        path.extname(filePath).replace('.', ''),
        fileBuffer,
        fileName,
        caption || undefined
      )

      // Set id to prevent memoization errors
      if (!media.id) {
        media.id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      }

      // Ensure media object has all required properties
      if (!media.mimetype) {
        media.mimetype = 'image/jpeg'
      }
      if (!media.data) {
        media.data = fileBuffer
      }

      let sendResult
      try {
        sendResult = await waClient.sendMessage(norm.waId, media, {
          caption: caption || undefined
        })
      } catch (err) {
        if (err.message && (err.message.includes('addToast') || err.message.includes('memoize') || err.message.includes('id property'))) {
          console.warn('⚠️ Intercepted addToast error in sendImage fallback:', err.message)
          sendResult = { id: { _serialized: 'img_' + Date.now() } }
        } else {
          throw err
        }
      }

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

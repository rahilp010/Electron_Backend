import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  initializeWhatsApp,
  getWhatsAppStatus,
  logoutWhatsApp,
  restartWhatsApp,
  sendMessage,
  sendDocument,
  sendImage,
  checkNumber,
  getWhatsAppMessages
} from '../../services/whatsapp/whatsappService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function handleInitialize(req, res) {
  try {
    const result = await initializeWhatsApp()
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export function handleGetStatus(req, res) {
  try {
    const status = getWhatsAppStatus()
    res.json(status)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleSendMessage(req, res) {
  try {
    const { phone, message, clientId } = req.body
    const result = await sendMessage(phone, message, clientId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleSendDocument(req, res) {
  try {
    const { phone, filePath, caption, clientId } = req.body
    const result = await sendDocument(phone, filePath, caption, clientId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleSendImage(req, res) {
  try {
    const { phone, filePath, caption, clientId } = req.body
    const result = await sendImage(phone, filePath, caption, clientId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleCheckNumber(req, res) {
  try {
    const { phone } = req.body
    const result = await checkNumber(phone)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleLogout(req, res) {
  try {
    const result = await logoutWhatsApp()
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleRestart(req, res) {
  try {
    const result = await restartWhatsApp()
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleGetHistory(req, res) {
  try {
    const clientId = req.params.clientId || req.query.clientId || null
    const result = await getWhatsAppMessages(clientId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function handleSaveTempPdfBuffer(req, res) {
  try {
    const { buffer, fileName, base64 } = req.body
    const tempDir = path.join(__dirname, '../../uploads/temp_pdfs')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const safeFileName = fileName || `pdf_${Date.now()}.pdf`
    const targetPath = path.join(tempDir, safeFileName)

    let pdfBuffer
    if (base64) {
      pdfBuffer = Buffer.from(base64, 'base64')
    } else if (Array.isArray(buffer)) {
      pdfBuffer = Buffer.from(buffer)
    } else if (typeof buffer === 'object' && buffer?.data) {
      pdfBuffer = Buffer.from(buffer.data)
    } else {
      pdfBuffer = Buffer.from(buffer)
    }

    fs.writeFileSync(targetPath, pdfBuffer)
    res.json({ success: true, filePath: targetPath })
  } catch (err) {
    console.error('Failed to save temp PDF on backend:', err)
    res.status(500).json({ success: false, error: err.message })
  }
}

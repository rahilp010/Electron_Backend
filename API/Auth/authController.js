import { v4 as uuidv4 } from 'uuid'

const sessionStore = new Map();

const setWithExpiry = (key, value, ttlSeconds) => {
  const expiresAt = Date.now() + ttlSeconds * 1000
  sessionStore.set(key, { ...value, expiresAt })

  // Auto-cleanup when expired
  setTimeout(() => {
    sessionStore.delete(key)
  }, ttlSeconds * 1000)
}

// 1. Create QR session
const createQR = async (req, res) => {
  const sessionId = uuidv4()
  const challenge = uuidv4()

  setWithExpiry(sessionId, { challenge, status: 'pending' }, 120)

  res.json({ sessionId, challenge, expiresIn: 120 })
}

// 2. Verify QR (from mobile)
const verifyQR = async (req, res) => {
  const { sessionId, challenge, userId } = req.body
  const data = sessionStore.get(sessionId)

  if (!data) {
    return res.status(400).json({ status: 'error', message: 'Invalid or expired session' })
  }

  if (data.challenge !== challenge) {
    return res.status(400).json({ status: 'error', message: 'Challenge mismatch' })
  }

  setWithExpiry(sessionId, { ...data, status: 'authenticated', userId }, 300)

  res.json({ status: 'ok', message: 'Session authenticated' })
}

// 3. Check session status (from Electron)
const checkSessionStatus = async (req, res) => {
  const data = sessionStore.get(req.params.sessionId)

  if (!data) {
    return res.status(404).json({ status: 'error', message: 'Session not found or expired' })
  }

  // Check expiry
  if (Date.now() > data.expiresAt) {
    sessionStore.delete(req.params.sessionId)
    return res.status(404).json({ status: 'error', message: 'Session expired' })
  }

  res.json({ challenge: data.challenge, status: data.status, userId: data.userId || null })
}

export { createQR, verifyQR, checkSessionStatus }

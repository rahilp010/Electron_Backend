// import { v4 as uuidv4 } from 'uuid'

// const sessionStore = new Map();

// const setWithExpiry = (key, value, ttlSeconds) => {
//   const expiresAt = Date.now() + ttlSeconds * 1000
//   sessionStore.set(key, { ...value, expiresAt })

//   // Auto-cleanup when expired
//   setTimeout(() => {
//     sessionStore.delete(key)
//   }, ttlSeconds * 1000)
// }

// // 1. Create QR session
// const createQR = async (req, res) => {
//   const sessionId = uuidv4()
//   const challenge = uuidv4()

//   setWithExpiry(sessionId, { challenge, status: 'pending' }, 120)

//   res.json({ sessionId, challenge, expiresIn: 120 })
// }

// // 2. Verify QR (from mobile)
// const verifyQR = async (req, res) => {
//   const { sessionId, challenge, userId } = req.body
//   const data = sessionStore.get(sessionId)

//   if (!data) {
//     return res.status(400).json({ status: 'error', message: 'Invalid or expired session' })
//   }

//   if (data.challenge !== challenge) {
//     return res.status(400).json({ status: 'error', message: 'Challenge mismatch' })
//   }

//   setWithExpiry(sessionId, { ...data, status: 'authenticated', userId }, 300)

//   res.json({ status: 'ok', message: 'Session authenticated' })
// }

// // 3. Check session status (from Electron)
// const checkSessionStatus = async (req, res) => {
//   const data = sessionStore.get(req.params.sessionId)

//   if (!data) {
//     return res.status(404).json({ status: 'error', message: 'Session not found or expired' })
//   }

//   // Check expiry
//   if (Date.now() > data.expiresAt) {
//     sessionStore.delete(req.params.sessionId)
//     return res.status(404).json({ status: 'error', message: 'Session expired' })
//   }

//   res.json({ challenge: data.challenge, status: data.status, userId: data.userId || null })
// }

// export { createQR, verifyQR, checkSessionStatus }


app.post('/api/auth/passcode/verify', async (req, res) => {
  try {
    const { passcode, userId = 'default-user' } = req.body;

    if (!passcode || !/^\d{6}$/.test(passcode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid passcode format'
      });
    }

    const passcodeData = passcodes.get(userId);
    if (!passcodeData) {
      return res.status(404).json({
        success: false,
        error: 'No passcode set for this user'
      });
    }

    // Check if account is locked
    if (passcodeData.lockedUntil && Date.now() < passcodeData.lockedUntil) {
      const remainingTime = Math.ceil((passcodeData.lockedUntil - Date.now()) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: `Account locked. Try again in ${remainingTime} minutes`
      });
    }

    // Reset attempts if lockout expired
    if (passcodeData.lockedUntil && Date.now() >= passcodeData.lockedUntil) {
      passcodeData.attempts = 0;
      passcodeData.lockedUntil = null;
    }

    // Verify passcode
    const isValid = await bcrypt.compare(passcode, passcodeData.hashedPasscode);

    if (!isValid) {
      passcodeData.attempts++;

      if (passcodeData.attempts >= MAX_ATTEMPTS) {
        passcodeData.lockedUntil = Date.now() + LOCKOUT_DURATION;
        return res.status(429).json({
          success: false,
          error: 'Too many failed attempts. Account locked for 15 minutes'
        });
      }

      return res.status(401).json({
        success: false,
        error: `Invalid passcode. ${MAX_ATTEMPTS - passcodeData.attempts} attempts remaining`
      });
    }

    // Success - reset attempts
    passcodeData.attempts = 0;
    passcodeData.lockedUntil = null;

    // Create session
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        sessionId,
        userId,
        method: 'passcode'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    sessions.set(sessionId, {
      userId,
      createdAt: Date.now(),
      method: 'passcode'
    });

    res.json({
      success: true,
      data: {
        token,
        sessionId,
        expiresIn: 86400
      }
    });

  } catch (error) {
    console.error('Passcode verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});


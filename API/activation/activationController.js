import ActivationKey from './activationSchema.js';
import { config } from '../../config/config.js';

// ─────────────────────────────────────────────────────────────
// Admin auth helper — checks x-admin-secret header
// ─────────────────────────────────────────────────────────────
const isAdmin = (req) => {
  const secret = req.headers['x-admin-secret'];
  return secret && secret === config.activationAdminSecret;
};

// ─────────────────────────────────────────────────────────────
// POST /api/activation/validate
// Body: { key, deviceId }
// Validates an existing activation key + device pair.
// ─────────────────────────────────────────────────────────────
export const validateKey = async (req, res, next) => {
  try {
    const { key, deviceId } = req.body ?? {};

    if (!key || !deviceId) {
      return res.status(400).json({ valid: false, reason: 'key and deviceId are required.' });
    }

    const record = await ActivationKey.findOne({ key: key.toUpperCase().trim() }).lean();

    if (!record) {
      return res.status(200).json({ valid: false, reason: 'Invalid activation key.' });
    }

    if (record.revoked) {
      return res.status(200).json({ valid: false, reason: 'Key has been revoked.' });
    }

    if (record.expiry && new Date(record.expiry) < new Date()) {
      return res.status(200).json({ valid: false, reason: 'Key has expired.' });
    }

    if (record.deviceId && record.deviceId !== deviceId) {
      return res.status(200).json({ valid: false, reason: 'Device mismatch. Please re-activate.' });
    }

    return res.status(200).json({
      valid: true,
      user: record.user,
      expiry: record.expiry,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/activation/activate
// Body: { key, deviceId, platform, hostname }
// Activates a key on a device. Re-activation on a different
// device is allowed — the change is logged.
// ─────────────────────────────────────────────────────────────
export const activateKey = async (req, res, next) => {
  try {
    const { key, deviceId, platform, hostname } = req.body ?? {};

    if (!key || !deviceId) {
      return res.status(400).json({ success: false, message: 'key and deviceId are required.' });
    }

    const record = await ActivationKey.findOne({ key: key.toUpperCase().trim() });

    if (!record) {
      return res.status(200).json({ success: false, message: 'Invalid activation key.' });
    }

    if (record.revoked) {
      return res.status(200).json({ success: false, message: 'This key has been revoked.' });
    }

    if (record.expiry && new Date(record.expiry) < new Date()) {
      return res.status(200).json({ success: false, message: 'This key has expired.' });
    }

    // Log the activation (device change or first-time)
    record.activations.push({
      deviceId,
      platform: platform || 'win32',
      hostname: hostname || '',
      at: new Date(),
    });

    // Update current device
    record.deviceId = deviceId;

    await record.save();

    return res.status(200).json({
      success: true,
      user: record.user,
      message: 'Activation successful!',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/activation/keys  (admin only)
// Returns all keys with status, deviceId, activations, expiry.
// Protected by x-admin-secret header.
// ─────────────────────────────────────────────────────────────
export const listKeys = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ message: 'Unauthorized. Invalid admin secret.' });
    }

    const keys = await ActivationKey.find({}).lean();

    // Transform into the { "KEY": { ...data } } format from the spec
    const result = {};
    for (const k of keys) {
      result[k.key] = {
        user: k.user,
        createdAt: k.createdAt,
        expiry: k.expiry,
        revoked: k.revoked,
        deviceId: k.deviceId,
        activations: k.activations,
      };
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/activation/keys/revoke  (admin only)
// Body: { key }
// Revokes a key immediately.
// ─────────────────────────────────────────────────────────────
export const revokeKey = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ message: 'Unauthorized. Invalid admin secret.' });
    }

    const { key } = req.body ?? {};

    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required.' });
    }

    const record = await ActivationKey.findOne({ key: key.toUpperCase().trim() });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Key not found.' });
    }

    record.revoked = true;
    await record.save();

    return res.status(200).json({ success: true, message: 'Key revoked.' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/activation/keys/create  (admin only)
// Body: { key, user, expiry }
// Creates a single key from admin panel / API.
// ─────────────────────────────────────────────────────────────
export const createKey = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ message: 'Unauthorized. Invalid admin secret.' });
    }

    const { key, user, expiry } = req.body ?? {};

    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required.' });
    }

    const existing = await ActivationKey.findOne({ key: key.toUpperCase().trim() }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Key already exists.' });
    }

    const newKey = await ActivationKey.create({
      key: key.toUpperCase().trim(),
      user: user || '',
      expiry: expiry || null,
      revoked: false,
      deviceId: null,
      activations: [],
    });

    return res.status(201).json({
      success: true,
      message: 'Key created.',
      key: newKey.key,
      user: newKey.user,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/activation/keys/bulk  (admin only)
// Body: { keys: [{ key, user, expiry }] }
// Bulk-creates multiple keys at once.
// ─────────────────────────────────────────────────────────────
export const bulkCreateKeys = async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(401).json({ message: 'Unauthorized. Invalid admin secret.' });
    }

    const { keys } = req.body ?? {};

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: 'keys array is required.' });
    }

    const docs = keys.map((k) => ({
      key: String(k.key || k).toUpperCase().trim(),
      user: k.user || '',
      expiry: k.expiry || null,
      revoked: false,
      deviceId: null,
      activations: [],
    }));

    const created = await ActivationKey.insertMany(docs, { ordered: false }).catch((err) => {
      // Handle duplicate key errors gracefully
      if (err.code === 11000 && err.insertedDocs) {
        return err.insertedDocs;
      }
      throw err;
    });

    return res.status(201).json({
      success: true,
      message: `${Array.isArray(created) ? created.length : 0} key(s) created.`,
      count: Array.isArray(created) ? created.length : 0,
    });
  } catch (error) {
    next(error);
  }
};

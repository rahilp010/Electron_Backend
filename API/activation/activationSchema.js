import mongoose from 'mongoose';

const activationEntrySchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    platform: { type: String, default: 'win32' },
    hostname: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const activationKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    user: {
      type: String,
      default: '',
      trim: true,
    },
    expiry: {
      type: Date,
      default: null,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    deviceId: {
      type: String,
      default: null,
    },
    activations: {
      type: [activationEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const ActivationKey =
  mongoose.models.ActivationKey ||
  mongoose.model('ActivationKey', activationKeySchema);

export default ActivationKey;

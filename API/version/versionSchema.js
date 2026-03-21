import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'success',
      trim: true,
    },
    changeLog: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const VersionConfig = mongoose.models.VersionConfig || mongoose.model('VersionConfig', versionSchema);

export default VersionConfig;

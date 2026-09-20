import mongoose from 'mongoose'

const whatsappMessageSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      required: true
    },
    message: {
      type: String,
      default: ''
    },
    messageType: {
      type: String,
      enum: ['text', 'document', 'image'],
      default: 'text'
    },
    filePath: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['SENT', 'FAILED', 'PENDING'],
      required: true
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('WhatsAppMessage', whatsappMessageSchema)

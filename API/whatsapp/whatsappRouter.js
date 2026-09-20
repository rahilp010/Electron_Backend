import express from 'express'
import {
  handleInitialize,
  handleGetStatus,
  handleSendMessage,
  handleSendDocument,
  handleSendImage,
  handleCheckNumber,
  handleLogout,
  handleRestart,
  handleGetHistory,
  handleSaveTempPdfBuffer
} from './whatsappController.js'

const whatsappRouter = express.Router()

whatsappRouter.post('/initialize', handleInitialize)
whatsappRouter.get('/status', handleGetStatus)
whatsappRouter.post('/send-message', handleSendMessage)
whatsappRouter.post('/send-document', handleSendDocument)
whatsappRouter.post('/send-image', handleSendImage)
whatsappRouter.post('/check-number', handleCheckNumber)
whatsappRouter.post('/logout', handleLogout)
whatsappRouter.post('/restart', handleRestart)
whatsappRouter.get('/history', handleGetHistory)
whatsappRouter.get('/history/:clientId', handleGetHistory)
whatsappRouter.post('/save-temp-pdf', handleSaveTempPdfBuffer)

export default whatsappRouter

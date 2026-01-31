import express from 'express'
import { createClient, deleteClient, getAllClients, getClientById, updateClient } from './clientController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const clientRouter = express.Router()

clientRouter.get('/', authMiddleware, getAllClients)
clientRouter.get('/:id', authMiddleware, getClientById)
clientRouter.post('/', authMiddleware, createClient)
clientRouter.put('/:id', authMiddleware, updateClient)
clientRouter.delete('/:id', authMiddleware, deleteClient)

export default clientRouter;
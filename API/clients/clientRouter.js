import express from 'express'
import { createClient, deleteClient, getAllClients, getClientById, updateClient } from './clientController.js';

const clientRouter = express.Router()

clientRouter.get('/', getAllClients)
clientRouter.get('/:id', getClientById)
clientRouter.post('/', createClient)
clientRouter.put('/:id', updateClient)
clientRouter.delete('/:id', deleteClient)

export default clientRouter;
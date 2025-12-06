import mongoose from "mongoose";
import Client from "./clientSchema.js";

// ✅ Get all clients
const getAllClients = async (req, res, next) => {
    try {
        const clients = await Client.find().sort({ createdAt: 1 }); // ASC order by createdAt
        res.status(200).json(clients);
    } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({ error: "Failed to fetch clients" });
    }
};

// ✅ Get client by ID
const getClientById = async (req, res) => {
    try {

        console.log("req.params.id", req.params.id);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid client ID format" });
        }

        const client = await Client.findById(req.params.id);
        console.log("client", client);

        if (!client) return res.status(404).json({ error: "Client not found" });

        res.status(200).json(client);
    } catch (error) {
        console.error("❌ Error fetching client:", error);
        res.status(500).json({ error: "Failed to fetch client" });
    }
};

// ✅ Create new client
const createClient = async (req, res) => {
    try {
        const { clientName, phoneNo, gstNo, address, pendingAmount, paidAmount, pendingFromOurs, accountType, pageName, isEmployee, salary, salaryHistory } = req.body;
        const newClient = new Client({
            clientName,
            phoneNo,
            gstNo,
            address,
            pendingAmount,
            paidAmount,
            pendingFromOurs,
            accountType,
            pageName,
            isEmployee,
            salary,
            salaryHistory,
        });

        await newClient.save();

        res.status(201).json({ message: "Client inserted successfully", client: newClient });
        console.log("Client inserted successfully");
    } catch (error) {
        console.error("Error inserting client:", error);
        res.status(500).json({ error: "Failed to add client" });
    }
};

// ✅ Update client
const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { clientName, phoneNo, gstNo, address, pendingAmount, paidAmount, pendingFromOurs, accountType, pageName, isEmployee, salary, salaryHistory } = req.body;
        const updatedClient = await Client.findByIdAndUpdate(
            id,
            {
                clientName,
                phoneNo,
                gstNo,
                address,
                pendingAmount,
                paidAmount,
                pendingFromOurs,
                accountType,
                pageName,
                isEmployee,
                salary,
                salaryHistory,
            },
            { new: true, runValidators: true }
        );

        if (!updatedClient) {
            return res.status(404).json({ error: "Client not found" });
        }

        res.status(200).json({ message: "Client updated successfully", client: updatedClient });
    } catch (error) {
        console.error("❌ Error updating client:", error);
        res.status(500).json({ error: "Failed to update client" });
    }
};

// ✅ Delete client
const deleteClient = async (req, res) => {
    try {
        const deletedClient = await Client.findByIdAndDelete(req.params.id);

        if (!deletedClient) {
            return res.status(404).json({ error: "Client not found" });
        }

        res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({ error: "Failed to delete client" });
    }
};

export { createClient, getAllClients, getClientById, updateClient, deleteClient };

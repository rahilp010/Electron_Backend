import mongoose from "mongoose";
import Client from "./clientSchema.js";
import Account from "../bankAccounts/accounts/accountSchema.js";
import Ledger from "../bankAccounts/ledger/ledgerSchema.js";
import generateAccountNumber from "../utils/generateAccountNumber.js";
// import Ledger from "../bankAccounts/ladger/ladgerSchema.js";

// ✅ Get all clients
const getAllClients = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';

        /* 🔍 SEARCH QUERY */
        const query = {
            userId: req.userId,
            ...(search && {
                clientName: { $regex: search, $options: 'i' },
            }),
        };

        const [clients, total] = await Promise.all([
            Client.find(query)
                .sort({ createdAt: -1 }) // newest first = better UX in picker
                .skip(skip)
                .limit(limit)
                .lean(),

            Client.countDocuments(query),
        ]);

        res.status(200).json({
            clients,
            page,
            limit,
            total,
            hasMore: skip + clients.length < total,
        });
    } catch (error) {
        console.error('❌ Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
};


// ✅ Get client by ID
const getClientById = async (req, res) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid client ID format" });
        }

        const client = await Client.findById(req.params.id);

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
        const { clientName, phoneNo, gstNo, address, accountType, openingBalance = 0, pageName, isEmployee, salary, pendingAmount = 0, paidAmount = 0, pendingFromOurs = 0 } = req.body;

        const client = await Client.create({
            clientName,
            phoneNo,
            gstNo,
            address,
            accountType,
            pageName,
            isEmployee,
            salary,
            pendingAmount,
            paidAmount,
            pendingFromOurs,
            userId: req.userId,
        })

        const accountNumber = await generateAccountNumber();

        const account = await Account.create({
            clientId: client._id,
            userId: req.userId,
            accountName: client.clientName,
            openingBalance,
            currentBalance: openingBalance,
            accountNumber,
            accountType,
            isActive: true
        })

        await Ledger.create({
            userId: req.userId,
            accountId: account._id,
            clientId: client._id,
            entryType: openingBalance >= 0 ? 'debit' : 'credit',
            amount: Math.abs(openingBalance),
            balanceAfter: openingBalance,
            referenceType: 'Opening',
            narration: 'Opening Balance',
        });

        client.accountId = account._id;
        client.accountNumber = accountNumber
        await client.save()

        res.status(201).json({ message: "Client created successfully", client });
    } catch (error) {
        console.error("Error inserting client:", error);
        res.status(500).json({ error: "Failed to add client" });
    }
};

// ✅ Update client
const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { clientName, phoneNo, gstNo, address, accountType, pageName, isEmployee, salary, pendingAmount, paidAmount, pendingFromOurs } = req.body;

        const client = await Client.findById(id);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const account = await Account.findById(client.accountId);
        if (!account) {
            return res.status(404).json({ error: 'Linked account not found' });
        }

        client.clientName = clientName;
        client.phoneNo = phoneNo;
        client.gstNo = gstNo;
        client.address = address;
        client.accountType = accountType;
        client.isEmployee = isEmployee;
        client.salary = salary;
        client.pendingAmount = pendingAmount;
        client.paidAmount = paidAmount;
        client.pendingFromOurs = pendingFromOurs;

        account.accountName = clientName;
        account.accountType = accountType;

        await Promise.all([
            client.save(),
            account.save(),
        ]);

        res.status(200).json({ message: "Client updated successfully", client });
    } catch (error) {
        console.error("❌ Error updating client:", error);
        res.status(500).json({ error: "Failed to update client" });
    }
};

// ✅ Delete client
const deleteClient = async (req, res) => {
    try {
        const { id } = req.params;

        const client = await Client.findById(id);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const ledgerCount = await Ledger.countDocuments({
            accountId: client.accountId,
        });

        // if (ledgerCount > 1) {
        //     return res.status(400).json({
        //         error: 'Cannot delete client with ledger history',
        //     });
        // }

        await Ledger.deleteMany({ accountId: client.accountId });
        await Account.findByIdAndDelete(client.accountId);
        await Client.findByIdAndDelete(id);

        res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({ error: "Failed to delete client" });
    }
};

export { createClient, getAllClients, getClientById, updateClient, deleteClient };

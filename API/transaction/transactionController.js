import Transaction from "../transaction/transactionSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";

// ✅ Get all transactions
const getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate("clientId")
            .populate("productId")
            .sort({ createdAt: -1 });

        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
};

// ✅ Get transaction by ID
const getTransactionById = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate("clientId")
            .populate("productId");

        if (!transaction) return res.status(404).json({ error: "Transaction not found" });

        res.status(200).json(transaction);
    } catch (error) {
        console.error("Error fetching transaction:", error);
        res.status(500).json({ error: "Failed to fetch transaction" });
    }
};

// ✅ Create transaction
const createTransaction = async (req, res) => {
    try {
        const { clientId, productId, quantity, sellAmount, statusOfTransaction, paymentType, pendingAmount, paidAmount } = req.body;

        const product = await Product.findById(productId);
        const client = await Client.findById(clientId);

        if (!product || !client) {
            return res.status(404).json({ error: "Client or Product not found" });
        }

        // Reduce stock
        if (product.isStock < quantity) {
            return res.status(400).json({ error: "Insufficient stock" });
        }

        product.isStock -= quantity;

        const totalTransactionAmount = sellAmount * quantity;


        // Update client balance

        if (paymentType === 'partial') {
            client.pendingAmount += pendingAmount;
            client.paidAmount += paidAmount;
        } else if (statusOfTransaction === "completed") {
            client.paidAmount += totalTransactionAmount;
        } else {
            client.pendingAmount += totalTransactionAmount;
        }


        const transaction = new Transaction({
            clientId,
            productId,
            quantity,
            sellAmount,
            statusOfTransaction,
            paymentType,
            pendingAmount,
            paidAmount,
        });

        await transaction.save();
        await product.save();
        await client.save();

        res.status(201).json(transaction);
    } catch (error) {
        console.error("Error creating transaction:", error);
        res.status(500).json({ error: "Failed to create transaction" });
    }
};

// ✅ Update transaction
const updateTransaction = async (req, res) => {
    try {
        const { clientId, productId, quantity, sellAmount, statusOfTransaction, paymentType, pendingAmount, paidAmount } = req.body;
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) return res.status(404).json({ error: "Transaction not found" });

        const client = await Client.findById(clientId);
        const product = await Product.findById(productId);

        if (!client || !product) {
            return res.status(404).json({ error: "Client or Product not found" });
        }

        // Rollback previous values
        product.isStock += transaction.quantity;

        const previousTotalAmount = transaction.sellAmount * transaction.quantity;


        if (transaction.paymentType === 'partial') {
            client.pendingAmount -= transaction.pendingAmount;
            client.paidAmount -= transaction.paidAmount;
        } else if (transaction.statusOfTransaction === "completed") {
            client.paidAmount -= previousTotalAmount;
        } else {
            client.pendingAmount -= previousTotalAmount;
        }

        // Apply new values
        const newTotalAmount = sellAmount * quantity;

        transaction.clientId = clientId;
        transaction.productId = productId;
        transaction.quantity = quantity;
        transaction.sellAmount = sellAmount;
        transaction.statusOfTransaction = statusOfTransaction;
        transaction.paymentType = paymentType;
        transaction.pendingAmount = pendingAmount;
        transaction.paidAmount = paidAmount;

        product.isStock -= quantity;

        if (paymentType === 'partial') {
            client.pendingAmount += pendingAmount;
            client.paidAmount += paidAmount;
        } else if (statusOfTransaction === "completed") {
            client.paidAmount += newTotalAmount;
        } else {
            client.pendingAmount += newTotalAmount;
        }

        await transaction.save();
        await client.save();
        await product.save();

        res.status(200).json(transaction);
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).json({ error: "Failed to update transaction" });
    }
};

// ✅ Delete transaction
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        const client = await Client.findById(transaction.clientId);
        const product = await Product.findById(transaction.productId);

        if (product) {
            product.isStock += transaction.quantity;
            await product.save();
        }

        if (client) {
            if (transaction.paymentType === 'partial') {
                client.pendingAmount -= transaction.pendingAmount;
                client.paidAmount -= transaction.paidAmount;
            } else if (transaction.statusOfTransaction === "completed") {
                client.paidAmount -= transaction.sellAmount * transaction.quantity;
            } else {
                client.pendingAmount -= transaction.sellAmount * transaction.quantity;
            }
            await client.save();
        }

        await Transaction.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: "Transaction deleted successfully" });
    } catch (error) {
        console.error("Error deleting transaction:", error);
        res.status(500).json({ error: "Failed to delete transaction" });
    }
};

export {
    createTransaction,
    getAllTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
};

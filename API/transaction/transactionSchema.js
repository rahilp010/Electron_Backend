import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        sellAmount: { type: Number, required: true },
        statusOfTransaction: { type: String, enum: ['completed', 'pending'], default: 'pending' },
    },
    { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;

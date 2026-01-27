import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        clientId: {
            type: mongoose.Schema.Types.ObjectId, ref: "Client", unique: true,
            sparse: true,
        },
        accountName: { type: String, required: true },
        accountType: { type: String, enum: ['Creditor', 'Debtor', 'Bank', 'Cash'] },
        openingBalance: { type: Number, default: 0 },
        currentBalance: { type: Number, default: 0 },
        bankName: { type: String, index: true },
        accountNumber: { type: String },
        isActive: { type: Boolean, default: true, },
    },
    { timestamps: true }
)


accountSchema.index({ createdAt: -1 });
accountSchema.index({ clientId: 1 });

const Account = mongoose.model("Account", accountSchema);
export default Account;

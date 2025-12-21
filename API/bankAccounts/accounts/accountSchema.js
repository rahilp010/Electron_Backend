import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
    {
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
        accountName: { type: String, required: true },
        accountType: { type: Number, required: true },
        openingBalance: { type: Number, default: 0 },
        currentBalance: { type: String, index: true },
        bankName: { type: String, index: true },
        accountNumber: { type: String },
        isActive: { type: Boolean },
        ladgerHistory: { type: Array }
    },
    { timestamps: true }
)
accountSchema.index({ accountName: "text" });
accountSchema.index({ createdAt: -1 });
accountSchema.index({ clientId: 1, createdAt: -1 });

const Account = mongoose.model("Account", accountSchema);
export default Account;

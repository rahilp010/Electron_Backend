import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        clientName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        phoneNo: { type: String },
        gstNo: {
            type: String,
            uppercase: true,
            index: true,
        },
        address: {
            type: String,
            trim: true,
        },
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true,
        },
        accountType: {
            type: String,
            enum: ['Creditor', 'Debtor'],
            required: true,
            default: 'Debtor',
            index: true,
        },
        pageName: { type: String, default: 'Client' },
        isEmployee: { type: Number, default: 0 },
        salary: { type: Number, default: 0 },
    },
    { timestamps: true }
);

clientSchema.index({ clientName: 1 });
clientSchema.index({ phoneNo: 1 });
clientSchema.index({ accountId: 1 });

const Client = mongoose.model("Client", clientSchema);
export default Client;

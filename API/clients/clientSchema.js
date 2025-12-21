import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        clientName: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
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
            required: false,
            index: true,
        },
        accountNumber: {
            type: String,
            required: false,
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


const Client = mongoose.model("Client", clientSchema);
export default Client;

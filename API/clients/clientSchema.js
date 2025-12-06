import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        clientName: { type: String, required: true },
        phoneNo: { type: Number },
        gstNo: { type: String },
        address: { type: String },
        pendingAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        pendingFromOurs: { type: Number, default: 0 },
        accountType: { type: String, default: 'Debtors' },
        pageName: { type: String, default: 'Client' },
        isEmployee: { type: Number, default: 0 },
        salary: { type: Number, default: 0 },
        salaryHistory: { type: Array, default: [] },
    },
    { timestamps: true }
);

const Client = mongoose.model("Client", clientSchema);
export default Client;

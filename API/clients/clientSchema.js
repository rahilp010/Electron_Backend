import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
    {
        // _id: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
        clientName: { type: String, required: true },
        phoneNo: { type: Number, required: true },
        pendingAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        pendingFromOurs: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Client = mongoose.model("Client", clientSchema);
export default Client;

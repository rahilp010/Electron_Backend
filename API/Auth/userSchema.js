import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ['Owner', 'User'],
            default: 'User',
        },
        phone: { type: String, default: "" },
        avatar: { type: String, default: null },
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);

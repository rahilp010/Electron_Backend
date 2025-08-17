import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        // _id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        isStock: { type: Number, default: 0 },
        image: { type: String },
    },
    { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;

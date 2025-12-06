import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        productName: { type: String, required: true },
        productPrice: { type: Number, required: true },
        productQuantity: { type: Number, default: 0 },
        clientName: { type: String },
        assetType: { type: String },
        saleHSN: { type: String },
        purchaseHSN: { type: String },
        taxRate: { type: Number },
        taxAmount: { type: Number },
        totalAmountWithTax: { type: Number },
        totalAmountWithoutTax: { type: Number },
        addParts: { type: Array },
    },
    { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;

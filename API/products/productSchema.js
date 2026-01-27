import mongoose from "mongoose";

const partSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },

        qtyPerMachine: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: false },
);

const productSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        productName: { type: String, required: true, index: true },
        productPrice: { type: Number, required: true },
        productQuantity: { type: Number, default: 0 },
        productType: {
            type: String,
            enum: ['PRODUCT', 'MACHINE'],
            default: 'PRODUCT',
        },
        parts: [partSchema],
        clientName: { type: String, index: true },
        assetType: { type: String, index: true },
        saleHSN: { type: String },
        purchaseHSN: { type: String },
        taxRate: { type: Number },
        taxAmount: { type: Number },
        totalAmountWithTax: { type: Number },
        totalAmountWithoutTax: { type: Number },
        addParts: { type: Array },
    },
    { timestamps: true }
)
productSchema.index({ productName: "text" });
productSchema.index({ createdAt: -1 });
productSchema.index({ assetType: 1, clientName: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;

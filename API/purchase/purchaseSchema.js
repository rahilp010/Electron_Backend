import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        date: { type: Date },
        quantity: { type: Number, min: 1 },
        purchaseAmount: { type: Number, min: 0 },
        multipleProducts: { type: Array },
        isMultiProduct: { type: Boolean, default: false },
        paymentMethod: {
            type: String,
            enum: ['Cash', 'Bank'],
            default: 'Bank'
        },
        statusOfTransaction: {
            type: String,
            enum: ['completed', 'pending', 'partial'],
            default: 'pending'
        },
        paymentType: {
            type: String,
            enum: ['full', 'partial'],
            default: 'full'
        },
        pendingAmount: { type: Number, default: 0, min: 0 },
        paidAmount: { type: Number, default: 0, min: 0 },
        pendingFromOurs: { type: Number, default: 0, min: 0 },
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number },
        freightCharges: { type: Number },
        freightTaxAmount: { type: Number },
        totalAmountWithTax: { type: Number },
        totalAmountWithoutTax: { type: Number },
        billNo: { type: String },
        methodType: {
            type: String,
            enum: ['Receipt', 'Payment', 'Salary'],
            default: 'Payment'
        },
        dueDate: { type: Date },
        description: { type: String },
        pageName: { type: String, default: 'Purchase' },
    },
    { timestamps: true }
);

purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ clientId: 1, createdAt: -1 });
purchaseSchema.index({ productId: 1 });
purchaseSchema.index({ statusOfTransaction: 1 });
purchaseSchema.index({ paymentType: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;
import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
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
        saleAmount: { type: Number, min: 0 },
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
        pageName: { type: String, default: 'Sales' },
    },
    { timestamps: true }
);

saleSchema.index({ clientId: 1, statusOfTransaction: 1 });
saleSchema.index({ productId: 1, createdAt: -1 });

const Sales = mongoose.model("Sales", saleSchema);
export default Sales;
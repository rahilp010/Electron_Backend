import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
        },

        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },

        date: {
            type: Date,
            required: true,
            default: Date.now,
        },

        entryType: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        balanceAfter: {
            type: Number,
            required: true,
        },

        referenceType: {
            type: String,
            enum: ['Opening', 'Purchase', 'Sales', 'Payment', 'Adjustment', 'Transfer'],
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
        },

        narration: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

ledgerSchema.index({ accountId: 1, createdAt: -1 });
ledgerSchema.index({ accountId: 1, referenceType: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);
export default Ledger;

import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true,
        },

        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },

        date: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },

        entryType: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
            index: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        balanceAfter: {
            type: Number,
            required: true,
            index: true,
        },

        referenceType: {
            type: String,
            enum: ['Opening', 'Purchase', 'Sales', 'Payment', 'Adjustment', 'Transfer'],
            index: true,
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            index: true,
        },

        narration: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

ledgerSchema.index({ accountId: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);
export default Ledger;

import mongoose from 'mongoose';
import Account from './accountSchema.js';
import Ledger from '../ladger/ladgerSchema.js';

/* ================= GET ALL ACCOUNTS ================= */
const getAllAccounts = async (req, res) => {
    try {
        const accounts = await Account.find()
            .populate('clientId', 'clientName accountType')
            .sort({ createdAt: -1 });

        res.status(200).json(accounts);
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

/* ================= GET ACCOUNT BY ID ================= */
const getAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid account ID' });
        }

        const account = await Account.findById(id).populate(
            'clientId',
            'clientName phoneNo'
        );

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.status(200).json(account);
    } catch (error) {
        console.error('❌ Error fetching account:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
};

/* ================= UPDATE ACCOUNT (NON-FINANCIAL) ================= */
const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber, isActive } = req.body;

        const account = await Account.findById(id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        account.bankName = bankName ?? account.bankName;
        account.accountNumber = accountNumber ?? account.accountNumber;
        account.isActive = isActive ?? account.isActive;

        await account.save();

        res.status(200).json({
            message: 'Account updated successfully',
            account,
        });
    } catch (error) {
        console.error('❌ Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
};

/* ================= DELETE ACCOUNT (SAFE) ================= */
const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const account = await Account.findById(id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const ledgerCount = await Ledger.countDocuments({ accountId: id });

        // Opening entry counts as 1
        if (ledgerCount > 1) {
            return res.status(400).json({
                error: 'Cannot delete account with ledger history',
            });
        }

        await Ledger.deleteMany({ accountId: id });
        await Account.findByIdAndDelete(id);

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

export {
    getAllAccounts,
    getAccountById,
    updateAccount,
    deleteAccount,
};

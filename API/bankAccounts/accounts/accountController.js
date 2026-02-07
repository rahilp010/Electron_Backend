import mongoose from 'mongoose';
import Account from './accountSchema.js';
import Ledger from '../ledger/ledgerSchema.js';

const getAllAccounts = async (req, res) => {
    try {
        const accounts = await Account.find(
            { userId: req.userId },
            {
                accountName: 1,
                accountNumber: 1,
                bankName: 1,
                currentBalance: 1,
                isActive: 1,
                clientId: 1,
                createdAt: 1,
                openingBalance: 1,
            }
        )
            .populate({
                path: 'clientId',
                select: 'clientName accountType',
                options: { lean: true },
            })
            .sort({ createdAt: -1 })
            .lean(); // 🔥 huge performance boost

        res.status(200).json(accounts);
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};


const getAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid account ID' });
        }

        const account = await Account.findOne({
            _id: id,
            userId: req.userId,
        }).populate({
            path: 'clientId',
            select: 'clientName phoneNo',
            options: { lean: true },
        }).lean();

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.status(200).json(account);
    } catch (error) {
        console.error('❌ Error fetching account:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
};


const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber, isActive } = req.body;

        const account = await Account.findOne({
            _id: id,
            userId: req.userId,
        }).lean();

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const isSystemAccount =
            account.accountType === 'Bank' || account.accountType === 'Cash';

        const update = {};

        /* ================= SYSTEM ACCOUNTS ================= */
        if (isSystemAccount) {
            // ✅ Allow bank name update only for Bank
            if (account.accountType === 'Bank' && bankName !== undefined) {
                update.bankName = bankName;
            }

            // ⚠️ Optional: allow account number update
            if (accountNumber !== undefined) {
                update.accountNumber = accountNumber;
            }

            // ❌ Never allow disabling system accounts
            if (isActive === false) {
                return res.status(400).json({
                    error: 'Bank/Cash account cannot be deactivated',
                });
            }
        }

        /* ================= CLIENT ACCOUNTS ================= */
        if (!isSystemAccount) {
            if (isActive !== undefined) {
                update.isActive = isActive;
            }
        }

        // ❌ Guardrail
        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const updatedAccount = await Account.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true, lean: true }
        );

        res.status(200).json({
            message: 'Account updated successfully',
            account: updatedAccount,
        });

    } catch (error) {
        console.error('❌ Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
};



const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const account = await Account.findOne({
            _id: id,
            userId: req.userId,
        }).lean();

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const ledgerEntries = await Ledger.find(
            { accountId: id },
            { _id: 1 }
        ).limit(2); // 🔥 very fast

        if (ledgerEntries.length > 1) {
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

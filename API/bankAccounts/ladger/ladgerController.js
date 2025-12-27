import mongoose from 'mongoose';
import Ledger from './ladgerSchema.js';
import Account from '../accounts/accountSchema.js';

/* ================= GET LEDGER BY ACCOUNT ================= */
const getLedgerByAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const ledger = await Ledger.find({ accountId })
      .sort({ date: 1, createdAt: 1 });

    res.status(200).json(ledger);
  } catch (error) {
    console.error('❌ Error fetching ledger:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
};

export const getClientLedger = async (req, res) => {
  try {
    const { clientId } = req.params;

    const ledger = await Ledger.find({ clientId })
      .sort({ date: 1, createdAt: 1 });

    res.status(200).json(ledger);
  } catch (error) {
    console.error('❌ Error fetching ledger:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
};


/* ================= ADD LEDGER ENTRY ================= */
const addLedgerEntry = async (req, res) => {
  try {
    const {
      accountId,
      clientId,
      entryType, // debit | credit
      amount,
      referenceType,
      referenceId,
      narration,
    } = req.body;

    if (!['debit', 'credit'].includes(entryType)) {
      return res.status(400).json({ error: 'Invalid entry type' });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    /* 🔢 CALCULATE BALANCE */
    const newBalance =
      entryType === 'debit'
        ? account.currentBalance + amount
        : account.currentBalance - amount;

    console.log("newBalance", newBalance);


    /* 🧾 CREATE LEDGER ENTRY */
    const ledger = await Ledger.create({
      accountId,
      clientId,
      entryType,
      amount,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      narration,
    });

    /* 🔄 UPDATE ACCOUNT BALANCE */
    account.currentBalance = newBalance;
    await account.save();

    res.status(201).json({
      message: 'Ledger entry added successfully',
      ledger,
    });
  } catch (error) {
    console.error('❌ Error adding ledger entry:', error);
    res.status(500).json({ error: 'Failed to add ledger entry' });
  }
};

/* ================= DELETE LEDGER ENTRY (SAFE) ================= */
const deleteLedgerEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await Ledger.findById(id);
    if (!entry) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }

    const account = await Account.findById(entry.accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    /* 🚫 DO NOT ALLOW DELETING OPENING ENTRY */
    if (entry.referenceType === 'Opening') {
      return res.status(400).json({
        error: 'Opening balance entry cannot be deleted',
      });
    }

    /* 🔁 REVERSE BALANCE */
    account.currentBalance =
      entry.entryType === 'debit'
        ? account.currentBalance - entry.amount
        : account.currentBalance + entry.amount;

    await account.save();
    await Ledger.findByIdAndDelete(id);

    res.status(200).json({ message: 'Ledger entry deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting ledger entry:', error);
    res.status(500).json({ error: 'Failed to delete ledger entry' });
  }
};

export {
  getLedgerByAccount,
  addLedgerEntry,
  deleteLedgerEntry,
};

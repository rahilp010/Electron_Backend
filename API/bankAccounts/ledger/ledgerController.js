import mongoose from 'mongoose';
import Ledger from './ledgerSchema.js';
import Account from '../accounts/accountSchema.js';

/* ================= GET LEDGER BY ACCOUNT ================= */
const getLedgerByAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const ledger = await Ledger.find({
      accountId,
      userId: req.userId,
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

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

    const account = await Account.findOne({
      _id: accountId,
      userId: req.userId,
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    /* 🔢 CALCULATE BALANCE */
    const newBalance =
      entryType === 'debit'
        ? account.currentBalance + amount
        : account.currentBalance - amount;


    /* 🧾 CREATE LEDGER ENTRY */
    const ledger = await Ledger.create({
      userId: req.userId,
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

const getTransferHistory = async (req, res) => {
  try {
    const { accountId } = req.query;

    const filter = {
      userId: req.userId,
      referenceType: 'Transfer',
    };

    // OPTIONAL: filter by account if provided
    if (accountId) {
      filter.accountId = accountId;
    }

    const history = await Ledger.find(filter)
      .populate('accountId', 'accountName')
      .populate('clientId', 'clientName')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    res.status(200).json(history);
  } catch (error) {
    console.error('❌ Error fetching transfer history:', error);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
};

const getClientLedger = async (req, res) => {
  try {
    const { clientId } = req.params;

    const ledger = await Ledger.find({
      clientId,
      userId: req.userId,
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    res.status(200).json(ledger);
  } catch (error) {
    console.error('❌ Error fetching ledger:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
};

/* ================= DELETE LEDGER ENTRY (SAFE) ================= */
const deleteLedgerEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await Ledger.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }

    const account = await Account.findOne({
      _id: entry.accountId,
      userId: req.userId,
    });

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


const deleteMultipleLedgerEntries = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    /* 1️⃣ Fetch ledger entries */
    const entries = await Ledger.find({
      _id: { $in: ids },
      userId: req.userId,
    }).session(session);
    if (!entries.length) {
      return res.status(404).json({ error: 'No ledger entries found' });
    }

    /* 2️⃣ Group entries by account */
    const accountMap = {};

    for (const entry of entries) {
      const accId = entry.accountId.toString();
      if (!accountMap[accId]) {
        accountMap[accId] = [];
      }
      accountMap[accId].push(entry);
    }

    /* 3️⃣ Reverse balances PER ACCOUNT */
    for (const [accountId, accEntries] of Object.entries(accountMap)) {
      const account = await Account.findById(accountId).session(session);
      if (!account) continue;

      let balance = account.currentBalance;

      for (const entry of accEntries) {
        if (entry.entryType === 'debit') {
          balance -= entry.amount;
        } else {
          balance += entry.amount;
        }
      }

      account.currentBalance = balance;
      await account.save({ session });
    }

    /* 4️⃣ Delete ledger entries */
    await Ledger.deleteMany({ _id: { $in: ids } }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'Multiple ledger entries deleted successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('❌ Ledger bulk delete error:', error);
    res.status(500).json({ error: 'Failed to delete ledger entries' });
  }
};


export {
  getLedgerByAccount,
  addLedgerEntry,
  deleteLedgerEntry,
  deleteMultipleLedgerEntries,
  getTransferHistory,
  getClientLedger
};

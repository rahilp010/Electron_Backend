import mongoose from 'mongoose';
import Account from '../accounts/accountSchema.js';
import Ledger from '../ledger/ledgerSchema.js';

export const transferAmount = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromAccountId,
      toAccountId,
      amount,
      narration = 'Account Transfer',
    } = req.body;

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid transfer data' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Same account transfer not allowed' });
    }

    const fromAccount = await Account.findById(fromAccountId).session(session);
    const toAccount = await Account.findById(toAccountId).session(session);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (fromAccount.currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    /* 🔴 DEBIT FROM */
    fromAccount.currentBalance -= amount;

    await Ledger.create(
      [{
        accountId: fromAccount._id,
        clientId: fromAccount.clientId,
        entryType: 'debit',
        amount,
        balanceAfter: fromAccount.currentBalance,
        referenceType: 'Transfer',
        narration: `To ${toAccount.accountName}`,
      }],
      { session }
    );

    /* 🟢 CREDIT TO */
    toAccount.currentBalance += amount;

    await Ledger.create(
      [{
        accountId: toAccount._id,
        clientId: toAccount.clientId,
        entryType: 'credit',
        amount,
        balanceAfter: toAccount.currentBalance,
        referenceType: 'Transfer',
        narration: `From ${fromAccount.accountName}`,
      }],
      { session }
    );

    await fromAccount.save({ session });
    await toAccount.save({ session });

    await session.commitTransaction();

    res.status(200).json({ message: 'Transfer successful' });
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Transfer failed:', error);
    res.status(500).json({ error: 'Transfer failed' });
  } finally {
    session.endSession();
  }
};

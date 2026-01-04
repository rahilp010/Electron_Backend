import Account from "../bankAccounts/accounts/accountSchema.js";
import Ledger from "../bankAccounts/ladger/ladgerSchema.js";


const addClientLedgerEntry = async ({
    clientId,
    accountId,
    amount,
    entryType,       // 'debit' | 'credit'
    referenceType,   // 'Purchase' | 'Sale'
    referenceId,
    narration,
}) => {
    const account = await Account.findById(accountId);
    console.log("account", account);

    if (!account) throw new Error('Account not found');

    let newBalance = account.currentBalance;

    if (entryType === 'debit') {
        newBalance -= amount;
    } else {
        newBalance += amount;
    }

    await Ledger.create({
        clientId,
        accountId,
        entryType,
        amount,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        narration,
    });

    console.log("New Balance After", newBalance);

    account.currentBalance = newBalance;
    await account.save();
};

export default addClientLedgerEntry;

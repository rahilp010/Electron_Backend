import Client from "../clients/clientSchema.js";
import Account from "../bankAccounts/accounts/accountSchema.js";
import Ledger from "../bankAccounts/ledger/ledgerSchema.js";
import generateAccountNumber from "./generateAccountNumber.js";

export const createSystemClients = async (userId) => {
    const systems = [
        { name: "CASH", type: "Cash" },
        { name: "BANK", type: "Bank" },
    ];

    const results = {};

    for (const sys of systems) {
        // 0️⃣ Check if already exists to avoid duplicates
        let client = await Client.findOne({ userId, clientName: `${sys.name} ACCOUNT`, isSystem: true });
        let account;

        if (client) {
            account = await Account.findOne({ clientId: client._id });
        } else {
            // 1️⃣ Create Client
            client = await Client.create({
                clientName: `${sys.name} ACCOUNT`,
                accountType: sys.type,
                userId,
                isSystem: true,
            });
        }

        // 2️⃣ Create Account if missing
        const accountNumber = client.accountNumber || await generateAccountNumber();

        if (!account) {
            account = await Account.create({
                userId,
                clientId: client._id,
                accountName: `${sys.name} ACCOUNT`,
                accountType: sys.type,
                openingBalance: 0,
                currentBalance: 0,
                accountNumber,
                isActive: true,
            });
        }

        // 3️⃣ Opening Ledger (only if none exists)
        const existingLedger = await Ledger.findOne({ accountId: account._id, referenceType: "Opening" });
        if (!existingLedger) {
            await Ledger.create({
                userId,
                accountId: account._id,
                clientId: client._id,
                entryType: "debit",
                amount: 0,
                balanceAfter: 0,
                referenceType: "Opening",
                narration: `Opening ${sys.type} Balance`,
            });
        }

        // 4️⃣ Link back
        if (!client.accountId || !client.accountNumber) {
            client.accountId = account._id;
            client.accountNumber = accountNumber;
            await client.save();
        }

        results[sys.type] = {
            clientId: client._id,
            accountId: account._id,
        };
    }

    return results;
};

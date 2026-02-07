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
        // 1️⃣ Create Client
        const client = await Client.create({
            clientName: `${sys.name} ACCOUNT`,
            accountType: sys.type,
            userId,
            isSystem: true,
        });

        // 2️⃣ Create Account
        const accountNumber = await generateAccountNumber();

        const account = await Account.create({
            userId,
            clientId: client._id,
            accountName: `${sys.name} ACCOUNT`,
            accountType: sys.type,
            openingBalance: 0,
            currentBalance: 0,
            accountNumber,
            isActive: true,
        });

        // 3️⃣ Opening Ledger
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

        // 4️⃣ Link back
        client.accountId = account._id;
        client.accountNumber = accountNumber;
        await client.save();

        results[sys.type] = {
            clientId: client._id,
            accountId: account._id,
        };
    }

    return results;
};

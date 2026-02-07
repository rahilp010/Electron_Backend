import Account from "../bankAccounts/accounts/accountSchema.js";
import Client from "../clients/clientSchema.js";

export const getSystemAccount = async (userId, type) => {
    const account = await Account.findOne({
        userId,
        accountType: type,
        isActive: true,
    }).lean();

    if (!account) {
        throw new Error(`${type} account not found for user`);
    }

    return account;
};


export const getSystemClient = async (userId, type) => {

    const client = await Client.findOne({
        userId,
        accountType: type,
    }).lean();

    if (!client) {
        throw new Error(`${type} client not found`);
    }

    if (!client.accountId) {
        throw new Error(`${type} system client has no linked account`);
    }

    return client;
};

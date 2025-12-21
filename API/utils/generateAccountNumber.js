import Counter from "./counterSchema.js";

const generateAccountNumber = async () => {
    const counter = await Counter.findOneAndUpdate(
        { key: 'ACCOUNT_NO' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return `AC${counter.seq}`;
    // Example: AC100001
};

export default generateAccountNumber;

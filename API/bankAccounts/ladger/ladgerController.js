// import mongoose from "mongoose";
// import Account from "./ladgerSchema.js";

// const getAllAccounts = async (req, res) => {
//     try {
//         const accounts = await Account.find().sort({ createdAt: -1 });
//         res.status(200).json(accounts);
//     } catch (error) {
//         console.error("❌ Error fetching accounts:", error);
//         res.status(500).json({ error: "Failed to fetch accounts" });
//     }
// }


// const createAccount = async (req, res) => {
//     try {
//         const { accountName, accountType, openingBalance, currentBalance, bankName, accountNumber, isActive, ladgerHistory } = req.body;

//         const newAccount = new Account({ accountName, accountType, openingBalance, currentBalance, bankName, accountNumber, isActive, ladgerHistory });
//         await newAccount.save();

//         res.status(201).json({ message: "Product inserted successfully", account: newAccount });
//         console.log("✅ Product inserted successfully");
//     } catch (error) {
//         console.error("❌ Error inserting product:", error);
//         res.status(500).json({ error: "Failed to add product" });
//     }
// }

// const updateProduct = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { productName, productPrice, productQuantity, clientName, assetType, saleHSN, purchaseHSN, taxRate, taxAmount, totalAmountWithTax, totalAmountWithoutTax, addParts } = req.body;

//         const updatedProduct = await Product.findByIdAndUpdate(
//             id,
//             { productName, productPrice, productQuantity, clientName, assetType, saleHSN, purchaseHSN, taxRate, taxAmount, totalAmountWithTax, totalAmountWithoutTax, addParts },
//             { new: true } // return updated doc
//         );

//         if (!updatedProduct) {
//             return res.status(404).json({ error: "Product not found" });
//         }

//         res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
//     } catch (error) {
//         console.error("❌ Error updating product:", error);
//         res.status(500).json({ error: "Failed to update product" });
//     }
// };


// const deleteProduct = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const deletedProduct = await Product.findByIdAndDelete(id);

//         if (!deletedProduct) {
//             return res.status(404).json({ error: "Product not found" });
//         }

//         res.status(200).json({ message: "Product deleted successfully" });
//         console.log("🗑️ Product deleted successfully");
//     } catch (error) {
//         console.error("❌ Error deleting product:", error);
//         res.status(500).json({ error: "Failed to delete product" });
//     }
// };


// export { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct };

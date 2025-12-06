import mongoose from "mongoose";
import Purchase from "./purchaseSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";

/* ========================= GET ALL ========================= */
export const getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate("clientId")
      .populate("productId")
      .sort({ createdAt: -1 });

    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
};

/* ========================= GET BY ID ========================= */
export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate("clientId")
      .populate("productId");

    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    res.status(200).json(purchase);
  } catch {
    res.status(500).json({ error: "Failed to fetch purchase" });
  }
};

/* ========================= CREATE ========================= */
export const createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      clientId,
      productId,
      quantity,
      sellAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount = 0,
      paidAmount = 0,
      taxRate = 0,
      taxAmount = 0,
      freightCharges = 0,
      freightTaxAmount = 0,
      totalAmountWithTax,
      totalAmountWithoutTax,
      paymentMethod,
      date,
    } = req.body;

    if (!clientId || !productId || !quantity || !sellAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await Product.findById(productId).session(session);
    const client = await Client.findById(clientId).session(session);

    if (!product || !client)
      return res.status(404).json({ error: "Client or Product not found" });

    if (product.isStock < quantity)
      return res.status(400).json({ error: "Insufficient stock" });

    /* ✅ Stock Update */
    product.isStock -= quantity;

    const totalAmount = sellAmount * quantity;

    /* ✅ Client Balance Update */
    if (paymentType === "partial") {
      client.pendingAmount += pendingAmount;
      client.paidAmount += paidAmount;
    } else if (statusOfTransaction === "completed") {
      client.paidAmount += totalAmount;
    } else {
      client.pendingAmount += totalAmount;
    }

    const purchase = new Purchase({
      clientId,
      productId,
      quantity,
      sellAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
      taxRate,
      taxAmount,
      freightCharges,
      freightTaxAmount,
      totalAmountWithTax,
      totalAmountWithoutTax,
      paymentMethod,
      date,
    });

    await purchase.save({ session });
    await product.save({ session });
    await client.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: "Failed to create purchase" });
  }
};

/* ========================= UPDATE ========================= */
export const updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      clientId,
      productId,
      quantity,
      sellAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount = 0,
      paidAmount = 0,
    } = req.body;

    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    const client = await Client.findById(clientId).session(session);
    const product = await Product.findById(productId).session(session);

    if (!client || !product)
      return res.status(404).json({ error: "Client or Product not found" });

    /* ✅ Rollback OLD stock */
    product.isStock += purchase.quantity;

    const oldTotal = purchase.sellAmount * purchase.quantity;

    if (purchase.paymentType === "partial") {
      client.pendingAmount -= purchase.pendingAmount;
      client.paidAmount -= purchase.paidAmount;
    } else if (purchase.statusOfTransaction === "completed") {
      client.paidAmount -= oldTotal;
    } else {
      client.pendingAmount -= oldTotal;
    }

    if (product.isStock < quantity)
      return res.status(400).json({ error: "Insufficient stock after update" });

    /* ✅ Apply NEW */
    const newTotal = sellAmount * quantity;

    product.isStock -= quantity;

    if (paymentType === "partial") {
      client.pendingAmount += pendingAmount;
      client.paidAmount += paidAmount;
    } else if (statusOfTransaction === "completed") {
      client.paidAmount += newTotal;
    } else {
      client.pendingAmount += newTotal;
    }

    Object.assign(purchase, {
      clientId,
      productId,
      quantity,
      sellAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
    });

    await purchase.save({ session });
    await product.save({ session });
    await client.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: "Failed to update purchase" });
  }
};

/* ========================= DELETE ========================= */
export const deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(req.params.id).session(session);

    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    const client = await Client.findById(purchase.clientId).session(session);
    const product = await Product.findById(purchase.productId).session(session);

    if (product) {
      product.isStock += purchase.quantity;
      await product.save({ session });
    }

    if (client) {
      const amount = purchase.sellAmount * purchase.quantity;

      if (purchase.paymentType === "partial") {
        client.pendingAmount -= purchase.pendingAmount;
        client.paidAmount -= purchase.paidAmount;
      } else if (purchase.statusOfTransaction === "completed") {
        client.paidAmount -= amount;
      } else {
        client.pendingAmount -= amount;
      }

      await client.save({ session });
    }

    await Purchase.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: "Failed to delete purchase" });
  }
};

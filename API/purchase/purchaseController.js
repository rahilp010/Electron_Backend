import Purchase from "./purchaseSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";
import mongoose from "mongoose";
import { config } from '../../config/config.js';
import { updateClientBalances } from "../utils/updateClientBalances.js";
import { calculateTotals } from "../utils/calculateTotals.js";


/* ========================= GET ALL ========================= */
export const getAllPurchases = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const purchases = await Purchase.find({})
      .populate("clientId", "clientName")
      .populate("productId", "productName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.status(200).json(purchases);
  } catch (error) {
    console.error("❌ Error fetching purchase:", error);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
};

/* ========================= GET BY ID ========================= */
export const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid purchase ID" });
    }

    const purchase = await Purchase.findById(id)
      .populate("clientId", "clientName")
      .populate("productId", "productName")
      .lean()

    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    res.status(200).json(purchase);
  } catch (error) {
    console.error("❌ Error fetching purchase:", error);
    res.status(500).json({ error: "Failed to fetch purchase" });
  }
};

/* ========================= CREATE ========================= */
export const createPurchase = async (req, res) => {
  try {
    const {
      clientId,
      productId,
      quantity,
      purchaseAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount = 0,
      paidAmount = 0,
      pendingFromOurs = 0,
      taxRate = 0,
      freightCharges = 0,
      freightTaxAmount = 0,
      paymentMethod,
      methodType,
      billNo,
      dueDate,
      description,
      date,
    } = req.body;

    if (!clientId || !productId || !quantity || !purchaseAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const qty = Number(quantity);
    const price = Number(purchaseAmount);

    if (qty <= 0 || price <= 0) {
      return res.status(400).json({ error: "Invalid quantity or price" });
    }

    const { subtotal, taxAmount, grandTotal } = calculateTotals(req.body)

    const [client, product] = await Promise.all([
      Client.findById(clientId).lean(),
      Product.findById(productId).lean(),
    ]);

    if (!client || !product) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    /* ================= PRODUCT UPDATE ================= */
    await Product.updateOne(
      { _id: productId },
      {
        $inc: {
          productQuantity: qty,
          totalAmountWithoutTax: subtotal,
          taxAmount: taxAmount,
          totalAmountWithTax: grandTotal,
        },
      }
    );

    const purchase = await Purchase.create({
      ...req.body,
      quantity: qty,
      purchaseAmount: price,
      taxAmount,
      totalAmountWithoutTax: subtotal,
      totalAmountWithTax: grandTotal,
      transactionType: 'Payment',
      pageName: 'Purchase',
    })

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate("clientId")
      .populate("productId")

    await updateClientBalances(clientId, purchase, 'apply')

    res.status(201).json(populatedPurchase)

    /* LEDGER */
    await addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: 'credit',
      referenceType: 'Purchase',
      referenceId: purchase._id,
      narration: `Purchase ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

    const systemAccountId =
      paymentMethod === "Cash"
        ? config.cashAccountId  // Cash Account ID
        : config.bankAccountId; // Bank Account ID

    const systemClientId = paymentMethod === "Cash"
      ? config.cashClientId // Cash Client ID
      : config.bankClientId; // Bank Client ID

    await addClientLedgerEntry({
      clientId: systemClientId,
      accountId: systemAccountId,
      amount: grandTotal,
      entryType: "debit",
      referenceType: "Purchase",
      referenceId: purchase._id,
      narration: `Purchase ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

  } catch (error) {
    console.error("❌ Error creating purchase:", error);
    res.status(500).json({ error: "Failed to create purchase" });
  }
};

/* ========================= UPDATE ========================= */
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clientId,
      productId,
      quantity,
      purchaseAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount = 0,
      paidAmount = 0,
      taxRate = 0,
      freightCharges = 0,
      freightTaxAmount = 0,
      billNo,
      date,
      dueDate,
      description,
      paymentMethod
    } = req.body;

    const oldPurchase = await Purchase.findById(id);
    if (!oldPurchase)
      return res.status(404).json({ error: "Purchase not found" });

    /* ================= TOTALS ================= */
    const oldGrandTotal = oldPurchase.totalAmountWithTax

    const {
      subtotal,
      taxAmount,
      grandTotal: newGrandTotal,
    } = calculateTotals(req.body)

    /* ================= CLIENT ================= */
    const client = await Client.findById(oldPurchase.clientId)
    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    /* ================= PRODUCT ROLLBACK ================= */
    await Product.updateOne(
      { _id: oldPurchase.productId },
      {
        $inc: {
          productQuantity: oldPurchase.quantity,
          totalAmountWithoutTax: oldPurchase.totalAmountWithoutTax,
          taxAmount: oldPurchase.taxAmount,
          totalAmountWithTax: oldPurchase.totalAmountWithTax,
        },
      }
    )

    /* ================= CLIENT ROLLBACK ================= */
    await updateClientBalances(oldPurchase.clientId, oldPurchase, 'rollback')

    /* ================= UPDATE SALE ================= */
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id,
      {
        ...req.body,
        quantity: Number(req.body.quantity),
        saleAmount: Number(req.body.saleAmount),
        taxAmount,
        totalAmountWithoutTax: subtotal,
        totalAmountWithTax: newGrandTotal,
      },
      { new: true }
    )

    /* ================= PRODUCT APPLY ================= */
    await Product.updateOne(
      { _id: updatedPurchase.productId },
      {
        $inc: {
          productQuantity: -updatedPurchase.quantity,
          totalAmountWithoutTax: -subtotal,
          taxAmount: -taxAmount,
          totalAmountWithTax: -newGrandTotal,
        },
      }
    )

    /* ================= CLIENT APPLY ================= */
    await updateClientBalances(
      updatedPurchase.clientId,
      updatedPurchase,
      'apply'
    )

    /* ================= LEDGER ADJUSTMENT ================= */
    const difference = newGrandTotal - oldGrandTotal;

    if (difference !== 0) {
      addClientLedgerEntry({
        clientId,
        accountId: oldPurchase.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? "credit" : "debit",
        referenceType: "Purchase Adjustment",
        referenceId: id,
        narration: "Purchase updated adjustment",
        date,
      }).catch(console.error);
    }

    const systemAccountId =
      paymentMethod === "Cash"
        ? config.cashAccountId  // Cash Account ID
        : config.bankAccountId; // Bank Account ID

    const systemClientId = paymentMethod === "Cash"
      ? config.cashClientId // Cash Client ID
      : config.bankClientId; // Bank Client ID

    if (difference !== 0) {
      addClientLedgerEntry({
        clientId: systemClientId,
        accountId: systemAccountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? "debit" : "credit",
        referenceType: "Purchase Adjustment",
        referenceId: id,
        narration: "Purchase updated adjustment",
        date,
      }).catch(console.error);
    }

    /* ================= RESPONSE ================= */
    const populatedPurchase = await Purchase.findById(updatedPurchase._id)
      .populate('clientId')
      .populate('productId')

    res.status(200).json(populatedPurchase)

  } catch (error) {
    console.error("❌ Error updating purchase:", error);
    res.status(500).json({ error: "Failed to update purchase" });
  }
};


/* ========================= DELETE ========================= */
export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    /* CLIENT */
    await updateClientBalances(purchase.clientId, purchase, 'rollback')

    /* PRODUCT */
    await Product.updateOne(
      { _id: purchase.productId },
      {
        $inc: {
          productQuantity: -purchase.quantity,
          totalAmountWithoutTax: -purchase.totalAmountWithoutTax,
          taxAmount: -purchase.taxAmount,
          totalAmountWithTax: -purchase.totalAmountWithTax,
        },
      }
    )

    const client = await Client.findById(purchase.clientId);

    const totalAmount =
      purchase.totalAmountWithTax || purchase.totalAmountWithoutTax;

    if (client) {
      await addClientLedgerEntry({
        clientId: client._id,
        accountId: client.accountId,
        amount: totalAmount,
        entryType: "debit", // reversing purchase credit
        referenceType: "Purchase",
        referenceId: purchase._id,
        narration: `Purchase deleted`,
        date: new Date(),
      });
    }

    const systemAccountId =
      purchase.paymentMethod === "Cash"
        ? config.cashAccountId  // Cash Account ID
        : config.bankAccountId; // Bank Account ID

    const systemClientId = purchase.paymentMethod === "Cash"
      ? config.cashClientId // Cash Client ID
      : config.bankClientId; // Bank Client ID

    if (client) {
      await addClientLedgerEntry({
        clientId: systemClientId,
        accountId: systemAccountId,
        amount: totalAmount,
        entryType: "credit", // reversing purchase debit
        referenceType: "Purchase",
        referenceId: purchase._id,
        narration: `Purchase deleted`,
        date: new Date(),
      }).catch(console.error);
    }
    await Purchase.findByIdAndDelete(id);

    res.status(200).json({
      message: "Purchase deleted successfully",
      id,
    });

  } catch (error) {
    console.error("❌ Error deleting purchase:", error);
    res.status(500).json({ error: "Failed to delete purchase" });
  }
};


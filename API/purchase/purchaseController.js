import Purchase from "./purchaseSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";
import updateProductStock from "../utils/updateProductStock.js";
import mongoose from "mongoose";

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
      .populate("clientId")
      .populate("productId")
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

    const subtotal = price * qty;
    const taxAmount = (subtotal * Number(taxRate)) / 100;
    const freightTotal =
      Number(freightCharges) + Number(freightTaxAmount);
    const grandTotal = subtotal + taxAmount + freightTotal;

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
          taxAmount,
          totalAmountWithTax: grandTotal,
        },
      }
    );

    /* ================= CLIENT UPDATE ================= */
    const clientUpdate =
      paymentType === "partial"
        ? {
          $inc: {
            pendingAmount: Number(pendingAmount),
            paidAmount: Number(paidAmount),
          },
        }
        : statusOfTransaction === "completed"
          ? { $inc: { paidAmount: grandTotal } }
          : { $inc: { pendingAmount: grandTotal } };

    await Client.updateOne({ _id: clientId }, clientUpdate);

    /* ================= CREATE PURCHASE ================= */
    const purchase = await Purchase.create({
      clientId,
      productId,
      quantity: qty,
      purchaseAmount: price,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
      pendingFromOurs,
      taxRate,
      taxAmount,
      freightCharges,
      freightTaxAmount,
      totalAmountWithoutTax: subtotal,
      totalAmountWithTax: grandTotal,
      paymentMethod,
      methodType,
      billNo,
      dueDate,
      description,
      date,
      pageName: "Purchase",
    });

    /* ✅ RETURN POPULATED DOC */
    const fullPurchase = await Purchase.findById(purchase._id)
      .populate("clientId")
      .populate("productId");

    res.status(201).json(fullPurchase);

    /* ================= LEDGER (NON-BLOCKING) ================= */
    addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: "credit",
      referenceType: "Purchase",
      referenceId: purchase._id,
      narration: `Purchase ${product.productName} × ${qty}`,
      date,
    }, {
      clientId: "695a0e53a31c4b044118d304",
      accountId: "695a0e54a31c4b044118d307",
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
    } = req.body;

    const oldPurchase = await Purchase.findById(id);
    if (!oldPurchase)
      return res.status(404).json({ error: "Purchase not found" });

    const oldQty = oldPurchase.quantity;
    const oldSubtotal = oldPurchase.totalAmountWithoutTax;
    const oldGrandTotal = oldPurchase.totalAmountWithTax;

    const newQty = Number(quantity);
    const newPrice = Number(purchaseAmount);

    const newSubtotal = newQty * newPrice;
    const taxAmount = (newSubtotal * taxRate) / 100;
    const freightTotal = Number(freightCharges) + Number(freightTaxAmount);
    const newGrandTotal = newSubtotal + taxAmount + freightTotal;

    /* ================= PRODUCT STOCK ================= */
    await Product.bulkWrite([
      {
        updateOne: {
          filter: { _id: oldPurchase.productId },
          update: {
            $inc: {
              productQuantity: -oldQty,
              totalAmountWithoutTax: -oldSubtotal,
              totalAmountWithTax: -oldGrandTotal,
              taxAmount: -oldPurchase.taxAmount,
            },
          },
        },
      },
      {
        updateOne: {
          filter: { _id: productId },
          update: {
            $inc: {
              productQuantity: newQty,
              totalAmountWithoutTax: newSubtotal,
              taxAmount,
              totalAmountWithTax: newGrandTotal,
            },
          },
        },
      },
    ]);

    /* ================= CLIENT BALANCE ================= */
    const rollbackClientUpdate =
      oldPurchase.paymentType === "partial"
        ? {
          pendingAmount: -oldPurchase.pendingAmount,
          paidAmount: -oldPurchase.paidAmount,
        }
        : oldPurchase.statusOfTransaction === "completed"
          ? { paidAmount: -oldGrandTotal }
          : { pendingAmount: -oldGrandTotal };

    const applyClientUpdate =
      paymentType === "partial"
        ? {
          pendingAmount: Number(pendingAmount),
          paidAmount: Number(paidAmount),
        }
        : statusOfTransaction === "completed"
          ? { paidAmount: newGrandTotal }
          : { pendingAmount: newGrandTotal };

    await Client.bulkWrite([
      {
        updateOne: {
          filter: { _id: oldPurchase.clientId },
          update: { $inc: rollbackClientUpdate },
        },
      },
      {
        updateOne: {
          filter: { _id: clientId },
          update: { $inc: applyClientUpdate },
        },
      },
    ]);

    /* ================= UPDATE PURCHASE ================= */
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id,
      {
        clientId,
        productId,
        quantity: newQty,
        purchaseAmount: newPrice,
        statusOfTransaction,
        paymentType,
        pendingAmount,
        paidAmount,
        taxRate,
        taxAmount,
        freightCharges,
        freightTaxAmount,
        totalAmountWithoutTax: newSubtotal,
        totalAmountWithTax: newGrandTotal,
        billNo,
        date,
        dueDate,
        description,
      },
      { new: true }
    )
      .populate("clientId")
      .populate("productId");

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

    /* ✅ IMPORTANT: RETURN UPDATED DOCUMENT */
    res.status(200).json(updatedPurchase);

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

    const client = await Client.findById(purchase.clientId);
    const product = await Product.findById(purchase.productId);

    const totalAmount =
      purchase.totalAmountWithTax || purchase.totalAmountWithoutTax;

    if (product) {
      product.productQuantity -= purchase.quantity;
      product.totalAmountWithTax -= purchase.totalAmountWithTax;
      product.totalAmountWithoutTax -= purchase.totalAmountWithoutTax;
      await product.save();
    }

    if (client) {
      if (purchase.paymentType === "partial") {
        client.pendingAmount -= purchase.pendingAmount;
        client.paidAmount -= purchase.paidAmount;
      } else if (purchase.statusOfTransaction === "completed") {
        client.paidAmount -= totalAmount;
      } else {
        client.pendingAmount -= totalAmount;
      }

      await client.save();
    }

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


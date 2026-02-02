import Sales from "./salesSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";
import { config } from '../../config/config.js';
import { updateClientBalances } from "../utils/updateClientBalances.js";
import { calculateTotals } from "../utils/calculateTotals.js";
import mongoose from "mongoose";

/* ========================= GET ALL ========================= */
export const getAllSales = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const sales = await Sales.find(
      { userId: req.userId },
      {
        clientId: 1,
        productId: 1,
        quantity: 1,
        totalAmountWithTax: 1,
        paidAmount: 1,
        pendingAmount: 1,
        statusOfTransaction: 1,
        paymentMethod: 1,
        createdAt: 1,
      }
    )
      .populate("clientId", "clientName")
      .populate("productId", "productName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json(sales);
  } catch (error) {
    console.error("❌ Error fetching sales:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
};

/* ========================= GET BY ID ========================= */
export const getSalesById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid purchase ID" });
    }

    const sale = await Sales.findById(id)
      .populate("clientId", "clientName")
      .populate("productId", "productName")
      .lean();

    if (!sale)
      return res.status(404).json({ error: "Sales not found" });

    res.status(200).json(sale);
  } catch (error) {
    console.error("❌ Error fetching sale:", error);
    res.status(500).json({ error: "Failed to fetch sale" });
  }
};

/* ========================= CREATE ========================= */
export const createSales = async (req, res) => {
  try {
    const {
      clientId,
      productId,
      quantity,
      saleAmount,
      paymentType,
      statusOfTransaction,
      taxRate = 0,
      freightCharges = 0,
      freightTaxAmount = 0,
      paidAmount = 0,
      pendingAmount = 0,
      paymentMethod,
      billNo,
      dueDate,
      description,
      methodType,
      date,
      payments = []
    } = req.body

    if (!clientId || !productId || !quantity || !saleAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ error: "At least one payment is required" });
    }

    const qty = Number(quantity)
    const price = Number(saleAmount)

    if (qty <= 0 || price <= 0)
      return res.status(400).json({ error: 'Invalid quantity or price' })

    const { subtotal, taxAmount, grandTotal } = calculateTotals(req.body)

    const [client, product] = await Promise.all([
      Client.findById(clientId).lean(),
      Product.findById(productId).lean(),
    ]);

    if (!product || !client)
      return res.status(404).json({ error: 'Client or Product not found' })

    if (product.productQuantity < qty)
      return res.status(400).json({ error: 'Insufficient stock' })

    /* PRODUCT */
    await Product.updateOne(
      { _id: productId },
      {
        $inc: {
          productQuantity: -qty,
          totalAmountWithoutTax: -subtotal,
          taxAmount: -taxAmount,
          totalAmountWithTax: -grandTotal,
        },
      }
    )

    /* SALES DOC */
    const sale = await Sales.create({
      ...req.body,
      userId: req.userId,
      quantity: qty,
      saleAmount: price,
      taxAmount,
      totalAmountWithoutTax: subtotal,
      totalAmountWithTax: grandTotal,
      methodType: 'Receipt',
      pageName: 'Sales',
      payments
    })

    const populatedSale = await Sales.findById(sale._id)
      .populate("clientId")
      .populate("productId")

    res.status(201).json(populatedSale)

    /* CLIENT BALANCE */
    await updateClientBalances(clientId, { ...sale.toObject(), pageName: 'Sales' }, 'apply')

    /* LEDGER */
    await addClientLedgerEntry({
      userId: req.userId,
      clientId,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: 'debit',
      referenceType: 'Sales',
      referenceId: sale._id,
      narration: `Sales ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

    const systemAccountId =
      paymentMethod === 'Cash'
        ? config.cashAccountId
        : config.bankAccountId

    const systemClientId =
      paymentMethod === 'Cash'
        ? config.cashClientId
        : config.bankClientId

    await addClientLedgerEntry({
      userId: req.userId,
      clientId: systemClientId,
      accountId: systemAccountId,
      amount: grandTotal,
      entryType: 'credit',
      referenceType: 'Sales',
      referenceId: sale._id,
      narration: `Sales ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

  } catch (err) {
    console.error("❌ Error creating sales:", err)
    res.status(500).json({ error: 'Failed to create sale' })
  }
}

const calculateSalePaymentSplit = (tx, grandTotal) => {
  let paidAmount = 0;
  let pendingAmount = 0;

  if (tx.paymentType === 'partial') {
    paidAmount = Number(tx.paidAmount || 0);
    pendingAmount = Math.max(grandTotal - paidAmount, 0);

  } else if (tx.statusOfTransaction === 'completed') {
    paidAmount = grandTotal;
    pendingAmount = 0;

  } else {
    // pending / unpaid
    paidAmount = 0;
    pendingAmount = grandTotal;
  }

  return { paidAmount, pendingAmount };
};


/* ========================= UPDATE ========================= */
export const updateSales = async (req, res) => {
  try {
    const { id } = req.params

    const {
      clientId,
      productId,
      quantity,
      saleAmount,
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
      paymentMethod,
      payments = []
    } = req.body;

    const oldSale = await Sales.findById(id)
    if (!oldSale) {
      return res.status(404).json({ error: 'Sales not found' })
    }

    /* ================= TOTALS ================= */
    const oldGrandTotal = oldSale.totalAmountWithTax

    const {
      subtotal,
      taxAmount,
      grandTotal: newGrandTotal,
    } = calculateTotals(req.body)

    /* ================= CLIENT ================= */
    const client = await Client.findById(oldSale.clientId)
    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    /* ================= PRODUCT ROLLBACK ================= */
    await Product.updateOne(
      { _id: oldSale.productId },
      {
        $inc: {
          productQuantity: oldSale.quantity,
          totalAmountWithoutTax: oldSale.totalAmountWithoutTax,
          taxAmount: oldSale.taxAmount,
          totalAmountWithTax: oldSale.totalAmountWithTax,
        },
      }
    )

    /* ================= CLIENT ROLLBACK ================= */
    await updateClientBalances(oldSale.clientId, { ...oldSale.toObject(), pageName: 'Sales' }, 'rollback')

    /* ================= UPDATE SALE ================= */

    const { paidAmount: finalPaid, pendingAmount: finalPending } =
      calculateSalePaymentSplit(req.body, newGrandTotal);

    const updatedSale = await Sales.findByIdAndUpdate(
      id,
      {
        ...req.body,
        payments: req.body.payments,
        quantity: Number(req.body.quantity),
        saleAmount: Number(req.body.saleAmount),
        paidAmount: finalPaid,
        pendingAmount: finalPending,
        taxAmount,
        totalAmountWithoutTax: subtotal,
        totalAmountWithTax: newGrandTotal,
      },
      { new: true }
    )

    /* ================= PRODUCT APPLY ================= */
    await Product.updateOne(
      { _id: updatedSale.productId },
      {
        $inc: {
          productQuantity: -updatedSale.quantity,
          totalAmountWithoutTax: -subtotal,
          taxAmount: -taxAmount,
          totalAmountWithTax: -newGrandTotal,
        },
      }
    )

    /* ================= CLIENT APPLY ================= */
    await updateClientBalances(
      updatedSale.clientId,
      { ...updatedSale.toObject(), pageName: 'Sales' },
      'apply'
    )

    /* ================= LEDGER ADJUSTMENT ================= */
    const difference = newGrandTotal - oldGrandTotal

    if (difference !== 0) {
      addClientLedgerEntry({
        userId: req.userId,
        clientId,
        accountId: oldSale.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? 'debit' : 'credit',
        referenceType: 'Adjustment',
        referenceId: id,
        narration: 'Sales Updated Adjustment',
        date,
      }).catch(console.error);
    }

    const oldSystemAccountId =
      oldSale.paymentMethod === 'Cash'
        ? config.cashAccountId
        : config.bankAccountId

    const oldSystemClientId =
      oldSale.paymentMethod === 'Cash'
        ? config.cashClientId
        : config.bankClientId

    if (difference !== 0) {
      await addClientLedgerEntry({
        userId: req.userId,
        clientId: oldSystemClientId,
        accountId: oldSystemAccountId,
        amount: oldSale.totalAmountWithTax,
        entryType: 'debit',
        referenceType: 'Adjustment',
        referenceId: oldSale._id,
        narration: 'Sales Adjustment Rollback',
        date: new Date(),
      }).catch(console.error);
    }

    const newSystemAccountId =
      updatedSale.paymentMethod === 'Cash'
        ? config.cashAccountId
        : config.bankAccountId

    const newSystemClientId =
      updatedSale.paymentMethod === 'Cash'
        ? config.cashClientId
        : config.bankClientId

    if (difference !== 0) {
      await addClientLedgerEntry({
        userId: req.userId,
        clientId: newSystemClientId,
        accountId: newSystemAccountId,
        amount: updatedSale.totalAmountWithTax,
        entryType: 'credit',
        referenceType: 'Adjustment',
        referenceId: updatedSale._id,
        narration: 'Sales Adjustment Applied',
        date: new Date(),
      })
    }


    /* ================= RESPONSE ================= */
    const populatedSale = await Sales.findById(updatedSale._id)
      .populate('clientId')
      .populate('productId')

    res.status(200).json(populatedSale)

  } catch (err) {
    console.error('❌ Update sales error:', err)
    res.status(500).json({ error: 'Failed to update sale' })
  }
}


/* ========================= DELETE ========================= */
export const deleteSales = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sales.findById(id)
    if (!sale)
      return res.status(404).json({ error: 'Sales not found' })

    /* CLIENT */
    await updateClientBalances(sale.clientId, { ...sale.toObject(), pageName: 'Sales' }, 'rollback')

    /* PRODUCT */
    await Product.updateOne(
      { _id: sale.productId },
      {
        $inc: {
          productQuantity: sale.quantity,
          totalAmountWithoutTax: sale.totalAmountWithoutTax,
          taxAmount: sale.taxAmount,
          totalAmountWithTax: sale.totalAmountWithTax,
        },
      }
    )

    const client = await Client.findById(sale.clientId)

    const totalAmount = sale.totalAmountWithTax || sale.totalAmountWithoutTax;

    /* LEDGER */
    if (client) {
      await addClientLedgerEntry({
        userId: req.userId,
        clientId: client._id,
        accountId: client.accountId,
        amount: totalAmount,
        entryType: "credit",
        referenceType: "Sales",
        referenceId: sale._id,
        narration: 'Sales deleted',
        date: new Date(),
      });
    }

    const systemAccountId = sale.paymentMethod === "Cash" ? config.cashAccountId : config.bankAccountId;

    const systemClientId = sale.paymentMethod === "Cash" ? config.cashClientId : config.bankClientId;

    if (client) {
      await addClientLedgerEntry({
        userId: req.userId,
        clientId: systemClientId,
        accountId: systemAccountId,
        amount: totalAmount,
        entryType: "debit",
        referenceType: "Sales",
        referenceId: sale._id,
        narration: 'Sales deleted',
        date: new Date(),
      }).catch(console.error);
    }

    await Sales.findByIdAndDelete(id)

    res.status(200).json({ message: 'Sales deleted successfully', id })

  } catch (error) {
    console.error("❌ Error deleting sales:", error);
    res.status(500).json({ error: "Failed to delete sales" });
  }
}


import Sales from "./salesSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";

import { config } from '../../config/config.js';

/* ========================= GET ALL ========================= */
export const getAllSales = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const sales = await Sales.find({})
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

    const qty = Number(quantity);
    const price = Number(saleAmount);

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

    if (product.productQuantity < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    await Product.updateOne(
      { _id: productId },
      {
        $inc: {
          productQuantity: -qty,
          totalAmountWithoutTax: -subtotal,
          taxAmount: -(taxAmount || 0),
          totalAmountWithTax: -(grandTotal || 0),
        },
      }
    );

    const clientUpdate =
      paymentType === "partial"
        ? {
          $inc: {
            pendingAmount: -Number(pendingAmount),
            paidAmount: -Number(paidAmount),
          },
        }
        : statusOfTransaction === "completed"
          ? { $inc: { paidAmount: -grandTotal } }
          : { $inc: { pendingAmount: -grandTotal } };

    await Client.updateOne({ _id: clientId }, clientUpdate);

    /* ===============================
       🧾 CREATE SALES
    ================================ */
    const sale = await Sales.create({
      clientId,
      productId,
      quantity: qty,
      saleAmount: price,
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
      pageName: "Sales",
    });

    const fullSales = await Sales.findById(sale._id)
      .populate("clientId")
      .populate("productId");

    res.status(201).json(fullSales);

    await addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: "debit",
      referenceType: "Sales",
      referenceId: sale._id,
      narration: `Sales ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

    const systemAccountId =
      paymentMethod === "Cash"
        ? config.cashAccountId  // Cash Account ID
        : config.bankAccountId; // Bank Account ID

    const systemClientId = paymentMethod === "Cash"
      ? config.cashClientId // Cash Client ID
      : config.bankClientId; // Bank Client ID

    addClientLedgerEntry({
      clientId: systemClientId,
      accountId: systemAccountId,
      amount: grandTotal,
      entryType: "credit",
      referenceType: "Sales",
      referenceId: sale._id,
      narration: `Sales ${product.productName} × ${qty}`,
      date,
    }).catch(console.error);

  } catch (error) {
    console.error("❌ Error creating sale:", error);
    res.status(500).json({ error: "Failed to create sale" });
  }
};


/* ========================= UPDATE ========================= */
export const updateSales = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clientId,
      productId,
      quantity,
      saleAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
      taxRate,
      freightCharges,
      freightTaxAmount,
      billNo,
      date,
      dueDate,
      description,
      paymentMethod
    } = req.body;

    const oldSale = await Sales.findById(id);
    if (!oldSale)
      return res.status(404).json({ error: "Sales not found" });

    const oldQty = oldSale.quantity;
    const oldSubtotal = oldSale.totalAmountWithoutTax;
    const oldGrandTotal = oldSale.totalAmountWithTax;

    const newQty = Number(quantity);
    const newPrice = Number(saleAmount);

    const newSubtotal = newQty * newPrice;
    const taxAmount = (newSubtotal * taxRate) / 100;
    const freightTotal = Number(freightCharges) + Number(freightTaxAmount);
    const newGrandTotal = newSubtotal + taxAmount + freightTotal;

    /* ================= PRODUCT STOCK ================= */
    await Product.bulkWrite([
      {
        updateOne: {
          filter: { _id: oldSale.productId },
          update: {
            $inc: {
              productQuantity: -oldQty,
              totalAmountWithoutTax: -oldSubtotal,
              totalAmountWithTax: -oldGrandTotal,
              taxAmount: -oldSale.taxAmount,
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
      oldSale.paymentType === "partial"
        ? {
          pendingAmount: -oldSale.pendingAmount,
          paidAmount: -oldSale.paidAmount,
        }
        : oldSale.statusOfTransaction === "completed"
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
          filter: { _id: oldSale.clientId },
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


    const updatedSale = await Sales.findByIdAndUpdate(
      id,
      {
        clientId,
        productId,
        quantity: newQty,
        saleAmount: newPrice,
        statusOfTransaction,
        paymentType,
        pendingAmount,
        paidAmount,
        taxRate,
        taxAmount,
        totalAmountWithoutTax: newSubtotal,
        totalAmountWithTax: newGrandTotal,
        freightCharges,
        freightTaxAmount,
        billNo,
        date,
        dueDate,
        description,
        paymentMethod
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
        accountId: oldSale.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? 'credit' : 'debit',
        referenceType: 'Adjustment',
        referenceId: id,
        narration: `Sales updated adjustment`,
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
        entryType: difference > 0 ? 'debit' : 'credit',
        referenceType: 'Adjustment',
        referenceId: id,
        narration: `Sales updated adjustment`,
      }).catch(console.error);
    }

    res.status(200).json(updatedSale);
  } catch (error) {
    console.error("❌ Error updating sale:", error);
    res.status(500).json({ error: "Failed to update sale" });
  }
};

/* ========================= DELETE ========================= */
export const deleteSales = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sales.findById(id);
    if (!sale) {
      return res.status(404).json({ error: "Sales not found" });
    }

    const client = await Client.findById(sale.clientId);
    const product = await Product.findById(sale.productId);

    const totalAmount =
      sale.totalAmountWithTax || sale.totalAmountWithoutTax;

    if (product) {
      product.productQuantity += sale.quantity;
      product.totalAmountWithTax += sale.totalAmountWithTax;
      product.totalAmountWithoutTax += sale.totalAmountWithoutTax;
      await product.save();
    }

    if (client) {
      const amount = sale.saleAmount * sale.quantity;

      if (sale.paymentType === "partial") {
        client.pendingAmount -= sale.pendingAmount;
        client.paidAmount -= sale.paidAmount;
      } else if (sale.statusOfTransaction === "completed") {
        client.paidAmount -= amount;
      } else {
        client.pendingAmount -= amount;
      }

      await client.save();
    }

    if (client) {
      await addClientLedgerEntry({
        clientId: client._id,
        accountId: client.accountId,
        amount: totalAmount,
        entryType: "credit", // reversing purchase credit
        referenceType: "Sales",
        referenceId: sale._id,
        narration: `Sales deleted`,
        date: new Date(),
      });
    }

    const systemAccountId =
      sale.paymentMethod === "Cash"
        ? config.cashAccountId  // Cash Account ID
        : config.bankAccountId; // Bank Account ID

    const systemClientId = sale.paymentMethod === "Cash"
      ? config.cashClientId // Cash Client ID
      : config.bankClientId; // Bank Client ID

    if (client) {
      await addClientLedgerEntry({
        clientId: systemClientId,
        accountId: systemAccountId,
        amount: totalAmount,
        entryType: "debit", // reversing purchase debit
        referenceType: "Sales",
        referenceId: sale._id,
        narration: `Sales deleted`,
        date: new Date(),
      }).catch(console.error);
    }

    await Sales.findByIdAndDelete(id);

    res.status(200).json({ message: "Sales deleted successfully", id });
  } catch (error) {
    console.error("❌ Error deleting sale:", error);
    res.status(500).json({ error: "Failed to delete sale" });
  }
};

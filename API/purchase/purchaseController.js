import Purchase from "./purchaseSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";
import updateProductStock from "../utils/updateProductStock.js";

/* ========================= GET ALL ========================= */
export const getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate("clientId")
      .populate("productId")
      .sort({ createdAt: -1 });

    res.status(200).json(purchases);
  } catch (error) {
    console.error("❌ Error fetching purchases:", error);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
};

/* ========================= GET BY ID ========================= */
export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate("clientId")
      .populate("productId");

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

    const product = await Product.findById(productId);
    const client = await Client.findById(clientId);

    if (!product || !client) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    const qty = Number(quantity);
    const price = Number(purchaseAmount);

    const subtotal = price * qty;
    const taxAmount = (subtotal * Number(taxRate)) / 100;
    const freightTotal =
      Number(freightCharges) + Number(freightTaxAmount);

    const grandTotal = subtotal + taxAmount + freightTotal;

    product.productQuantity += qty;

    product.totalAmountWithoutTax =
      (product.totalAmountWithoutTax || 0) + subtotal;

    product.taxAmount =
      (product.taxAmount || 0) + taxAmount;

    product.totalAmountWithTax =
      (product.totalAmountWithTax || 0) + grandTotal;

    await product.save();

    if (paymentType === "partial") {
      client.pendingAmount += Number(pendingAmount);
      client.paidAmount += Number(paidAmount);
    } else if (statusOfTransaction === "completed") {
      client.paidAmount += grandTotal;
    } else {
      client.pendingAmount += grandTotal;
    }

    await client.save();

    /* ================================
       🧾 CREATE PURCHASE
    ================================= */
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

    await addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: "credit",
      referenceType: "Purchase",
      referenceId: purchase._id,
      narration: `Purchase ${product.productName} × ${qty}`,
      date,
    });

    const fullPurchase = await Purchase.findById(purchase._id)
      .populate("clientId")
      .populate("productId");

    res.status(201).json(fullPurchase);

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
      pendingAmount,
      paidAmount,
      taxRate,
      freightCharges,
      freightTaxAmount,
      billNo,
      date,
      dueDate,
      description
    } = req.body;

    const purchase = await Purchase.findById(id);
    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    const oldProduct = await Product.findById(purchase.productId);
    const oldClient = await Client.findById(purchase.clientId);

    const newProduct = await Product.findById(productId);
    const newClient = await Client.findById(clientId);

    if (!oldProduct || !newProduct || !oldClient || !newClient) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    /* ✅ ROLLBACK OLD STOCK */
    oldProduct.productQuantity -= purchase.quantity;

    newProduct.productQuantity += quantity;

    const subtotal = purchaseAmount * quantity;
    const tax = (subtotal * (taxRate || 0)) / 100;
    const grandTotal = subtotal + tax;

    const oldTotal = purchase.totalAmountWithTax || purchase.totalAmountWithoutTax;

    if (purchase.paymentType === "partial") {
      oldClient.pendingAmount -= purchase.pendingAmount;
      oldClient.paidAmount -= purchase.paidAmount;
    } else if (purchase.statusOfTransaction === "completed") {
      oldClient.paidAmount -= oldTotal;
    } else {
      oldClient.pendingAmount -= oldTotal;
    }


    /* ✅ APPLY NEW VALUES */
    if (paymentType === "partial") {
      newClient.pendingAmount += Number(pendingAmount);
      newClient.paidAmount += Number(paidAmount);
    } else if (statusOfTransaction === "completed") {
      newClient.paidAmount += grandTotal;
    } else {
      newClient.pendingAmount += grandTotal;
    }


    Object.assign(purchase, {
      clientId,
      productId,
      quantity,
      purchaseAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
      taxRate,
      taxAmount: tax,
      totalAmountWithoutTax: subtotal,
      totalAmountWithTax: grandTotal,
      freightCharges,
      freightTaxAmount,
      billNo,
      date,
      dueDate,
      description,
    });

    await oldProduct.save();
    if (oldProduct._id.toString() !== newProduct._id.toString()) {
      await newProduct.save();
    }

    await oldClient.save();
    if (oldClient._id.toString() !== newClient._id.toString()) {
      await newClient.save();
    }

    await purchase.save();

    const difference = grandTotal - oldTotal;

    if (difference !== 0) {
      await addClientLedgerEntry({
        clientId: newClient._id,
        accountId: newClient.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? 'credit' : 'debit',
        referenceType: 'Purchase Adjustment',
        referenceId: purchase._id,
        narration: 'Purchase updated adjustment',
        date,
      });
    }


    const fullPurchase = await Purchase.findById(purchase._id)
      .populate("clientId")
      .populate("productId");

    res.status(200).json(fullPurchase);

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


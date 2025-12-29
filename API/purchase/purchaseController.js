import Purchase from "./purchaseSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";

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
      taxAmount = 0,
      freightCharges = 0,
      freightTaxAmount = 0,
      totalAmountWithTax,
      totalAmountWithoutTax,
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

    /* ✅ STOCK UPDATE */
    product.quantity += Number(quantity);
    await product.save();

    const totalAmount = purchaseAmount * quantity;

    /* ✅ CLIENT BALANCE UPDATE */
    if (paymentType === "partial") {
      client.pendingAmount += Number(pendingAmount);
      client.paidAmount += Number(paidAmount);
    } else if (statusOfTransaction === "completed") {
      client.paidAmount += totalAmount;
    } else {
      client.pendingAmount += totalAmount;
    }

    await client.save();

    const purchase = await Purchase.create({
      clientId,
      productId,
      quantity,
      purchaseAmount,
      statusOfTransaction,
      paymentType,
      pendingAmount,
      paidAmount,
      pendingFromOurs,
      taxRate,
      taxAmount,
      freightCharges,
      freightTaxAmount,
      totalAmountWithTax,
      totalAmountWithoutTax,
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
      amount: totalAmountWithTax || totalAmount,
      entryType: 'credit',
      referenceType: 'Purchase',
      referenceId: purchase._id,
      narration: `Purchase ${product.productName}*${purchase.quantity}`,
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
      taxAmount,
      freightCharges,
      freightTaxAmount,
      totalAmountWithoutTax,
      totalAmountWithTax,
      billNo,
      date,
      dueDate,
      description,
    } = req.body;

    const purchase = await Purchase.findById(id);
    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    const client = await Client.findById(clientId);
    const product = await Product.findById(productId);

    if (!client || !product) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    const oldTotal = purchase.totalAmountWithTax || purchase.totalAmountWithoutTax;
    const newTotal = totalAmountWithTax || totalAmountWithoutTax;

    const difference = oldTotal - newTotal;

    /* ✅ ROLLBACK OLD STOCK */
    product.quantity -= purchase.quantity;

    product.quantity += quantity;

    /* ✅ ROLLBACK */
    if (purchase.paymentType === "partial") {
      client.pendingAmount -= purchase.pendingAmount;
      client.paidAmount -= purchase.paidAmount;
    } else if (purchase.statusOfTransaction === "completed") {
      client.paidAmount -= oldTotal;
    } else {
      client.pendingAmount -= oldTotal;
    }

    /* ✅ APPLY NEW VALUES */
    if (paymentType === "partial") {
      client.pendingAmount += Number(pendingAmount);
      client.paidAmount += Number(paidAmount);
    } else if (statusOfTransaction === "completed") {
      client.paidAmount += newTotal;
    } else {
      client.pendingAmount += newTotal;
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
      taxAmount,
      freightCharges,
      freightTaxAmount,
      totalAmountWithoutTax,
      totalAmountWithTax,
      billNo,
      date,
      dueDate,
      description,
    });

    await product.save();
    await client.save();
    await purchase.save();

    if (difference !== 0) {
      await addClientLedgerEntry({
        clientId: client._id,
        accountId: client.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? 'debit' : 'credit',
        referenceType: 'Adjustment',
        referenceId: purchase._id,
        narration: `Purchase updated adjustment`,
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

    if (product) {
      product.quantity += purchase.quantity;
      await product.save();
    }

    if (client) {
      const amount = purchase.purchaseAmount * purchase.quantity;

      if (purchase.paymentType === "partial") {
        client.pendingAmount -= purchase.pendingAmount;
        client.paidAmount -= purchase.paidAmount;
      } else if (purchase.statusOfTransaction === "completed") {
        client.paidAmount -= amount;
      } else {
        client.pendingAmount -= amount;
      }

      await client.save();
    }

    await Purchase.findByIdAndDelete(id);

    res.status(200).json({ message: "Purchase deleted successfully", id });
  } catch (error) {
    console.error("❌ Error deleting purchase:", error);
    res.status(500).json({ error: "Failed to delete purchase" });
  }
};

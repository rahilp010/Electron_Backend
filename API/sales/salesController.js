import Sales from "./salesSchema.js";
import Client from "../clients/clientSchema.js";
import Product from "../products/productSchema.js";
import addClientLedgerEntry from "../utils/addClientLedgerEntry.js";

/* ========================= GET ALL ========================= */
export const getAllSales = async (req, res) => {
  try {
    const sales = await Sales.find()
      .populate("clientId")
      .populate("productId")
      .sort({ createdAt: -1 });

    res.status(200).json(sales);
  } catch (error) {
    console.error("❌ Error fetching sales:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
};

/* ========================= GET BY ID ========================= */
export const getSalesById = async (req, res) => {
  try {
    const sale = await Sales.findById(req.params.id)
      .populate("clientId")
      .populate("productId");

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

    if (!clientId || !productId || !quantity || !saleAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await Product.findById(productId);
    const client = await Client.findById(clientId);

    if (!product || !client) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    if (product.productQuantity < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    const qty = Number(quantity);
    const price = Number(saleAmount);

    const subtotal = price * qty;
    const taxAmount = (subtotal * Number(taxRate)) / 100;
    const freightTotal =
      Number(freightCharges) + Number(freightTaxAmount);

    const grandTotal = subtotal + taxAmount + freightTotal;

    product.productQuantity -= qty;

    product.totalAmountWithoutTax =
      (product.totalAmountWithoutTax || 0) - subtotal;

    product.taxAmount =
      (product.taxAmount || 0) + taxAmount;

    product.totalAmountWithTax =
      (product.totalAmountWithTax || 0) - grandTotal;

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

    await addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: grandTotal,
      entryType: "debit",
      referenceType: "Sales",
      referenceId: sale._id,
      narration: `Sales ${product.productName} × ${qty}`,
      date,
    });

    const fullSales = await Sales.findById(sale._id)
      .populate("clientId")
      .populate("productId");

    res.status(201).json(fullSales);

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
    } = req.body;

    const sale = await Sales.findById(id);
    if (!sale)
      return res.status(404).json({ error: "Sales not found" });

    const oldProduct = await Product.findById(sale.productId);
    const oldClient = await Client.findById(sale.clientId);

    const newProduct = await Product.findById(productId);
    const newClient = await Client.findById(clientId);

    if (!oldProduct || !newProduct || !oldClient || !newClient) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    /* ✅ ROLLBACK OLD STOCK */
    oldProduct.productQuantity += sale.quantity;

    /* ✅ CHECK NEW STOCK */
    if (oldProduct.productQuantity < quantity) {
      return res
        .status(400)
        .json({ error: "Insufficient stock after update" });
    }

    newProduct.productQuantity -= quantity;

    const subtotal = saleAmount * quantity;
    const tax = (subtotal * (taxRate || 0)) / 100;
    const grandTotal = subtotal + tax;

    const oldTotal = sale.totalAmountWithTax || sale.totalAmountWithoutTax;

    /* ✅ ROLLBACK */
    if (sale.paymentType === "partial") {
      oldClient.pendingAmount -= sale.pendingAmount;
      oldClient.paidAmount -= sale.paidAmount;
    } else if (sale.statusOfTransaction === "completed") {
      oldClient.paidAmount -= oldTotal;
    } else {
      oldClient.pendingAmount -= oldTotal;
    }

    /* ✅ APPLY NEW VALUES */
    if (paymentType === "partial") {
      newClient.pendingAmount += Number(pendingAmount);
      newClient.paidAmount += Number(paidAmount);
    } else if (statusOfTransaction === "completed") {
      newClient.paidAmount += newTotal;
    } else {
      newClient.pendingAmount += newTotal;
    }

    Object.assign(sale, {
      clientId,
      productId,
      quantity,
      saleAmount,
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

    await sale.save();


    if (difference !== 0) {
      await addClientLedgerEntry({
        clientId: newClient._id,
        accountId: newClient.accountId,
        amount: Math.abs(difference),
        entryType: difference > 0 ? 'credit' : 'debit',
        referenceType: 'Adjustment',
        referenceId: sale._id,
        narration: `Sales updated adjustment`,
      });
    }

    const fullSales = await Sales.findById(sale._id)
      .populate("clientId")
      .populate("productId");

    res.status(200).json(fullSales);

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

    await Sales.findByIdAndDelete(id);

    res.status(200).json({ message: "Sales deleted successfully", id });
  } catch (error) {
    console.error("❌ Error deleting sale:", error);
    res.status(500).json({ error: "Failed to delete sale" });
  }
};

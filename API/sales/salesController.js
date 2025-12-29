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

    if (!clientId || !productId || !quantity || !saleAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await Product.findById(productId);
    const client = await Client.findById(clientId);

    if (!product || !client) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    /* ✅ STOCK UPDATE */
    product.productQuantity -= quantity;
    await product.save();

    const totalAmount = saleAmount * quantity;

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

    const sale = await Sales.create({
      clientId,
      productId,
      quantity,
      saleAmount,
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
      pageName: "Sales",
    });

    await addClientLedgerEntry({
      clientId: client._id,
      accountId: client.accountId,
      amount: totalAmountWithTax || totalAmount,
      entryType: 'debit',
      referenceType: 'Sales',
      referenceId: sale._id,
      narration: `Sales ${product.productName}*${sale.quantity}`,
      date,
    })

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

    const sale = await Sales.findById(id);
    if (!sale)
      return res.status(404).json({ error: "Sales not found" });

    const client = await Client.findById(clientId);
    const product = await Product.findById(productId);

    if (!client || !product) {
      return res.status(404).json({ error: "Client or Product not found" });
    }

    const oldTotal = sale.totalAmountWithTax || sale.totalAmountWithoutTax;
    const newTotal = totalAmountWithTax || totalAmountWithoutTax;

    const difference = oldTotal - newTotal;

    /* ✅ ROLLBACK OLD STOCK */
    product.productQuantity += sale.quantity;

    /* ✅ CHECK NEW STOCK */
    if (product.productQuantity < quantity) {
      return res
        .status(400)
        .json({ error: "Insufficient stock after update" });
    }

    product.productQuantity -= quantity;

    /* ✅ ROLLBACK */
    if (sale.paymentType === "partial") {
      client.pendingAmount -= sale.pendingAmount;
      client.paidAmount -= sale.paidAmount;
    } else if (sale.statusOfTransaction === "completed") {
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
    await sale.save();

    if (difference !== 0) {
      await addClientLedgerEntry({
        clientId: client._id,
        accountId: client.accountId,
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
    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ error: "Sales not found" });
    }

    const client = await Client.findById(sale.clientId);
    const product = await Product.findById(sale.productId);

    if (product) {
      product.productQuantity += sale.quantity;
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

    await Sales.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Sales deleted successfully", id: req.params.id });
  } catch (error) {
    console.error("❌ Error deleting sale:", error);
    res.status(500).json({ error: "Failed to delete sale" });
  }
};

import mongoose from "mongoose";
import Product from "./productSchema.js";

const getAllProducts = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = 20;
        const skip = (page - 1) * limit;

        const products = await Product.find(
            { userId: req.userId },
            {
                productName: 1,
                productPrice: 1,
                productQuantity: 1,
                productType: 1,
                assetType: 1,
                totalAmountWithTax: 1,
                totalAmountWithoutTax: 1,
                createdAt: 1,
            }
        )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json(products);
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};


const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid product ID" });
        }

        const product = await Product.findById(id).lean();

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("❌ Error fetching product:", error);
        res.status(500).json({ error: "Failed to fetch product" });
    }
};

const decreaseMachinePartsStock = async (parts, machineQty) => {
    for (const part of parts) {
        const partProduct = await Product.findById(part.productId);

        if (!partProduct) {
            throw new Error('Part product not found');
        }

        const requiredQty = part.qtyPerMachine * machineQty;

        if (partProduct.productQuantity < requiredQty) {
            throw new Error(
                `Insufficient stock for ${partProduct.productName}`,
            );
        }

        await Product.updateOne(
            { _id: part.productId },
            { $inc: { productQuantity: -requiredQty } },
        );
    }
};


const createProduct = async (req, res) => {
    try {
        const {
            productName,
            productPrice,
            productQuantity = 0,
            productType,
            parts = [],
            clientName,
            assetType,
            saleHSN,
            purchaseHSN,
            taxRate = 0,
            taxAmount = 0,
            totalAmountWithTax = 0,
            totalAmountWithoutTax = 0,
            addParts,
        } = req.body;

        if (!productName || !productPrice) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (productType === 'MACHINE' && parts.length > 0 && productQuantity > 0) {
            await decreaseMachinePartsStock(parts, productQuantity);
        }

        const newProduct = await Product.create({
            productName,
            productPrice,
            productQuantity,
            productType,
            parts,
            clientName,
            assetType,
            saleHSN,
            purchaseHSN,
            taxRate,
            taxAmount,
            totalAmountWithTax,
            totalAmountWithoutTax,
            addParts,
            userId: req.userId,
        });

        res.status(201).json({
            message: 'Product created successfully',
            product: newProduct,
        });
    } catch (error) {
        console.error('❌ Error inserting product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
};


const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const oldProduct = await Product.findById(id);
        if (!oldProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (oldProduct.productType === 'MACHINE' && oldProduct.parts?.length) {
            for (const part of oldProduct.parts) {
                await Product.updateOne(
                    { _id: part.productId },
                    {
                        $inc: {
                            productQuantity:
                                part.qtyPerMachine * oldProduct.productQuantity,
                        },
                    },
                );
            }
        }

        if (req.body.productType === 'MACHINE' && req.body.parts?.length) {
            await decreaseMachinePartsStock(
                req.body.parts,
                req.body.productQuantity,
            );
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        ).lean();

        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json({
            message: 'Product updated successfully',
            product: updatedProduct,
        });
    } catch (error) {
        console.error('❌ Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const deleted = await Product.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (deleted.productType === 'MACHINE') {
            for (const part of deleted.parts) {
                await Product.updateOne(
                    { _id: part.productId },
                    {
                        $inc: {
                            productQuantity:
                                part.qtyPerMachine * deleted.productQuantity,
                        },
                    },
                );
            }
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
};



export { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct };

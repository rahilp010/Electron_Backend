import mongoose from "mongoose";
import Product from "./productSchema.js";

const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        console.error("❌ Error fetching products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
}

const getProductById = async (req, res) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid product ID format" });
        }


        const product = await Product.findById(req.params.id);
        console.log("product", product);

        if (!product) return res.status(404).json({ error: "Product not found" });
        res.status(200).json(product);
    } catch (error) {
        console.error("❌ Error fetching product:", error);
        res.status(500).json({ error: "Failed to fetch product" });
    }
}

const createProduct = async (req, res) => {
    try {
        const { name, price, isStock, image } = req.body;
        const newProduct = new Product({ name, price, isStock, image });
        await newProduct.save();

        res.status(201).json({ message: "Product inserted successfully", product: newProduct });
        console.log("✅ Product inserted successfully");
    } catch (error) {
        console.error("❌ Error inserting product:", error);
        res.status(500).json({ error: "Failed to add product" });
    }
}

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, isStock, image } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, price, isStock, image },
            { new: true } // return updated doc
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
    } catch (error) {
        console.error("❌ Error updating product:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
};


const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json({ message: "Product deleted successfully" });
        console.log("🗑️ Product deleted successfully");
    } catch (error) {
        console.error("❌ Error deleting product:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
};


export { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct };

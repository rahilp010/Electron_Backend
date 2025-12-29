const updateProductStock = async ({ product, quantity, pageName, totalAmountWithTax, totalAmountWithoutTax }) => {
    if (pageName === 'Purchase') {
        product.productQuantity += quantity;

        if (taxAmount > 0) {
            product.totalAmountWithTax = totalAmountWithTax
        } else {
            product.totalAmountWithoutTax = totalAmountWithoutTax
        }
    }

    if (pageName === 'Sales') {
        if (product.productQuantity < quantity) {
            throw new Error('Insufficient stock');
        }
        product.productQuantity -= quantity;

        if (taxAmount > 0) {
            product.totalAmountWithTax = totalAmountWithTax
        } else {
            product.totalAmountWithoutTax = totalAmountWithoutTax
        }
    }

    await product.save();
};

export default updateProductStock


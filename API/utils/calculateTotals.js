export const calculateTotals = (tx) => {
    const qty = Number(tx.quantity || 0)
    const price = Number(
        tx.saleAmount ?? tx.purchaseAmount ?? 0
    )

    const taxRate = Number(tx.taxRate || 0)
    const freightCharges = Number(tx.freightCharges || 0)
    const freightTaxAmount = Number(tx.freightTaxAmount || 0)

    const subtotal = price * qty
    const taxAmount = (subtotal * taxRate) / 100
    const freightTotal = freightCharges + freightTaxAmount
    const grandTotal = subtotal + taxAmount + freightTotal

    return {
        subtotal,
        taxAmount,
        freightTotal,
        grandTotal,
    }
}

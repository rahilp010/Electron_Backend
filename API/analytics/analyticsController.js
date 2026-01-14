import Sales from '../sales/salesSchema.js';
import Purchase from '../purchase/purchaseSchema.js';
import Product from '../products/productSchema.js';
import Client from '../clients/clientSchema.js';


export const getAnalytics = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        const dateFilter =
            fromDate && toDate
                ? {
                    date: {
                        $gte: new Date(fromDate),
                        $lte: new Date(toDate),
                    },
                }
                : {};

        const [sales, purchases, products, clients] = await Promise.all([
            Sales.find(dateFilter),
            Purchase.find(dateFilter),
            Product.find({}),
            Client.find({}),
        ]);

        /* ================= SALES ================= */
        const salesStats = sales.reduce(
            (acc, s) => {
                acc.total += s.totalAmountWithTax || 0;
                acc.paid += s.paidAmount || 0;
                acc.pending += s.pendingAmount || 0;
                acc.byPayment[s.paymentMethod] =
                    (acc.byPayment[s.paymentMethod] || 0) +
                    (s.totalAmountWithTax || 0);
                return acc;
            },
            { total: 0, paid: 0, pending: 0, byPayment: {} },
        );

        /* ================= PURCHASE ================= */
        const purchaseStats = purchases.reduce(
            (acc, p) => {
                acc.total += p.totalAmountWithTax || 0;
                acc.paid += p.paidAmount || 0;
                acc.pending += p.pendingAmount || 0;
                acc.byPayment[p.paymentMethod] =
                    (acc.byPayment[p.paymentMethod] || 0) +
                    (p.totalAmountWithTax || 0);
                return acc;
            },
            { total: 0, paid: 0, pending: 0, byPayment: {} },
        );

        /* ================= STOCK PREDICTION ================= */
        const stockPredictions = await Promise.all(
            products.map(async p => {
                const last30Sales = await Sales.find({
                    productId: p._id,
                    date: { $gte: new Date(Date.now() - 30 * 86400000) },
                });

                const sold = last30Sales.reduce((s, i) => s + i.quantity, 0);
                const avgDaily = sold / 30 || 0;
                const daysLeft = avgDaily ? p.productQuantity / avgDaily : Infinity;

                return {
                    productId: p._id,
                    productName: p.productName,
                    stock: p.productQuantity,
                    avgDaily,
                    daysLeft,
                    risk:
                        daysLeft < 7
                            ? 'critical'
                            : daysLeft < 15
                                ? 'warning'
                                : 'safe',
                };
            }),
        );

        res.json({
            counts: {
                clients: clients.length,
                products: products.length,
                stock: products.reduce((s, p) => s + p.productQuantity, 0),
            },
            sales: salesStats,
            purchases: purchaseStats,
            profit: salesStats.total - purchaseStats.total,
            stockPredictions,
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
};

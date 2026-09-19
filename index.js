const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const app = express()
const port = process.env.port || 3000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true
}
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7tyfnet.mongodb.net/?appName=Cluster0`;

// MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const invoiceCollection = client.db('ITZoneInvoiceDB').collection('invoices');
        const productCollection = client.db('ITZoneInvoiceDB').collection('products');
        const serviceCollection = client.db('ITZoneInvoiceDB').collection('services');

        // 1.POST: to save invoice data from POS Screen
        app.post('/invoices', async (req, res) => {
            try {
                const invoiceData = req.body;
                
                // Strict boundary validation: Check if items array exists and is not empty
                if (!invoiceData.items || invoiceData.items.length === 0) {
                    return res.status(400).json({ error: 'Invoice must contain at least one item' });
                }

                // Add server-side timestamp or metadata if needed
                invoiceData.createdAt = new Date();

                const result = await invoiceCollection.insertOne(invoiceData);
                res.status(201).json({
                    success: true,
                    message: 'Invoice saved successfully to database',
                    insertedId: result.insertedId
                });
            } catch (error) {
                console.error('Error saving invoice:', error);
                res.status(500).json({ error: 'Internal Server Error during database insertion' });
            }
        });


        // 2. GET: to fetch all invoices from MongoDB
        app.get('/invoices', async (req, res) => {
            try {
                // Fetch all invoices sorted by descending order (newest first)
                const invoices = await invoiceCollection.find({}).sort({ _id: -1 }).toArray();
                
                res.status(200).json({
                    success: true,
                    data: invoices
                });
            } catch (error) {
                console.error('Error fetching invoices:', error);
                res.status(500).json({ error: 'Internal Server Error while fetching invoices' });
            }
        });
        

        // 3. DELETE: Delete invoice using the native MongoDB driver without Mongoose
        app.delete('/invoices/:id', async (req, res) => {
            try {
                const { id } = req.params;
                
                let queryConditions = [{ invoiceNo: id }];
                
                if (ObjectId.isValid(id)) {
                    queryConditions.push({ _id: new ObjectId(id) });
                }

                const result = await invoiceCollection.findOneAndDelete({
                    $or: queryConditions
                });

                const deletedInvoice = result.value || result;

                if (!deletedInvoice) {
                    return res.status(404).json({ success: false, error: 'Invoice not found!' });
                }

                res.status(200).json({
                    success: true,
                    message: 'Invoice successfully deleted!',
                    data: deletedInvoice
                });
            } catch (err) {
                console.error('Delete Error:', err.message);
                res.status(500).json({ success: false, error: err.message });
            }
        });

        
        // 1. POST: Add a new product to inventory
        app.post('/products', async (req, res) => {
            try {
                const productData = req.body;
                
                // Boundary check
                if (!productData.name || productData.stock === undefined || productData.sellPrice === undefined) {
                    return res.status(400).json({ success: false, error: 'Required fields are missing' });
                }
                
                productData.createdAt = new Date();
                const result = await productCollection.insertOne(productData);
                
                res.status(201).json({
                    success: true,
                    message: 'Product added successfully',
                    insertedId: result.insertedId,
                    data: { ...productData, _id: result.insertedId }
                });
            } catch (error) {
                console.error('Error adding product:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });

        // 2. GET: Fetch all inventory products
        app.get('/products', async (req, res) => {
            try {
                const result = await productCollection.find({}).sort({ _id: -1 }).toArray();
                res.status(200).json({ success: true, data: result });
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });

        // 3. PATCH: Update product stock quantity (Increment / Decrement)
        app.patch('/products/:id/stock', async (req, res) => {
            try {
                const { id } = req.params;
                const { amount } = req.body; // e.g. +5 or -2

                if (typeof amount !== 'number') {
                    return res.status(400).json({ success: false, error: 'Invalid amount provided' });
                }

                let query = {};
                if (ObjectId.isValid(id)) {
                    query = { _id: new ObjectId(id) };
                } else {
                    query = { id: id };
                }

                // First find the product to check current stock
                const product = await productCollection.findOne(query);
                if (!product) {
                    return res.status(404).json({ success: false, error: 'Product not found!' });
                }

                const newStock = Number(product.stock) + amount;
                if (newStock < 0) {
                    return res.status(400).json({ success: false, error: 'Stock cannot be negative!' });
                }

                const result = await productCollection.findOneAndUpdate(
                    query,
                    { $set: { stock: newStock } },
                    { returnDocument: 'after' }
                );

                const updatedProduct = result.value || result;

                res.status(200).json({
                    success: true,
                    message: 'Stock updated successfully',
                    data: updatedProduct
                });
            } catch (error) {
                console.error('Error updating stock:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });
        
        // 4. DELETE: Remove inventory product by ID (handles both MongoDB ObjectId and string id)
        app.delete('/products/:id', async (req, res) => {
            try {
                const { id } = req.params;
                let query = {};

                if (ObjectId.isValid(id)) {
                    query = { _id: new ObjectId(id) };
                } else {
                    query = { id: id }; // Fallback if old dummy numeric id is passed
                }

                const result = await productCollection.findOneAndDelete(query);
                const deletedProduct = result.value || result;

                if (!deletedProduct) {
                    return res.status(404).json({ success: false, error: 'Product not found!' });
                }

                res.status(200).json({
                    success: true,
                    message: 'Product deleted successfully',
                    data: deletedProduct
                });
            } catch (err) {
                console.error('Delete Product Error:', err.message);
                res.status(500).json({ success: false, error: err.message });
            }
        });


        // 1. POST: Create a new service ticket
        app.post('/services', async (req, res) => {
            try {
                const ticketData = req.body;
                
                if (!ticketData.customerName || !ticketData.phone || !ticketData.deviceModel || !ticketData.issue) {
                    return res.status(400).json({ success: false, error: 'Required fields are missing' });
                }

                ticketData.createdAt = new Date();
                const result = await serviceCollection.insertOne(ticketData);
                
                res.status(201).json({
                    success: true,
                    message: 'Service ticket created successfully',
                    data: { ...ticketData, _id: result.insertedId }
                });
            } catch (error) {
                console.error('Error creating service ticket:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });

        // 2. GET: Fetch all service tickets
        app.get('/services', async (req, res) => {
            try {
                const tickets = await serviceCollection.find({}).sort({ _id: -1 }).toArray();
                res.status(200).json({ success: true, data: tickets });
            } catch (error) {
                console.error('Error fetching service tickets:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });

        // 3. PATCH: Update service ticket status
        app.patch('/services/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                let query = {};
                if (ObjectId.isValid(id)) {
                    query = { _id: new ObjectId(id) };
                } else {
                    query = { id: id };
                }

                const result = await serviceCollection.findOneAndUpdate(
                    query,
                    { $set: { status: status } },
                    { returnDocument: 'after' }
                );

                const updatedTicket = result.value || result;

                if (!updatedTicket) {
                    return res.status(404).json({ success: false, error: 'Service ticket not found!' });
                }

                res.status(200).json({
                    success: true,
                    message: 'Status updated successfully',
                    data: updatedTicket
                });
            } catch (error) {
                console.error('Error updating status:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });



        // GET: Fetch dynamic analytics / stats from database
        app.get('/analytics/stats', async (req, res) => {
            try {
                const productCollection = client.db('ITZoneInvoiceDB').collection('products');
                const serviceCollection = client.db('ITZoneInvoiceDB').collection('services');
                const invoiceCollection = client.db('ITZoneInvoiceDB').collection('invoices');

                // 1. Total Products Count
                const totalProducts = await productCollection.countDocuments();

                // 2. Service Counts
                const activeServices = await serviceCollection.countDocuments({ status: { $ne: 'Delivered' } });
                const readyServices = await serviceCollection.countDocuments({ status: 'Ready for Delivery' });

                // 3. Today's Sales Calculation from Invoices
                // Assuming invoices store date as 'YYYY-MM-DD' string or ISODate 'createdAt'
                const todayStr = new Date().toISOString().split('T')[0];
                
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                const todaysInvoices = await invoiceCollection.find({
                    $or: [
                        { date: todayStr },
                        { createdAt: { $gte: startOfDay, $lte: endOfDay } }
                    ]
                }).toArray();

                // Sum up grandTotal / total from today's invoices
                const todaysSales = todaysInvoices.reduce((sum, inv) => {
                    const amount = Number(inv.grandTotal || inv.total || inv.totalAmount) || 0;
                    return sum + amount;
                }, 0);

                res.status(200).json({
                    success: true,
                    data: {
                        todaysSales,
                        activeServicesCount: activeServices,
                        readyServicesCount: readyServices,
                        totalProductsCount: totalProducts
                    }
                });
            } catch (error) {
                console.error('Error fetching analytics stats:', error);
                res.status(500).json({ success: false, error: 'Internal Server Error' });
            }
        });



    }
    finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('IT Zone Invoice Server is running!')
})

app.listen(port, () => {
    console.log(`IT Zone Invoice app is listening on port ${port}`)
})
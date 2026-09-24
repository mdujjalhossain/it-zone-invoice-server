const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 3000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 
        'https://itzone-invoice.web.app', 
        'https://itzone-invoice.firebaseapp.com'],
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

        // 3. PATCH: Update product stock quantity (Fixed with proper field fallback)
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

                const product = await productCollection.findOne(query);
                if (!product) {
                    return res.status(404).json({ success: false, error: 'Product not found!' });
                }

                // Fallback between stock and quantity to prevent NaN/undefined issues
                const currentStock = Number(product.stock ?? product.quantity ?? 0);
                const newStock = currentStock + amount;
                
                if (newStock < 0) {
                    return res.status(400).json({ success: false, error: 'Stock cannot be negative!' });
                }

                const result = await productCollection.findOneAndUpdate(
                    query,
                    { $set: { stock: newStock, quantity: newStock } }, // Sync both fields to avoid mismatch
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

        // 4. DELETE: Remove inventory product by ID (Robust Native Driver implementation)
        app.delete('/products/:id', async (req, res) => {
            try {
                const { id } = req.params;
                let query = {};

                if (ObjectId.isValid(id)) {
                    query = { _id: new ObjectId(id) };
                } else {
                    query = { id: id };
                }

                const result = await productCollection.findOneAndDelete(query);
                // Handle different MongoDB driver version result wrappers
                const deletedProduct = result.value || result.ok ? result.value || query : null;

                if (!deletedProduct && !result) {
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


        // POST: Handle Service Invoices from POS Screen
        app.post('/service-invoices', async (req, res) => {
            try {
                const { invoiceNo, currentDate, customer, items, subtotal, discountVal, totalPayable, ticketId } = req.body;

                if (!Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({ success: false, error: 'Service invoice must contain items.' });
                }

                // 1. Save to Invoice Collection (For POS / Invoice History view)
                const newInvoice = {
                    invoiceNo,
                    currentDate,
                    customer,
                    items,
                    subtotal,
                    discountVal,
                    totalPayable,
                    ticketId: ticketId || null,
                    salesType: 'service',
                    createdAt: new Date()
                };

                const invoiceResult = await invoiceCollection.insertOne(newInvoice);

                // 2. Sync with serviceCollection
                if (ticketId) {
                    // If billed via an existing ticket selected in POS dropdown
                    let ticketQuery = {};
                    if (ObjectId.isValid(ticketId)) {
                        ticketQuery = { _id: new ObjectId(ticketId) };
                    } else {
                        ticketQuery = { id: ticketId };
                    }

                    await serviceCollection.findOneAndUpdate(
                        ticketQuery,
                        { $set: { status: 'Delivered', cost: totalPayable } }
                    );
                } else {
                    // Fallback: Direct POS service billing without prior ticket creation
                    const serviceTicket = {
                        id: invoiceNo, // Using invoiceNo as the ticket ID for direct POS sales
                        invoiceNo,
                        customerName: customer?.name || 'Walk-in Customer',
                        phone: customer?.phone || 'N/A',
                        deviceModel: items[0]?.deviceModel || 'General Service / POS Sale',
                        issue: items.map(i => i.productName || i.name).join(', '),
                        status: 'Delivered', // Direct POS billing implies service is completed/delivered
                        cost: totalPayable,
                        advance: totalPayable, // Full paid on POS
                        date: currentDate,
                        createdAt: new Date()
                    };

                    await serviceCollection.insertOne(serviceTicket);
                }

                res.status(201).json({
                    success: true,
                    message: 'Service invoice saved and synced with service tracking successfully',
                    data: { ...newInvoice, _id: invoiceResult.insertedId }
                });
            } catch (error) {
                console.error('Service invoice sync error:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });


        // GET: Fetch dynamic analytics / stats from database (Separated Product & Service Revenue)
        app.get('/analytics/stats', async (req, res) => {
            try {
                // 1. Local date calculation for Bangladesh timezone (UTC+6)
                const d = new Date();
                const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
                const todayStr = localDate.toISOString().split('T')[0];

                // Fetch today's invoices based on salesType or lack of salesType field
                const allTodayInvoices = await invoiceCollection.find({ currentDate: todayStr }).toArray();
                
                // Separate Product Sales and Service Invoices
                const productInvoices = allTodayInvoices.filter(inv => inv.salesType === 'product' || !inv.salesType);
                const serviceInvoices = allTodayInvoices.filter(inv => inv.salesType === 'service');

                const todaysSales = productInvoices.reduce((sum, inv) => sum + (Number(inv.totalPayable) || 0), 0);
                const todaysServiceRevenue = serviceInvoices.reduce((sum, inv) => sum + (Number(inv.totalPayable) || 0), 0);

                // 2. Active Services Count (excluding Delivered and Cancelled)
                const activeServicesCount = await serviceCollection.countDocuments({
                    status: { $nin: ['Delivered', 'Cancelled'] }
                });

                // 3. Ready for delivery count
                const readyServicesCount = await serviceCollection.countDocuments({
                    status: 'Ready for Delivery'
                });

                // 4. Total products count from inventory
                const totalProductsCount = await productCollection.countDocuments();

                res.status(200).json({
                    success: true,
                    data: {
                        todaysSales,
                        todaysServiceRevenue,
                        activeServicesCount,
                        readyServicesCount,
                        totalProductsCount
                    }
                });
            } catch (err) {
                console.error('Analytics stats fetch error:', err.message);
                res.status(500).json({ success: false, error: err.message });
            }
        });


        // POST: Invoice with atomic stock decrement and dual-field synchronization
        app.post('/invoices-with-stock', async (req, res) => {
            const session = client.startSession();
            try {
                session.startTransaction();
                const { invoiceNo, currentDate, customer, items, subtotal, discountVal, totalPayable } = req.body;

                // Strict boundary check for items array
                if (!Array.isArray(items) || items.length === 0) {
                    throw new Error('Invoice payload must contain a valid non-empty items array.');
                }

                // 1. Verify and decrement stock for each item
                for (const item of items) {
                    if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
                        throw new Error('Invalid product reference or quantity in invoice items.');
                    }

                    let productQuery = {};
                    if (ObjectId.isValid(item.productId)) {
                        productQuery = { _id: new ObjectId(item.productId) };
                    } else {
                        productQuery = { id: item.productId };
                    }

                    const product = await productCollection.findOne(productQuery, { session });
                    
                    // Fix: Check if product exists FIRST before evaluating properties
                    if (!product) {
                        throw new Error(`Product not found with reference: ${item.productId}`);
                    }

                    // Fallback between stock and quantity to ensure safe calculation
                    const currentStock = Number(product.stock ?? product.quantity ?? 0);
                    if (currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for item: ${product.name || item.productName || item.name}`);
                    }

                    const newStock = currentStock - item.quantity;
                    
                    // Sync both fields to maintain data consistency across different collection queries
                    await productCollection.findOneAndUpdate(
                        productQuery,
                        { $set: { stock: newStock, quantity: newStock } },
                        { session }
                    );
                }

                // 2. Save Invoice
                const newInvoice = {
                    invoiceNo,
                    currentDate,
                    customer,
                    items,
                    subtotal,
                    discountVal,
                    totalPayable,
                    createdAt: new Date()
                };

                const result = await invoiceCollection.insertOne(newInvoice, { session });

                await session.commitTransaction();
                session.endSession();
                
                res.status(201).json({ 
                    success: true,
                    message: 'Invoice saved and inventory updated successfully', 
                    data: { ...newInvoice, _id: result.insertedId } 
                });
            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                console.error('Invoice with stock transaction error:', error.message);
                res.status(400).json({ success: false, error: error.message });
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
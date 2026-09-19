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

        // POST Endpoint to save invoice data from POS Screen
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


        // GET Endpoint to fetch all invoices from MongoDB
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
        

        // DELETE: Delete invoice using the native MongoDB driver without Mongoose
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
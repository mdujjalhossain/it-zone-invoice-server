const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
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
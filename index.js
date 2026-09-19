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
const express = require('express');
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




async function run() {
    try {
        



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
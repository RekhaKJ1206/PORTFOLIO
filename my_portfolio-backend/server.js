const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const Contact = require('./models/Contact');

const app = express();
const PORT = process.env.PORT || 5000;

// Track MongoDB connection status
let mongoConnected = false;

// MIDDLEWARE
app.use(bodyParser.json());
app.use(cors());

// HEALTH CHECK ROUTE (for Render to verify app is running)
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Server is running',
        mongoConnected: mongoConnected
    });
});

// STATUS ENDPOINT
app.get('/api/status', (req, res) => {
    res.status(200).json({ 
        status: 'running',
        mongoConnected: mongoConnected,
        timestamp: new Date().toISOString()
    });
});

// CONNECT TO MONGODB (non-blocking)
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
    })
    .then(() => {
        mongoConnected = true;
        console.log('✅ MongoDB connected');
    })
    .catch(err => {
        mongoConnected = false;
        console.log('⚠️ MongoDB connection failed:', err.message);
        console.log('Server will continue running with limited functionality');
    });
} else {
    console.log('⚠️ MONGO_URI not set. MongoDB features disabled.');
}

// ROUTE TO SAVE CONTACT
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if MongoDB is connected
    if (!mongoConnected) {
        return res.status(503).json({ 
            error: 'Database temporarily unavailable. Please try again later.',
            mongoConnected: false
        });
    }

    try {
        const newContact = new Contact({ name, email, message });
        await newContact.save();
        res.status(200).json({ message: 'Message sent successfully!' });
    } catch (err) {
        console.error('Error saving contact:', err);
        res.status(500).json({ error: 'Server error while saving contact' });
    }
});

// GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    mongoose.connection.close();
    process.exit(0);
});

// START SERVER
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
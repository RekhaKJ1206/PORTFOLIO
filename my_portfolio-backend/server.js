const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Try to load Contact model, but don't crash if it fails
let Contact;
try {
    Contact = require('./models/Contact');
} catch (err) {
    console.log('⚠️ Warning: Could not load Contact model:', err.message);
    Contact = null;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Track MongoDB connection status
let mongoConnected = false;

// CORS Configuration - Allow local dev and production origins
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'https://RekhaKJ1206.github.io',
            'https://rekha-portfolio-app.onrender.com'
        ];
        
        console.log('📨 CORS Request from origin:', origin);
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            console.log('✅ CORS allowed for:', origin);
            callback(null, true);
        } else {
            console.log('❌ CORS blocked for:', origin);
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
    maxAge: 3600
};

// MIDDLEWARE
app.use(bodyParser.json());
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

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

    // Check if Contact model is available
    if (!Contact) {
        return res.status(503).json({
            error: 'Contact service temporarily unavailable. Please try again later.',
            service: false
        });
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

// Handle uncaught errors to prevent app exit
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Server continues running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Server continues running
});

// START SERVER
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Set server timeout to prevent early exits
server.timeout = 120000;
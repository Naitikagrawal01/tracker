require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // HTTP module for Socket.io
const { Server } = require('socket.io'); // Import Socket.io

// Import routes
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io server
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for hackathon simplicity
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Import the API controller so we can use its calculateCrowdData method for our periodic interval
const apiController = require('./controllers/apiController');

// Configure socket connections
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// Fix 2B: Interval Broadcaster
// We broadcast the active map to ALL clients every 3 seconds silently,
// decoupling the database map-reduce operation from the heavy stream of POST requests.
setInterval(async () => {
  try {
    const data = await apiController.calculateCrowdData();
    io.emit('crowd-update', data);
  } catch (error) {
    console.error("Interval Broadcast Error (calculateCrowdData):", error);
  }
}, 3000);

// Middleware
// cors helps allow requests from our future frontend
app.use(cors());
// express.json() parses incoming JSON payloads
app.use(express.json()); 

// Attach io to the request object so our controllers can emit events!
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect main router under the /api namespace
app.use('/api', apiRoutes);

// Root/Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Crowd Safety API is alive and running with Socket.io!' });
});

// Configure MongoDB connection
// In a real environment we'd use process.env.MONGO_URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crowd-safety';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
    
    // IMPORTANT: Start the HTTP `server` (not `app`) so Socket.io works
    // Fix 4: Add Auto-Recovery for EADDRINUSE
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        const fallbackPort = 5001;
        console.log(`🔄 Attempting to listen on fallback port ${fallbackPort}...`);
        setTimeout(() => {
          server.close();
          server.listen(fallbackPort, () => {
            console.log(`🚀 Server listening on fallback http://localhost:${fallbackPort}`);
          });
        }, 1000);
      } else {
        console.error('❌ Server startup error:', e);
      }
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1); 
  });

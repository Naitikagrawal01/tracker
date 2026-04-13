require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import routes & controllers
const apiRoutes = require('./routes/apiRoutes');
const apiController = require('./controllers/apiController');
const Incident = require('./models/Incident');
const { findNearbySockets, calculatePredictions } = require('./utils/crowdAnalytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// ─── Live Socket Tracking Maps ───
const socketLocations = new Map(); // socketId → { userId, lat, lng }
const locationHistory = new Map(); // userId → [{ lat, lng, timestamp }, ...]

// ─── Socket.IO Connection Handler ───
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Phase 2: Register user position for proximity-based alerting
  socket.on('register_location', ({ userId, lat, lng }) => {
    socketLocations.set(socket.id, { userId, lat, lng, timestamp: Date.now() });

    // Phase 3: Track movement history for predictive analysis (keep last 5 entries)
    if (!locationHistory.has(userId)) locationHistory.set(userId, []);
    const hist = locationHistory.get(userId);
    hist.push({ lat, lng, timestamp: Date.now() });
    if (hist.length > 5) hist.shift();
  });

  // Phase 2: Hazard Report via Socket.IO
  socket.on('hazard_report', async ({ type, lat, lng, userId }) => {
    console.log(`⚠️  Hazard: "${type}" at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    try {
      await new Incident({
        reportId: userId || `anon-${Date.now()}`,
        lat, lng,
        description: type,
        riskLevel: 'HIGH'
      }).save();
    } catch (err) {
      console.error('Failed to save hazard:', err.message);
    }

    // Alert all clients within 500m radius
    const nearby = findNearbySockets(socketLocations, lat, lng, 500);
    nearby.forEach(sid => {
      if (sid !== socket.id) {
        io.to(sid).emit('emergency_alert', {
          type: 'hazard',
          category: type,
          lat, lng,
          message: `⚠️ ${type} reported nearby — stay alert!`,
          severity: 'warning',
          timestamp: Date.now()
        });
      }
    });
  });

  // Phase 2: SOS Panic Alert via Socket.IO
  socket.on('sos_alert', async ({ lat, lng, userId }) => {
    console.log(`🚨 SOS from ${userId} at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    try {
      await new Incident({
        reportId: userId || `anon-${Date.now()}`,
        lat, lng,
        description: 'SOS EMERGENCY',
        riskLevel: 'CRITICAL'
      }).save();
    } catch (err) {
      console.error('Failed to save SOS:', err.message);
    }

    // SOS broadcasts to ALL connected clients universally
    socket.broadcast.emit('emergency_alert', {
      type: 'sos',
      lat, lng,
      message: '🚨 SOS EMERGENCY — Someone nearby needs immediate help!',
      severity: 'critical',
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    socketLocations.delete(socket.id);
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// Attach io to req for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Routes ───
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'CrowdSafe API running with Socket.IO + Risk Escalation + SOS' });
});

// ─── Start Server (called after DB connected) ───
function startServer() {
  // Broadcast crowd data + predictions every 3 seconds
  setInterval(async () => {
    try {
      const data = await apiController.calculateCrowdData();
      io.emit('crowd-update', data);

      // Phase 3: Predictive analysis — flag zones likely to escalate
      const predictions = calculatePredictions(locationHistory, data.crowdData);
      if (predictions.length > 0) {
        io.emit('predictive_warning', predictions);
      }
    } catch (error) {
      console.error('Interval Error:', error.message);
    }
  }, 3000);

  // Port fallback: 5000 → 5001
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} in use.`);
      const fallback = 5001;
      console.log(`🔄 Trying fallback port ${fallback}...`);
      setTimeout(() => {
        server.close();
        server.listen(fallback, () => {
          console.log(`🚀 Server on fallback http://localhost:${fallback}`);
        });
      }, 1000);
    } else {
      console.error('❌ Server error:', e);
    }
  });

  server.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

// ─── MongoDB with In-Memory Fallback ───
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crowd-safety';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');
    startServer();
  } catch (err) {
    if (err.message && err.message.includes('ECONNREFUSED')) {
      console.warn('⚠️  MongoDB unavailable — starting in-memory instance...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const memUri = mongod.getUri();
        await mongoose.connect(memUri);
        console.log('✅ In-Memory MongoDB ready.');
        console.log(`   URI: ${memUri}`);
        startServer();
      } catch (memErr) {
        console.error('❌ In-Memory MongoDB failed:', memErr);
        process.exit(1);
      }
    } else {
      console.error('❌ MongoDB error:', err);
      process.exit(1);
    }
  }
}

connectDB();

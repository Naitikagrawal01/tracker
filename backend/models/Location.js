const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // TTL index ensures automatic deletion of old location data after 15 minutes,
  // keeping the crowd mapping strictly realtime.
  timestamp: { type: Date, default: Date.now, index: { expires: '15m' } }
});

module.exports = mongoose.model('Location', locationSchema);

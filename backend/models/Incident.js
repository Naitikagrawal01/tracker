const mongoose = require('mongoose');

// Schema to store explicitly reported danger incidents
const incidentSchema = new mongoose.Schema({
  reportId: { type: String, required: true }, // Identifier for the user/reporter
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  description: { type: String, required: true }, // E.g., 'stampede', 'fire alert'
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  // Incidents also expire automatically after an hour to keep data clean, or they can persist
  timestamp: { type: Date, default: Date.now, index: { expires: '1h' } }
}, { collection: 'incidents' });

module.exports = mongoose.model('Incident', incidentSchema);

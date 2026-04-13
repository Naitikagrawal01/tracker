const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// 1. POST /location-update - Store/update user location
router.post('/location-update', apiController.updateLocation);

// Fix 3: GET /api/zones - Aggregated zones with dynamic riskLevel
router.get('/zones', apiController.getZones);

// 2. GET /crowd-data - Return all locations with crowd count
router.get('/crowd-data', apiController.getCrowdData);

// 3. GET /alerts - Return high-risk areas
router.get('/alerts', apiController.getAlerts);

// 4. POST /report - User reports danger at a location
router.post('/report', apiController.reportIncident);

module.exports = router;

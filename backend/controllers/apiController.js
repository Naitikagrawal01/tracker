const Location = require('../models/Location');
const Incident = require('../models/Incident');

// Helper function to calculate crowd data - Exported for the server interval broadcaster
exports.calculateCrowdData = async () => {
  // Phase 1: Updated aggregation with ~55m grid cells (factor 2000)

  // 1. Get total active users
  const totalActiveUsers = await Location.countDocuments({});

  // 2. Aggregation to group users into ~55m grid cells
  const aggregationPipeline = [
    {
      $group: {
        _id: {
          lat: { $divide: [{ $round: [{ $multiply: ["$lat", 2000] }, 0] }, 2000] },
          lng: { $divide: [{ $round: [{ $multiply: ["$lng", 2000] }, 0] }, 2000] }
        },
        crowdCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        lat: "$_id.lat",
        lng: "$_id.lng",
        crowdCount: 1
      }
    }
  ];

  const groupedLocations = await Location.aggregate(aggregationPipeline);

  // 3. Phase 1: Updated Risk Thresholds
  //    < 5 = LOW | 5-14 = MEDIUM | 15-24 = HIGH | 25+ = CRITICAL
  const crowdData = groupedLocations.map(area => {
    let riskLevel = 'LOW';
    if (area.crowdCount >= 25) riskLevel = 'CRITICAL';
    else if (area.crowdCount >= 15) riskLevel = 'HIGH';
    else if (area.crowdCount >= 5) riskLevel = 'MEDIUM';
    return { ...area, riskLevel };
  });

  return { totalActiveUsers, crowdData };
};

// 1. POST /location-update
exports.updateLocation = async (req, res) => {
  try {
    const { userId, lat, lng } = req.body;
    
    if (!userId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing userId, lat, or lng" });
    }

    // Upsert updates the user's location if they exist, or creates a new entry if they don't.
    // The timestamp will be automatically updated as well for the TTL index.
    await Location.findOneAndUpdate(
      { userId },
      { lat, lng, timestamp: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Location updated successfully" });
  } catch (error) {
    console.error("Location update error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET /crowd-data
exports.getCrowdData = async (req, res) => {
  try {
    const data = await exports.calculateCrowdData();
    res.json(data);
  } catch (error) {
    console.error("Crowd data error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. GET /alerts
exports.getAlerts = async (req, res) => {
  try {
    // 1st: Identify high risk areas based on our standard grouping logic
    const locations = await Location.find({});
    const grid = {};
    
    locations.forEach(loc => {
      const gridLat = Math.round(loc.lat * 2000) / 2000;
      const gridLng = Math.round(loc.lng * 2000) / 2000;
      const key = `${gridLat},${gridLng}`;
      if (!grid[key]) grid[key] = { lat: gridLat, lng: gridLng, count: 0 };
      grid[key].count += 1;
    });

    const highRiskCrowds = Object.values(grid)
      .filter(area => area.count >= 15)
      .map(area => ({
        lat: area.lat,
        lng: area.lng,
        type: 'dangerously_crowded',
        riskLevel: 'high',
        description: `High crowd density detected (${area.count} users)`
      }));

    // 2nd: Append explicitly reported "high" risk incidents from users
    const reportedIncidents = await Incident.find({ riskLevel: 'high' });
    
    const formattedIncidents = reportedIncidents.map(inc => ({
      lat: inc.lat,
      lng: inc.lng,
      type: 'user_reported',
      riskLevel: inc.riskLevel,
      description: inc.description
    }));

    res.json({ 
      alerts: [...highRiskCrowds, ...formattedIncidents]
    });
  } catch (error) {
    console.error("Alerts fetching error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 4. POST /report
exports.reportIncident = async (req, res) => {
  console.log("➡️ Entering reportIncident controller");
  try {
    const { reportId, lat, lng, description, riskLevel } = req.body;
    console.log("📥 Incoming Report Data:", req.body);
    
    if (lat === undefined || lng === undefined || !description) {
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({ error: "Missing lat, lng, or description" });
    }

    const incident = new Incident({
      reportId: reportId || `anon-${Date.now()}`,
      lat,
      lng,
      description,
      riskLevel: riskLevel || 'HIGH'
    });

    console.log("💾 Saving incident to MongoDB...");
    await incident.save();
    console.log("✅ Incident saved:", incident);

    res.json({ success: true, message: "Incident reported successfully", incident });
  } catch (error) {
    console.error("❌ Incident reporting error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 5. GET /api/zones
exports.getZones = async (req, res) => {
  try {
    const aggregationPipeline = [
      {
        $group: {
          _id: {
            lat: { $divide: [{ $round: [{ $multiply: ["$lat", 2000] }, 0] }, 2000] },
            lng: { $divide: [{ $round: [{ $multiply: ["$lng", 2000] }, 0] }, 2000] }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          lat: "$_id.lat",
          lng: "$_id.lng",
          count: 1
        }
      }
    ];

    const groupedLocations = await Location.aggregate(aggregationPipeline);

    const zones = groupedLocations.map(area => {
      let riskLevel = 'LOW';
      if (area.count >= 25) riskLevel = 'CRITICAL';
      else if (area.count >= 15) riskLevel = 'HIGH';
      else if (area.count >= 5) riskLevel = 'MEDIUM';

      return {
        lat: area.lat,
        lng: area.lng,
        count: area.count,
        riskLevel
      };
    });

    res.json(zones);
  } catch (error) {
    console.error("Zones fetching error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

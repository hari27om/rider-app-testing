import express from "express";
import RiderLocation from "../models/riderLocationSchema.js";
import User from "../models/userModel.js";

const router = express.Router();

router.get("/active-riders", async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeRiders = await RiderLocation.aggregate([
      { $match: { lastUpdate: { $gte: fiveMinutesAgo }, status: { $in: ["active", "on-delivery", "on-pickup"] } } },
      { $sort: { lastUpdate: -1 } },
      { $group: { _id: "$riderId", latestLocation: { $first: "$$ROOT" } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "riderDetails" } },
      { $unwind: "$riderDetails" },
      {
        $project: {
          riderId: "$_id",
          name: "$riderDetails.name",
          phone: "$riderDetails.phone",
          lat: { $arrayElemAt: ["$latestLocation.location.coordinates", 1] },
          lng: { $arrayElemAt: ["$latestLocation.location.coordinates", 0] },
          speed: "$latestLocation.speed",
          bearing: "$latestLocation.bearing",
          status: "$latestLocation.status",
          lastUpdate: "$latestLocation.lastUpdate",
        }
      }
    ]);

    res.status(200).json({ success: true, count: activeRiders.length, riders: activeRiders });
  } catch (error) {
    console.error("Error fetching active riders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rider history
router.get("/rider/:riderId/history", async (req, res) => {
  try {
    const { riderId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    let query = { riderId };

    if (startDate || endDate) {
      query.lastUpdate = {};
      if (startDate) query.lastUpdate.$gte = new Date(startDate);
      if (endDate) query.lastUpdate.$lte = new Date(endDate);
    }

    const history = await RiderLocation.find(query)
      .sort({ lastUpdate: -1 })
      .limit(parseInt(limit))
      .select("location speed bearing status lastUpdate");

    const formattedHistory = history.map(loc => ({
      lat: loc.location.coordinates[1],
      lng: loc.location.coordinates[0],
      speed: loc.speed,
      bearing: loc.bearing,
      status: loc.status,
      timestamp: loc.lastUpdate,
    }));

    res.status(200).json({ success: true, count: formattedHistory.length, history: formattedHistory });
  } catch (error) {
    console.error("Error fetching rider history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rider current
router.get("/rider/:riderId/current", async (req, res) => {
  try {
    const { riderId } = req.params;

    const latestLocation = await RiderLocation.findOne({ riderId })
      .sort({ lastUpdate: -1 })
      .limit(1)
      .populate("riderId", "name phone");

    if (!latestLocation) return res.status(404).json({ success: false, message: "Rider location not found" });

    res.status(200).json({
      success: true,
      rider: {
        riderId,
        name: latestLocation.riderId?.name,
        phone: latestLocation.riderId?.phone,
        lat: latestLocation.location.coordinates[1],
        lng: latestLocation.location.coordinates[0],
        speed: latestLocation.speed,
        bearing: latestLocation.bearing,
        status: latestLocation.status,
        lastUpdate: latestLocation.lastUpdate,
      }
    });
  } catch (error) {
    console.error("Error fetching current location:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Manual status update (admin)
router.post("/rider/:riderId/status", async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body;

    if (!status || !["active", "idle", "offline", "on-delivery", "on-pickup"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const rider = await User.findById(riderId);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    await RiderLocation.create({
      riderId,
      name: rider.name,
      phone: rider.phone,
      location: { type: "Point", coordinates: [0, 0] },
      status,
      lastUpdate: new Date(),
    });

    res.status(200).json({ success: true, message: `Rider status updated to ${status}` });
  } catch (error) {
    console.error("Error updating rider status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Dashboard stats
router.get("/dashboard-stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await RiderLocation.aggregate([
      { $match: { lastUpdate: { $gte: today } } },
      { $group: { _id: { riderId: "$riderId", status: "$status" }, lastUpdate: { $max: "$lastUpdate" } } },
      { $group: { _id: "$_id.status", count: { $sum: 1 } } }
    ]);

    const totalRidersToday = await RiderLocation.distinct("riderId", { lastUpdate: { $gte: today } });

    res.status(200).json({
      success: true,
      stats: {
        totalRiders: totalRidersToday.length,
        byStatus: stats.reduce((acc, stat) => { acc[stat._id] = stat.count; return acc; }, {}),
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
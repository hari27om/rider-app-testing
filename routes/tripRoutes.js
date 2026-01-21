import express from "express";
import Trip from "../models/Trip.js";
import LocationPoint from "../models/LocationPoint.js";
import geolib from "geolib";

const router = express.Router();

// NOTE: reuse your existing auth middleware where available. 
// This snippet assumes req.user is set (e.g. { id: <ObjectId>, ... }).
// If you don't have that, use your JWT verify logic to set req.user first.

function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();
  // fallback: allow providing riderId in body for demo mode
  if (req.body && req.body.riderId) {
    // not secure — prefer jwt to set req.user
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// Start trip
router.post("/start", requireAuth, async (req, res) => {
  try {
    const riderId = req.user?.id || req.body.riderId;
    if (!riderId) return res.status(400).json({ error: "riderId required" });

    const trip = new Trip({ riderId });
    await trip.save();

    // notify rider/admin rooms if needed
    if (req.socket) {
      req.socket.to(`rider:${riderId}`).emit("trip:started", { tripId: trip._id, riderId });
    }

    res.json({ ok: true, tripId: trip._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to create trip" });
  }
});

// Accept single location point
router.post("/location", requireAuth, async (req, res) => {
  try {
    const { tripId, latitude, longitude, timestamp, speed, accuracy } = req.body;
    if (!tripId || typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ error: "tripId, latitude and longitude are required" });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (trip.status === "completed") return res.status(400).json({ error: "Trip already completed" });

    const riderId = req.user?.id || req.body.riderId;
    const point = new LocationPoint({
      tripId,
      riderId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      lat: latitude,
      lng: longitude,
      speed,
      accuracy
    });
    await point.save();

    // compute incremental distance using geolib
    const prev = await LocationPoint.findOne({ tripId }).sort({ timestamp: -1 }).skip(1);
    let addedMeters = 0;
    if (prev) {
      if (!(point.accuracy && point.accuracy > 100)) {
        addedMeters = geolib.getDistance(
          { latitude: prev.lat, longitude: prev.lng },
          { latitude: point.lat, longitude: point.lng }
        );
        // ignore suspicious spikes
        if (addedMeters <= 1000 && addedMeters > 0) {
          await Trip.findByIdAndUpdate(tripId, { $inc: { totalDistanceMeters: addedMeters }});
        } else {
          addedMeters = 0;
        }
      }
    }

    // broadcast to admin clients subscribed to this trip
    if (req.socket) {
      req.socket.to(`trip:${tripId}`).emit("location:update", {
        tripId,
        lat: point.lat,
        lng: point.lng,
        timestamp: point.timestamp,
        speed: point.speed,
        accuracy: point.accuracy
      });

      // optionally notify rider room
      req.socket.to(`rider:${riderId}`).emit("location:ack", { tripId, lat: point.lat, lng: point.lng });
    }

    res.json({ ok: true, addedMeters });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to store location" });
  }
});

// End trip
router.post("/end", requireAuth, async (req, res) => {
  try {
    const { tripId } = req.body;
    if (!tripId) return res.status(400).json({ error: "tripId required" });

    const trip = await Trip.findByIdAndUpdate(tripId, { status: "completed", endedAt: new Date() }, { new: true });
    if (!trip) return res.status(404).json({ error: "trip not found" });

    if (req.socket) {
      req.socket.to(`trip:${tripId}`).emit("trip:ended", { tripId });
      req.socket.to(`rider:${trip.riderId}`).emit("trip:ended", { tripId });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to end trip" });
  }
});

// Admin: fetch all points for a trip (ordered)
router.get("/:tripId/points", async (req, res) => {
  try {
    const { tripId } = req.params;
    const points = await LocationPoint.find({ tripId }).sort({ timestamp: 1 }).lean();
    res.json({ ok: true, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch points" });
  }
});

export default router;
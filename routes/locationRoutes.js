// routes/locationRoutes.js
import express from 'express';
import Trip from '../models/Trip.js';
import TripPoint from '../models/TripPoint.js';
import { computeDistanceMeters } from '../services/distance.js';
import User from '../models/userModel.js'; // you already have this file

const router = express.Router();

router.post('/start-trip', async (req, res) => {
  try {
    const riderId = req.body.riderId;
    const metadata = req.body.metadata || {};

    if (!riderId) return res.status(400).json({ error: 'riderId required' });

    // optional: validate rider exists
    const rider = await User.findOne({ _id: riderId }) || await User.findOne({ phone: riderId }) || await User.findOne({ email: riderId });
    // ignore if not found; but you can enforce existence by uncommenting:
    // if (!rider) return res.status(404).json({ error: 'rider not found' });

    const trip = await Trip.create({ riderId, metadata });
    return res.json({ tripId: trip._id, startTime: trip.startTime });
  } catch (err) {
    console.error('start-trip error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tripId, riderId, latitude, longitude, timestamp, accuracy, speed } = req.body;
    if (!tripId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'tripId, latitude and longitude required' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });
    if (trip.status !== 'ongoing') return res.status(400).json({ error: 'trip not ongoing' });

    // find last point
    const lastPoint = await TripPoint.findOne({ tripId }).sort({ timestamp: -1 }).limit(1);

    const pointData = {
      tripId,
      riderId: riderId || trip.riderId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      accuracy,
      speed,
      raw: req.body
    };

    // compute incremental distance
    let addedDistance = 0;
    if (lastPoint) {
      addedDistance = computeDistanceMeters(
        { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
        { latitude: pointData.latitude, longitude: pointData.longitude }
      );
    }
    // filter micro jitter - ignore < 2 meters
    if (addedDistance < 2) addedDistance = 0;

    const savedPoint = await TripPoint.create(pointData);

    if (addedDistance > 0) {
      trip.totalDistance = (trip.totalDistance || 0) + addedDistance;
      await trip.save();
    }

    // Broadcast: uses req.socket (set by addSocketToRequest middleware)
    try {
      const io = req.socket;
      const payload = {
        tripId,
        point: {
          id: savedPoint._id,
          latitude: savedPoint.latitude,
          longitude: savedPoint.longitude,
          timestamp: savedPoint.timestamp,
          accuracy: savedPoint.accuracy,
          speed: savedPoint.speed
        },
        totalDistance: trip.totalDistance
      };

      // room for admins or dashboards: trip:<tripId>
      if (io) {
        io.to(`trip:${tripId}`).emit('location:update', payload);
        // also notify rider room if you use rider:<riderId>
        io.to(`rider:${trip.riderId}`).emit('rider:location', payload);
      }
    } catch (e) {
      console.warn('socket broadcast failed', e);
    }

    return res.json({ ok: true, addedDistance, totalDistance: trip.totalDistance });
  } catch (err) {
    console.error('location post error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/end-trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'trip not found' });

    trip.status = 'completed';
    trip.endTime = new Date();
    await trip.save();

    // notify sockets
    try {
      const io = req.socket;
      if (io) io.to(`trip:${tripId}`).emit('trip:ended', { tripId, endTime: trip.endTime, totalDistance: trip.totalDistance });
    } catch (e) { /* ignore */ }

    return res.json({ ok: true, tripId, totalDistance: trip.totalDistance });
  } catch (err) {
    console.error('end-trip error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
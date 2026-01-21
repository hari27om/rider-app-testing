// models/TripPoint.js
import mongoose from 'mongoose';

const TripPointSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  riderId: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  accuracy: { type: Number },
  speed: { type: Number },
  raw: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

TripPointSchema.index({ tripId: 1, timestamp: 1 });

export default mongoose.model('TripPoint', TripPointSchema);
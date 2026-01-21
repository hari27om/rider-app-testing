// models/LocationPoint.js
import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  speed: { type: Number },
  accuracy: { type: Number }
}, { timestamps: true });

export default mongoose.model("LocationPoint", LocationSchema);
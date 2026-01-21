import mongoose from "mongoose";
const TripSchema = new mongoose.Schema({
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
    totalDistanceMeters: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Trip", TripSchema);
import mongoose from 'mongoose';

const TripSchema = new mongoose.Schema({
    riderId: { type: String, required: true, index: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    totalDistance: { type: Number, default: 0 }, // meters
    status: { type: String, enum: ['ongoing', 'completed', 'cancelled'], default: 'ongoing' },
    metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model('Trip', TripSchema);
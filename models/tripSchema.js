// models/tripSchema.js
import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true }, // store exact start date/time
    startKm: { type: Number, required: true },
    startImage: { type: String, default: null },
    endKm: { type: Number, default: null },
    endImage: { type: String, default: null },
    distance: { type: Number, default: 0 }, // computed endKm - startKm
    status: {
      type: String,
      enum: ["started", "ended", "reset"],
      default: "started",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);

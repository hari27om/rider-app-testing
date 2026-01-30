import express from "express";
import {
  startTrip,
  endTrip,
  getTrips,
  resetTotalKm,
} from "../controller/tripController.js";

const router = express.Router();

router.post("/start", startTrip); // multipart: image -> field name "image", body: riderId, startKm
router.put("/:tripId/end", endTrip); // multipart: image -> field name "image", body: endKm
router.get("/", getTrips); // ?riderId=&date=YYYY-MM-DD
router.post("/reset", resetTotalKm); // { riderId }

export default router;
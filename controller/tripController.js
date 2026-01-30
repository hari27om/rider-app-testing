// controllers/tripController.js
import AWS from "aws-sdk";
import multer from "multer";
import Trip from "../models/tripSchema.js";
import User from "../models/userModel.js";
import catchAsync from "../utills/catchAsync.js";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});

// helper to upload single file buffer to S3 under a folder
const uploadToS3Buffer = (file, bucketName, folder = "riderTripPic") => {
  const params = {
    Bucket: bucketName,
    Key: `${folder}/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return s3.upload(params).promise();
};

// multer for single image (start or end)
const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 20 * 1024 * 1024 },
}).single("image");

// POST /trips/start
export const startTrip = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    const { riderId, startKm } = req.body;
    if (!riderId || startKm == null)
      return res.status(400).json({ message: "riderId and startKm are required" });

    // Prevent multiple open trips for the same rider (sane default)
    const open = await Trip.findOne({ rider: riderId, status: "started" });
    if (open) {
      return res
        .status(400)
        .json({ message: "Finish the previous trip before starting a new one." });
    }

    let startImageUrl = null;
    if (req.file) {
      const uploaded = await uploadToS3Buffer(
        req.file,
        process.env.AWS_S3_BUCKET_NAME,
        "riderTripPic/start"
      );
      startImageUrl = uploaded.Location;
    }

    const trip = await Trip.create({
      rider: riderId,
      date: new Date(),
      startKm: Number(startKm),
      startImage: startImageUrl,
      status: "started",
    });

    res.status(201).json({ message: "Trip started", trip });
  });
});

// PUT /trips/:tripId/end
export const endTrip = catchAsync(async (req, res, next) => {
  uploadSingleImage(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload error", err });

    const { tripId } = req.params;
    const { endKm } = req.body;
    if (!tripId || endKm == null)
      return res.status(400).json({ message: "tripId and endKm are required" });

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (trip.status !== "started")
      return res.status(400).json({ message: "Trip is not in started state" });

    const numericEndKm = Number(endKm);
    if (numericEndKm < trip.startKm) {
      return res
        .status(400)
        .json({ message: "endKm must be greater than or equal to startKm" });
    }

    let endImageUrl = null;
    if (req.file) {
      const uploaded = await uploadToS3Buffer(
        req.file,
        process.env.AWS_S3_BUCKET_NAME,
        "riderTripPic/end"
      );
      endImageUrl = uploaded.Location;
    }

    const distance = numericEndKm - trip.startKm;

    trip.endKm = numericEndKm;
    trip.endImage = endImageUrl;
    trip.distance = distance;
    trip.status = "ended";
    await trip.save();

    // increment user's totalKm (ensure field exists on user)
    await User.findByIdAndUpdate(trip.rider, { $inc: { totalKm: distance } }, { new: true });

    res.status(200).json({ message: "Trip ended", trip });
  });
});

// GET /trips?riderId=...&date=YYYY-MM-DD (optional date)
export const getTrips = catchAsync(async (req, res, next) => {
  const { riderId, date, page = 1, pageSize = 20 } = req.query;
  if (!riderId) return res.status(400).json({ message: "riderId required" });

  const filter = { rider: riderId };
  if (date) {
    const day = new Date(date);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: day, $lt: next };
  }

  const trips = await Trip.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(Number(pageSize));

  const total = await Trip.countDocuments(filter);
  const user = await User.findById(riderId).select("totalKm lastResetAt");

  res.status(200).json({
    trips,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalKm: user?.totalKm || 0,
    lastResetAt: user?.lastResetAt || null,
  });
});

// POST /trips/reset
export const resetTotalKm = catchAsync(async (req, res, next) => {
  const { riderId } = req.body;
  if (!riderId) return res.status(400).json({ message: "riderId required" });

  const user = await User.findByIdAndUpdate(
    riderId,
    { totalKm: 0, lastResetAt: new Date() },
    { new: true }
  );

  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json({ message: "Total km reset to 0", user });
});
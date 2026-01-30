import RiderPushToken from "../models/riderPushTokenModel.js";

export const registerPushToken = async (req, res) => {
  try {
    const authRiderId = "6970d90af3bf72a60c82db63";
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const { token, platform = "android", deviceId, appVersion } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    // Upsert by token: attach to this rider
    const doc = await RiderPushToken.findOneAndUpdate(
      { token },
      {
        $set: {
          riderId: authRiderId,
          platform,
          deviceId,
          appVersion,
          lastSeenAt: new Date(),
          isActive: true,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: "Token registered", data: { id: doc._id } });
  } catch (err) {
    console.error("registerPushToken error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removePushToken = async (req, res) => {
  try {
    const authRiderId = req.user?.id || req.user?._id;
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    // Soft-delete (mark inactive) to keep history; you can remove instead
    const doc = await RiderPushToken.findOneAndUpdate(
      { token, riderId: authRiderId },
      { $set: { isActive: false, lastSeenAt: new Date() } },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Token not found for this rider" });

    return res.status(200).json({ message: "Token removed" });
  } catch (err) {
    console.error("removePushToken error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// optional: debug endpoint for listing tokens for current rider
export const listMyTokens = async (req, res) => {
  try {
    const authRiderId = req.user?.id || req.user?._id;
    if (!authRiderId) return res.status(401).json({ message: "Unauthorized" });

    const tokens = await RiderPushToken.find({ riderId: authRiderId }).sort({ lastSeenAt: -1 }).lean();
    return res.status(200).json({ tokens });
  } catch (err) {
    console.error("listMyTokens error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
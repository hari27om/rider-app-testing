import fs from "fs";
import path from "path";
import admin from "firebase-admin";

let app;

try {
  const keyPath = path.resolve("./secret-key-firebase.json");
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

  app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

  console.log("✅ Firebase Admin initialized");
} catch (err) {
  console.error("❌ Could not initialize Firebase Admin. Check firebase-admin.json path.", err);
  // Do not crash; but many code paths will error if not initialized.
}

export default admin;
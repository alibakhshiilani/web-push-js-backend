import express from "express";
import webpush from "web-push";

const app = express();
app.use(express.json());

// ---- Configure VAPID Keys ----
// Generate once by running: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;


console.log("Public key length:", process.env.VAPID_PUBLIC_KEY?.length);
console.log("Private key length:", process.env.VAPID_PRIVATE_KEY?.length);
console.log("ENV:", process.env);

webpush.setVapidDetails(
  "mailto:example@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Temporary storage (use a DB in production)
let subscriptions = [];

/** GET public VAPID key — used by frontend to subscribe */
app.get("/vapidPublicKey", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/** Receive & store push subscription from frontend */
app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({ message: "Subscription saved successfully" });
});

/** Trigger push notification to all saved subscriptions */
app.post("/push", async (req, res) => {
  const payload = JSON.stringify({
    title: "Hello from Web Push 🎯",
    body: "This is a test push message.",
  });

  const sendResults = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        console.error("Notification error:", err.message);
      })
    )
  );

  res.json({ sent: true, results: sendResults.length });
});

/** Health check */
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;

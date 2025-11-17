import express from "express";
import webpush from "web-push";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());

// ---- Configure VAPID Keys ----
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

console.log("Public key length:", process.env.VAPID_PUBLIC_KEY?.length);
console.log("Private key length:", process.env.VAPID_PRIVATE_KEY?.length);

webpush.setVapidDetails(
  "mailto:ali.bakhshi.office@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ---- MongoDB Setup ----
// Use a global variable to reuse the client across function invocations
let mongoClient;
let subscriptionsCollection;

async function getSubscriptionsCollection() {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    subscriptionsCollection = db.collection("push_subscriptions");
    // Create an index on endpoint to enforce uniqueness (optional)
    await subscriptionsCollection.createIndex({ endpoint: 1 }, { unique: true });
  }
  return subscriptionsCollection;
}

// GET public VAPID key
app.get("/vapidPublicKey", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe + save to MongoDB
app.post("/subscribe", async (req, res) => {
  const subscription = req.body;
  try {
    const col = await getSubscriptionsCollection();
    await col.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { data: subscription } },
      { upsert: true }
    );
    res.status(201).json({ message: "Subscription saved successfully" });
  } catch (err) {
    console.error("Mongo insert/update error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Trigger push to all subscriptions
app.post("/push", async (req, res) => {
  const payload = JSON.stringify({
    title: "Hello from Web Push 🎯",
    body: "This is a test push message.",
  });

  try {
    const col = await getSubscriptionsCollection();
    const all = await col.find({}, { projection: { data: 1 } }).toArray();
    const subscriptions = all.map((doc) => doc.data);

    const sendResults = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, payload).catch((err) => {
          console.error("Notification error:", err);
        })
      )
    );

    res.json({ sent: true, results: sendResults.length });
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Failed to send push" });
  }
});

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;

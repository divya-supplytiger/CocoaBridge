import express from "express";
import cors from "cors";
import path from "path";

import { ENV } from "./config/env.js";
import { clerkMiddleware } from "@clerk/express";
import samRoutes from "./routes/sam.routes.js";
import USASpendingRoutes from "./routes/usaspending.routes.js";
import prisma from "./config/db.js";
import { inngest, functions } from "./config/inngest.js";
import { serve } from "inngest/express";

const app = express();
const __dirname = path.resolve();

// Configure CORS to allow multiple origins
const allowedOrigins = ["http://localhost:5173", ENV.CLIENT_URL];

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(clerkMiddleware());
// enable CORS for frontend-backend communication
// this will allow requests from the frontend domain to access backend resources
// credentials: true allows cookies to be sent with requests to the server
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }),
);

// Mount routes
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/samgov", samRoutes);
app.use("/api/usaspending", USASpendingRoutes);

// Add deployment-specific configurations
if (ENV.NODE_ENV !== "development") {
  // Serve static files from the React frontend app
  app.use(express.static(path.join(__dirname, "../frontend/dist"))); // Adjusted for Vite build output

  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../admin", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    // await connectDB();
    if (ENV.NODE_ENV !== "production") {
      app.listen(ENV.PORT, () => {
        console.log(`Server is running on http://localhost:${ENV.PORT}`);
      });
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;

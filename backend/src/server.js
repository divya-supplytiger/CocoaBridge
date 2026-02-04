import express from "express";
import { ENV } from "./config/env.js";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import samRoutes from "./routes/sam.routes.js";
import USASpendingRoutes from "./routes/usaspending.routes.js";
import prisma from "./config/db.js";

const app = express();

// Configure CORS to allow multiple origins
const allowedOrigins = ["http://localhost:5173", ENV.CLIENT_URL];

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

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
// enable CORS for frontend-backend communication
// this will allow requests from the frontend domain to access backend resources
// credentials: true allows cookies to be sent with requests to the server
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware());

app.use("/api/samgov", samRoutes);
app.use("/api/usaspending", USASpendingRoutes);
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

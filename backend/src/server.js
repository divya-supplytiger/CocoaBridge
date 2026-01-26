import express from "express";
import { ENV } from "./config/env.js";
import cors from "cors";
import samRoutes from "./routes/sam.routes.js";
import usaspendingRoutes from "./routes/usaspending.routes.js";
import prisma from "./config/db.js";

const app = express();

// Configure CORS to allow multiple origins
const allowedOrigins = [
  "http://localhost:5173",
  ENV.CLIENT_URL,
];

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
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use("/api/samgov", samRoutes);
app.use("/api/usaspending", usaspendingRoutes);
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

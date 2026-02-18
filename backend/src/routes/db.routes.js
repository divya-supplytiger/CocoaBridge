import express from "express";
import axios from "axios";
import { ENV } from "../config/env.js";

// todo: implement ROUTES to connect to the database 
// use NEON_DB_API from ENV for database connection

// Create inbox items every time an opportunity, or award is created or updated in the database
// This will be used to notify users of new opportunities or awards that match their preferences

export const router = express.Router();

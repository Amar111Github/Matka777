import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import os from 'os';
import cluster from "cluster";

// Config
import connectDB from "./config/dbConfig.js";

// Middleware
import { logManager } from "./middlewares/log_manager.js";
import { errorHandler } from "./middlewares/error_handler.js";

// Services
import {
    generateUserHistory,
    resetHistoryData,
    resetWebTimingAndResult,
    resetEveryBazaarResults,
    resetFinalAnk,
} from "./services/dataResetService.js";

// Routes
import userRoutes from "./routes/userRoute.js";
import gameRoutes from "./routes/gameRoute.js";
import bidRoutes from "./routes/bidRoutes.js";
import transactionRoutes from "./routes/transRoute.js";
import settingRoutes from "./routes/settingRoute.js";
import distributorRoutes from "./routes/distributorRoutes.js";

// Load env vars
dotenv.config();

const app = express();

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// Middleware
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));
app.use(express.static("../public/")); // Use carefully; change path if needed
app.use(logManager);

// Routes
app.use('/api/v1/users/', userRoutes);
app.use('/api/v1/games/', gameRoutes);
app.use('/api/v1/bids/', bidRoutes);
app.use('/api/v1/settings/', settingRoutes);
app.use('/api/v1/transactions/', transactionRoutes);
app.use('/api/v1/distributors/', distributorRoutes);

// Test route
app.get('/', (req, res) => {
    res.send(`✅ Server Running...`);
});

// Error handler
app.use(errorHandler);

// ─── Scheduled Cron Jobs ────────────────────────────────

// 12:30 AM daily
cron.schedule('30 0 * * *', () => {
    resetHistoryData();
    generateUserHistory();
    console.log(new Date(), `🕒 12:30 AM tasks executed`);
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// 1:00 AM daily
cron.schedule('0 1 * * *', () => {
    resetFinalAnk();
    resetWebTimingAndResult();
    console.log(new Date(), `🕒 01:00 AM tasks executed`);
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// 8:00 AM daily
cron.schedule('0 8 * * *', () => {
    resetEveryBazaarResults();
    console.log(new Date(), `🕒 08:00 AM tasks executed`);
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});


connectDB()
    .then(() => {
     
            app.listen(process.env.PORT, () => {
            });
    
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
    });

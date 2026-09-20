import express from 'express';
import dotenv from "dotenv";
import connectDb from './utils/db.js';
import cloudinary from 'cloudinary';
import cartRoutes from './routes/cart.js';
import addressRoutes from './routes/address.js';
import orderRoutes from './routes/order.js';
import cors from 'cors';

dotenv.config();

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_API_KEY, 
    api_secret: process.env.CLOUD_API_SECRET
});

const app = express();

// Trust proxy for Railway deployment
app.set("trust proxy", 1);

// Fix CORS configuration for production credentials
app.use(cors({
    origin: [
        "https://ecommerce-2026-client-production.up.railway.app",
        "http://localhost:5173",
        "http://localhost:3000"
    ],
    credentials: true
}));

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 5000;

// importing routes
import userRoutes from './routes/user.js';
import productRoutes from './routes/product.js';

// using routes
app.use("/api", userRoutes);
app.use("/api", productRoutes);
app.use("/api", cartRoutes);
app.use("/api", addressRoutes);
app.use("/api", orderRoutes);

app.listen(port, () => {
    console.log(`server is running on port ${port}`);
    connectDb();
});
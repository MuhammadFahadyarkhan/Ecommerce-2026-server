import mongoose from 'mongoose';

const Schema = new mongoose.Schema({
    items: [
        {
            quantity: {
                type: Number,
                required: true
            },
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
        },
    ],
    method: {
        type: String,
        required: true, // e.g., "cod", "advance_25"
    },
    paymentInfo: {
        type: String,
    },
    paymentProof: {
        type: String, // Store the image URL or file path for 25% advance proof
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    phone: {
        type: Number,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["Pending", "Awaiting Admin Approval", "Approved", "Shipped", "Delivered", "Rejected by Seller", "Rejected by Buyer"],
        default: "Pending",
    },
    paidAt: {
        type: String,
    },
    subTotal: {
        type: Number,
        required: true,
        // 🛡️ Automatically round to 2 decimal places on save/update to prevent floating-point glitches
        set: (v) => Math.round(v * 100) / 100,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Order = mongoose.model("Order", Schema);
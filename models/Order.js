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
        required: true,
    },
    paymentInfo: {
        type: String,
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
        enum: ["Pending", "Shipped", "Delivered", "Rejected by Seller", "Rejected by Buyer"],
        default: "Pending",
    },
    paidAt: {
        type: String,
    },
    subTotal: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Order = mongoose.model("Order", Schema);
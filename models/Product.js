import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    stock: {
        type: Number,
        required: true,
    },
    price: {
        type: Number,
        required: true, // Acts as the original/base price
    },
    discountPercent: {
        type: Number,
        default: 0, // Percentage off, e.g., 20 for 20% discount
        min: 0,
        max: 100,
    },
    images: [{
        id: String,
        url: String,
    }],
    sold: {
        type: Number,
        default: 0,
    },
    category: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
},
{
    timestamps: true,
}
);

export const Product = mongoose.model("Product", productSchema);
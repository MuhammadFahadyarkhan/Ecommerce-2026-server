import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    nickname: { type: String },
    location: { type: String },
    ratings: {
      overall: { type: Number, required: true, min: 1, max: 5 },
      quality: { type: Number, min: 0, max: 5 },
      delivery: { type: Number, min: 0, max: 5 },
      service: { type: Number, min: 0, max: 5 },
    },
    recommend: { type: Boolean, required: true },
    title: { type: String },
    comment: { type: String },
  },
  { timestamps: true }
);

export const Review = mongoose.model("Review", reviewSchema);
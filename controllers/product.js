import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import TryCatch from "../utils/TryCatch.js";
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

// Get all products with dynamic filters, regex safety, and stable sorting pagination
export const getAllProducts = TryCatch(async (req, res) => {
  let { search, category, sortByPrice, page } = req.query;

  let query = {};

  // Only apply search filter if provided and not empty
  if (search && search.trim() !== "") {
    query.title = { $regex: search.trim(),$options: "i" };
  }

  // Only apply category filter if provided, valid, and not "All"
  if (
    category &&
    category !== "undefined" &&
    category !== "null" &&
    category.trim() !== "" &&
    category !== "All"
  ) {
    query.category = { $regex: `^${category.trim()}$`, $options: "i" };
  }

  const limit = 8;
  const numericPage = Number(page) || 1;
  const skip = (numericPage - 1) * limit;

  // Stable sorting to prevent pagination shifting / missing items with identical timestamps
  let sort = {};
  if (sortByPrice === "lowToHigh") {
    sort.price = 1;
    sort._id = 1;
  } else if (sortByPrice === "highToLow") {
    sort.price = -1;
    sort._id = 1;
  } else {
    sort.createdAt = -1;
    sort._id = 1; // Stable secondary sort
  }

  const products = await Product.find(query).sort(sort).skip(skip).limit(limit);
  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit) || 1;

  // Fetch distinct categories for the frontend filter dropdown
  const categories = await Product.distinct("category");

  // Fetch a list of new products for the Home page display
  const newProduct = await Product.find({}).sort({ createdAt: -1 }).limit(4);

  res.status(200).json({
    products,
    newProduct,
    totalPages,
    currentPage: numericPage,
    categories,
  });
});

// Get a single product, related items, and dynamic reviews
export const getSingleProduct = TryCatch(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const relatedProduct = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(4);

  // Fetch reviews for this product
  const reviews = await Review.find({ product: product._id }).sort({ createdAt: -1 });

  // Calculate dynamic rating metrics
  const totalReviews = reviews.length;
  let averageRating = 0;
  let recommendPercentage = 0;

  if (totalReviews > 0) {
    const sumRatings = reviews.reduce((acc, item) => acc + item.ratings.overall, 0);
    averageRating = Number((sumRatings / totalReviews).toFixed(1));

    const recommendCount = reviews.filter((item) => item.recommend === true).length;
    recommendPercentage = Math.round((recommendCount / totalReviews) * 100);
  }

  res.status(200).json({
    product,
    relatedProduct,
    reviews,
    reviewStats: {
      totalReviews,
      averageRating,
      recommendPercentage,
    },
  });
});

// Create a new product (Admin only)
export const createProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const { title, description, price, stock, category } = req.body;
  const files = req.files;

  if (!title || !description || !price || !stock || !category) {
    return res.status(400).json({ message: "Please fill all fields" });
  }

  let images = [];
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const fileBuffer = bufferGenerator(files[i]);
      const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
      images.push({
        id: result.public_id,
        url: result.secure_url,
      });
    }
  }

  const product = await Product.create({
    title,
    description,
    price,
    stock,
    category,
    images,
  });

  res.status(201).json({
    message: "Product Created Successfully",
    product,
  });
});

// Update product details
export const updateProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.status(200).json({
    message: "Product Updated Successfully",
    product,
  });
});

// Update/Replace product images
export const updateProductImage = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ message: "Please upload images" });
  }

  for (let img of product.images) {
    if (img.id) {
      await cloudinary.v2.uploader.destroy(img.id);
    }
  }

  let images = [];
  for (let i = 0; i < files.length; i++) {
    const fileBuffer = bufferGenerator(files[i]);
    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
    images.push({
      id: result.public_id,
      url: result.secure_url,
    });
  }

  product.images = images;
  await product.save();

  res.status(200).json({
    message: "Product Images Updated Successfully",
    product,
  });
});

// Delete product
export const deleteProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  await product.deleteOne();

  res.status(200).json({
    message: "Product Deleted Successfully",
  });
});

// Add product review
export const addProductReview = TryCatch(async (req, res) => {
  const { id: productId } = req.params;
  const { name, email, nickname, location, ratings, recommend, title, comment } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (!ratings || !ratings.overall) {
    return res.status(400).json({ message: "Overall rating is required" });
  }

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    name,
    email,
    nickname,
    location,
    ratings,
    recommend,
    title,
    comment,
  });

  res.status(201).json({
    success: true,
    message: "Review submitted successfully!",
    review,
  });
});
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";
import TryCatch from "../utils/TryCatch.js";
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

// Get all products with dynamic filters, regex safety, stable sorting pagination, and attached ratings
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

  const productsRaw = await Product.find(query).sort(sort).skip(skip).limit(limit).lean();
  
  // Attach review ratings dynamically to each product in the list
  const products = await Promise.all(
    productsRaw.map(async (prod) => {
      const reviews = await Review.find({ product: prod._id });
      const totalReviews = reviews.length;
      let averageRating = 0;
      if (totalReviews > 0) {
        const sumRatings = reviews.reduce((acc, item) => acc + (item.ratings?.overall || 0), 0);
        averageRating = Number((sumRatings / totalReviews).toFixed(1));
      }
      return {
        ...prod,
        ratings: {
          average: averageRating,
          total: totalReviews,
        },
      };
    })
  );

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit) || 1;

  // Fetch distinct categories for the frontend filter dropdown
  const categories = await Product.distinct("category");

  // Fetch a list of new products for the Home page display with ratings attached
  const newProductRaw = await Product.find({}).sort({ createdAt: -1 }).limit(4).lean();
  const newProduct = await Promise.all(
    newProductRaw.map(async (prod) => {
      const reviews = await Review.find({ product: prod._id });
      const totalReviews = reviews.length;
      let averageRating = 0;
      if (totalReviews > 0) {
        const sumRatings = reviews.reduce((acc, item) => acc + (item.ratings?.overall || 0), 0);
        averageRating = Number((sumRatings / totalReviews).toFixed(1));
      }
      return {
        ...prod,
        ratings: {
          average: averageRating,
          total: totalReviews,
        },
      };
    })
  );

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

// Create a new product (Admin only) - Added discountPercent support
export const createProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const { title, description, price, stock, category, discountPercent } = req.body;
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
    discountPercent: discountPercent || 0,
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

  const { title, description, price, stock, category, discountPercent } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (title !== undefined) product.title = title;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (stock !== undefined) product.stock = stock;
  if (category !== undefined) product.category = category;
  if (discountPercent !== undefined) product.discountPercent = discountPercent;

  await product.save();

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

// Delete product (Includes Cloudinary image cleanup & associated review cleanup)
export const deleteProduct = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  // Delete images from Cloudinary storage
  if (product.images && product.images.length > 0) {
    for (let img of product.images) {
      if (img.id) {
        await cloudinary.v2.uploader.destroy(img.id);
      }
    }
  }

  // Remove reviews associated with this product
  await Review.deleteMany({ product: product._id });

  await product.deleteOne();

  res.status(200).json({
    message: "Product Deleted Successfully",
  });
});

// Add product review and update product ratings instantly
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

  // Prevent duplicate reviews by the same user on the same product
  const existingReview = await Review.findOne({
    product: productId,
    user: req.user._id,
  });

  if (existingReview) {
    return res.status(400).json({ message: "You have already reviewed this product" });
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

  // Automatically recalculate and update product ratings
  const allReviews = await Review.find({ product: productId });
  const totalReviews = allReviews.length;
  const sumRatings = allReviews.reduce((acc, item) => acc + item.ratings.overall, 0);
  const averageRating = totalReviews > 0 ? Number((sumRatings / totalReviews).toFixed(1)) : 0;

  product.ratings = {
    average: averageRating,
    total: totalReviews,
  };
  await product.save();

  res.status(201).json({
    success: true,
    message: "Review submitted successfully!",
    review,
  });
});

// Delete product review (Allows Admin or the Review Author to delete)
export const deleteProductReview = TryCatch(async (req, res) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({ message: "Review not found" });
  }

  // Check if requester is admin or the owner of the review
  if (
    req.user.role !== "admin" &&
    review.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Unauthorized to delete this review" });
  }

  const productId = review.product;
  await review.deleteOne();

  // Recalculate ratings after deletion and return updated stats
  const product = await Product.findById(productId);
  let updatedReviewStats = { totalReviews: 0, averageRating: 0 };
  
  if (product) {
    const allReviews = await Review.find({ product: productId });
    const totalReviews = allReviews.length;
    const sumRatings = allReviews.reduce((acc, item) => acc + item.ratings.overall, 0);
    const averageRating = totalReviews > 0 ? Number((sumRatings / totalReviews).toFixed(1)) : 0;

    product.ratings = {
      average: averageRating,
      total: totalReviews,
    };
    await product.save();

    updatedReviewStats = { totalReviews, averageRating };
  }

  res.status(200).json({
    success: true,
    message: "Review deleted successfully",
    reviewStats: updatedReviewStats, // Return this so frontend can update immediately
  });
});
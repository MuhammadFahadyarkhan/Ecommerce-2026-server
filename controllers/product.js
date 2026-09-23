import { Product } from "../models/Product.js";
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

// Get a single product and related items
export const getSingleProduct = TryCatch(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const relatedProduct = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(4);

  res.status(200).json({
    product,
    relatedProduct,
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

// Update/Add product image
export const updateProductImage = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "You are not admin" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const file = req.files && req.files[0];
  if (!file) {
    return res.status(400).json({ message: "Please upload an image" });
  }

  const fileBuffer = bufferGenerator(file);
  const result = await cloudinary.v2.uploader.upload(fileBuffer.content);

  product.images.push({
    id: result.public_id,
    url: result.secure_url,
  });

  await product.save();

  res.status(200).json({
    message: "Image Added Successfully",
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
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import TryCatch from '../utils/TryCatch.js';
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

// Get all categories with fallback
export const getAllCategories = TryCatch(async (req, res) => {
  let categories = await Category.find({});
  console.log("-> Categories found in Category collection:", categories);

  if (!categories || categories.length === 0) {
    const sampleProduct = await Product.findOne({});
    console.log("-> Sample product structure check:", sampleProduct);

    const distinctProductCategories = await Product.distinct("category");
    console.log("-> Distinct categories extracted from Product model:", distinctProductCategories);

    categories = distinctProductCategories.map((cat, index) => ({
      _id: index.toString(),
      name: cat,
    }));
  }

  res.json({ categories });
});

// Create or Update a category with an image
export const createCategory = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") 
    return res.status(403).json({ message: "You are not admin" });

  const { name } = req.body;
  const file = req.files && req.files[0]; 

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Please provide a category name" });
  }

  let imageData = {};
  if (file) {
    const fileBuffer = bufferGenerator(file);
    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
    imageData = {
      id: result.public_id,
      url: result.secure_url,
    };
  }

  // Find if the category already exists
  let category = await Category.findOne({ name: name.trim() });

  if (category) {
    // If it exists, update its image (and keep name)
    if (file) {
      category.image = imageData;
      await category.save();
    }
    return res.status(200).json({
      message: "Category Image Updated Successfully",
      category,
    });
  }

  // Otherwise, create a new category
  category = await Category.create({
    name: name.trim(),
    image: imageData,
  });

  res.status(201).json({
    message: "Category Created Successfully",
    category,
  });
});

// Delete a category document (Products remain completely untouched)
export const deleteCategory = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") 
    return res.status(403).json({ message: "You are not admin" });

  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ message: "Category not found in database" });
  }

  await category.deleteOne();

  res.status(200).json({
    message: "Category deleted successfully (Products are safe)",
  });
});
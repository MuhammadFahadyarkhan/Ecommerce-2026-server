import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import TryCatch from '../utils/TryCatch.js';
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

// Get all categories as an array of strings
export const getAllCategories = TryCatch(async (req, res) => {
  let categoryDocs = await Category.find({});
  console.log("-> Categories found in Category collection:", categoryDocs);

  let categories = [];

  if (!categoryDocs || categoryDocs.length === 0) {
    const distinctProductCategories = await Product.distinct("category");
    console.log("-> Distinct categories extracted from Product model:", distinctProductCategories);
    categories = distinctProductCategories;
  } else {
    // Map document objects to clean string names so frontend dropdowns match correctly
    categories = categoryDocs.map((cat) => cat.name);
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

// Update a category name or image
export const updateCategory = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") 
    return res.status(403).json({ message: "You are not admin" });

  const { id } = req.params;
  const { name } = req.body;

  let category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ message: "Category not found in database" });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Please provide a category name" });
  }

  // Check if another category with the same name already exists
  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory && existingCategory._id.toString() !== id) {
    return res.status(400).json({ message: "A category with this name already exists" });
  }

  category.name = name.trim();

  // Handle optional new image upload
  const file = req.files && req.files[0];
  if (file) {
    const fileBuffer = bufferGenerator(file);
    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);
    category.image = {
      id: result.public_id,
      url: result.secure_url,
    };
  }

  await category.save();

  res.status(200).json({
    message: "Category updated successfully",
    category,
  });
});
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import TryCatch from '../utils/TryCatch.js';
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

export const getAllCategories = TryCatch(async (req, res) => {
  let categories = await Category.find({});
  
  // Get all unique categories currently used in products
  const distinctProductCategories = await Product.distinct("category");

  // Automatically seed missing product categories into the Category collection safely
  for (const catName of distinctProductCategories) {
    if (catName && !categories.some(c => c.name && c.name.toLowerCase() === catName.toLowerCase())) {
      const newCat = await Category.create({ name: catName, image: {} });
      categories.push(newCat);
    }
  }

  // Ensure every category returned has a guaranteed name field
  const sanitizedCategories = categories.map(cat => ({
    _id: cat._id,
    name: cat.name || "Unnamed Category",
    image: cat.image
  }));

  console.log("-> Synchronized categories found:", sanitizedCategories);
  res.json({ categories: sanitizedCategories });
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

  if (id.startsWith("legacy_")) {
    return res.status(400).json({ message: "Please recreate this category properly in the admin panel before deleting." });
  }

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

  if (id.startsWith("legacy_")) {
    return res.status(400).json({ message: "Please recreate this category properly in the admin panel to enable editing." });
  }

  let category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ message: "Category not found in database" });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Please provide a category name" });
  }

  const existingCategory = await Category.findOne({ name: name.trim() });
  if (existingCategory && existingCategory._id.toString() !== id) {
    return res.status(400).json({ message: "A category with this name already exists" });
  }

  category.name = name.trim();

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
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import TryCatch from '../utils/TryCatch.js';
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

export const getAllCategories = TryCatch(async (req, res) => {
  let categories = await Category.find({});
  
  // Ensure every category returned has a guaranteed name field
  const sanitizedCategories = categories.map(cat => ({
    _id: cat._id,
    name: cat.name || "Unnamed Category",
    image: cat.image
  }));

  console.log("-> Categories found:", sanitizedCategories);
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

  category = await Category.create({
    name: name.trim(),
    image: imageData,
  });

  res.status(201).json({
    message: "Category Created Successfully",
    category,
  });
});

// Delete a category document permanently and update associated products
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

  // Update products referencing this category name so they don't linger as ghost filters
  await Product.updateMany(
    { category: { $regex: `^${category.name}$`, $options: "i" } },
    { $set: { category: "Uncategorized" } }
  );

  await category.deleteOne();

  res.status(200).json({
    message: "Category deleted successfully and associated products updated",
  });
});

// Update a category name or image and sync product references
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

  const trimmedName = name.trim();

  const existingCategory = await Category.findOne({ name: trimmedName });
  if (existingCategory && existingCategory._id.toString() !== id) {
    return res.status(400).json({ message: "A category with this name already exists" });
  }

  const oldCategoryName = category.name;

  category.name = trimmedName;

  const file = req.files && req.files[0];
  if (file) {
    const fileBuffer = bufferGenerator(file);
    const recommendation = await cloudinary.v2.uploader.upload(fileBuffer.content);
    category.image = {
      id: recommendation.public_id,
      url: recommendation.secure_url,
    };
  }

  await category.save();

  // If the category name changed, cascade the update to all related products
  if (oldCategoryName && oldCategoryName !== trimmedName) {
    await Product.updateMany(
      { category: { $regex: `^${oldCategoryName}$`, $options: "i" } },
      { $set: { category: trimmedName } }
    );
  }

  res.status(200).json({
    message: "Category updated successfully and products synchronized",
    category,
  });
});
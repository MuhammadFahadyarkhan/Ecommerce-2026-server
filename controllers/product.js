import { Product } from '../models/Product.js';
import { Cart } from '../models/Cart.js'; // 🛒 Import the Cart model
import TryCatch from '../utils/TryCatch.js';
import bufferGenerator from "../utils/bufferGenerator.js";
import cloudinary from "cloudinary";

export const createProduct = TryCatch(async (req, res) => {
  // 1. Role Authorization
  if (req.user.role !== "admin") 
    return res.status(403).json({
      message: "You are not admin",
    });
  

  // 2. Validate File Uploads First
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({
      message: "no files to upload",
    });
  }

  // 3. Safely Extract Body (Fallback to empty object prevents destructuring crashes)
  const { title, description, category, price, stock } = req.body || {};

  // 4. Validate Text Fields
  if (!title || !description || !category || !price || !stock) {
    return res.status(400).json({
      message: "Please enter all fields",
    });
  }

  // 5. Upload Images to Cloudinary
  const imageUploadPromises = files.map(async (file) => {
    const fileBuffer = bufferGenerator(file);

    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);

    return {
      id: result.public_id,
      url: result.secure_url,
    };
  });

  const uploadedImage = await Promise.all(imageUploadPromises);

  // 6. Save Product to Database
 const product = await Product.create({
    title: title.trim(),
    description,
    category: category.trim(), // <--- Trim whitespace and newlines here
    price,
    stock,
    images: uploadedImage,
  });

  res.status(201).json({
    message: "Product Created",
    product,
  });
});

export const getAllProducts = TryCatch(async (req, res) => {
 const { search, category, page, sortByPrice } = req.query;

 const filter = {}

 if(search){
    filter.title={
        $regex: search,$options: "i"
    };
 }

  if(category){
    filter.category = {
      $regex: `^${category.trim()}$`,
      $options: "i"
    };
  }

  const limit = 8

  const skip = (page-1) * limit

  let sortOption = {createdAt: -1}

  if(sortByPrice==="lowToHigh"){
    sortOption = {price: 1};
  }else if (sortByPrice ==="highToLow"){
    sortOption = { price: -1};
  }
  const products = await Product.find(filter).sort(sortOption).limit(limit).skip(skip);
  const categories = await Product.distinct("category")
  const newProduct = await Product.find().sort({ createdAt: -1 }).limit(4);
  const countProduct = await Product.countDocuments(filter)
  const totalPages = Math.ceil(countProduct/limit);

  res.json({products, categories, totalPages, newProduct})
  });

  export const getSingleProduct = TryCatch(async (req, res) => {
  const product = await Product.findById(req.params.id);

  // Return a 404 cleanly if the product doesn't exist anymore
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const relatedProduct = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(4);

  res.json({ product, relatedProduct });
});

  export const updateProduct = TryCatch(async(req,res)=>{
     if (req.user.role !== "admin") 
    return res.status(403).json({
      message: "You are not admin",
    });
    
    const { title, description, category, price, stock } = req.body; 

    const updateFields = {}
  if (title) updateFields.title = title;
  if (description) updateFields.description = description; 
  if (stock) updateFields.stock = stock;                     
  if (price) updateFields.price = price;                     
  if (category) updateFields.category = category.trim();            

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id,
      updateFields, {new: true, runValidators: true}
    );
    if(!updatedProduct) return res.status(404).json({
      message: "Product not found",
    });

    res.json({
      message:"Product Updated",
      updatedProduct,
    });
  
  });

  export const updateProductImage = TryCatch(async(req,res)=>{
      if (req.user.role !== "admin") 
    return res.status(403).json({
      message: "You are not admin",
    });

    const {id} = req.params
    const files = req.files

  if (!files || files.length === 0) 
    return res.status(400).json({
      message: "no files to upload",
    });

    const product = await Product.findById(id)

    if(!product) return res.status(404).json({
      message: "Product not found",
    });
   
    const oldImages = product.images || [];

    for(const img of oldImages){
      if(img.id){
        await cloudinary.v2.uploader.destroy(img.id);
      }
    }

      const imageUploadPromises = files.map(async (file) => {
    const fileBuffer = bufferGenerator(file);

    const result = await cloudinary.v2.uploader.upload(fileBuffer.content);

    return {
      id: result.public_id,
      url: result.secure_url,
    };
  });

  const uploadedImage = await Promise.all(imageUploadPromises);

  product.images = uploadedImage;

  await product.save()

  res.status(200).json({
    message:"Image updated",
    product,
  })
  })

  export const deleteProduct = TryCatch(async (req, res) => {
  // 1. Role Authorization
  if (req.user.role !== "admin") 
    return res.status(403).json({
      message: "You are not admin",
    });

  const { id } = req.params;

  // 2. Find Product
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  // 3. Delete Associated Images from Cloudinary safely
  if (product.images && product.images.length > 0) {
    for (const img of product.images) {
      if (img.id) {
        try {
          await cloudinary.v2.uploader.destroy(img.id);
        } catch (err) {
          console.error("Error deleting image from cloudinary:", err);
        }
      }
    }
  }

  // 4. Delete Product from Database
  await Product.findByIdAndDelete(id);

  // 5. 🧹 Automatically wipe out this product from all user carts
  await Cart.deleteMany({ product: id });

  res.status(200).json({
    message: "Product Deleted Successfully",
  });
});
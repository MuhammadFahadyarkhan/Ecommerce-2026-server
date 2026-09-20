import express from 'express';
import { isAuth } from '../middlewares/isAuth.js';
import { 
  createProduct, 
  getAllProducts, 
  getSingleProduct, 
  updateProduct, 
  updateProductImage, 
  deleteProduct  // <--- 1. Make sure deleteProduct is imported here
} from '../controllers/product.js';
import uploadFiles from "../middlewares/multer.js";

const router = express.Router();

router.post("/product/new", isAuth, uploadFiles, createProduct);
router.get("/product/all", getAllProducts);

router.route("/product/:id")
  .get(getSingleProduct)
  .put(isAuth, updateProduct)
  .delete(isAuth, deleteProduct); // <--- 2. Ensure .delete() is added here

router.post("/product/:id", isAuth, uploadFiles, updateProductImage);

export default router;
import express from 'express';
import { isAuth } from '../middlewares/isAuth.js';
import { 
  createProduct, 
  getAllProducts, 
  getSingleProduct, 
  updateProduct, 
  updateProductImage, 
  deleteProduct,
  addProductReview,
  deleteProductReview 
} from '../controllers/product.js';
import uploadFiles from "../middlewares/multer.js";

const router = express.Router();

router.post("/product/new", isAuth, uploadFiles, createProduct);
router.get("/product/all", getAllProducts);

router.route("/product/:id")
  .get(getSingleProduct)
  .put(isAuth, updateProduct)
  .delete(isAuth, deleteProduct);

router.post("/product/:id", isAuth, uploadFiles, updateProductImage);

// Review routes
router.post("/product/:id/review", isAuth, addProductReview);
router.delete("/product/:id/review/:reviewId", isAuth, deleteProductReview);

export default router;
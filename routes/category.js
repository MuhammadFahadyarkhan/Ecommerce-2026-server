import express from 'express';
import { isAuth } from '../middlewares/isAuth.js';
import { getAllCategories, createCategory, deleteCategory } from '../controllers/category.js';
import uploadFiles from "../middlewares/multer.js";

const router = express.Router();

router.get("/category/all", getAllCategories);
router.post("/category/new", isAuth, uploadFiles, createCategory);
router.delete("/category/:id", isAuth, deleteCategory);

export default router;
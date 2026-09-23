import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import uploadFiles from "../middlewares/multer.js"; // 👈 Updated to match export name
import { 
  getAllOrders, 
  getAllOrdersAdmin, 
  getMyOrder, 
  getStats, 
  newOrderCod, 
  newOrderWithProof, 
  updateStatus 
} from "../controllers/order.js";

const router = express.Router();

router.post('/order/new/cod', isAuth, newOrderCod);
router.post('/order/new/proof', isAuth, uploadFiles, newOrderWithProof); // 👈 Uses uploadFiles middleware
router.get('/order/all', isAuth, getAllOrders);
router.get('/order/admin/all', isAuth, getAllOrdersAdmin);
router.get('/order/:id', isAuth, getMyOrder);
router.post('/order/:id', isAuth, updateStatus);
router.get('/stats', isAuth, getStats);

export default router;
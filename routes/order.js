import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import uploadFiles from "../middlewares/multer.js";
import { 
  getAllOrders, 
  getAllOrdersAdmin, 
  getMyOrder, 
  getStats, 
  newOrderCod, 
  newOrderWithProof, 
  updateStatus,
  updateOrderProof 
} from "../controllers/order.js";

const router = express.Router();

router.post('/order/new/cod', isAuth, newOrderCod);
router.post('/order/new/proof', isAuth, uploadFiles, newOrderWithProof);
router.put('/order/:id/proof', isAuth, uploadFiles, updateOrderProof); // 👈 Upgrades existing COD orders
router.get('/order/all', isAuth, getAllOrders);
router.get('/order/admin/all', isAuth, getAllOrdersAdmin);
router.get('/order/:id', isAuth, getMyOrder);
router.post('/order/:id', isAuth, updateStatus);
router.get('/stats', isAuth, getStats);

export default router;
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import sendOrderConfirmation from "../utils/sendOrderConfirmation.js";
import TryCatch from "../utils/TryCatch.js";
import dotenv from "dotenv";

dotenv.config();

export const newOrderCod = TryCatch(async (req, res) => {
    const { method, phone, address } = req.body;

    const cartItems = await Cart.find({ user: req.user._id }).populate({
        path: "product",
        select: "title price stock",
    });

    if (!cartItems || !cartItems.length) {
        return res.status(400).json({ messege: "Cart is empty" });
    }

    // 🛡️ Filter out deleted products and clean them up automatically
    const validCartItems = [];
    for (const item of cartItems) {
        if (!item.product) {
            await item.deleteOne();
        } else {
            validCartItems.push(item);
        }
    }

    if (!validCartItems.length) {
        return res.status(400).json({ messege: "Cart contains unavailable products" });
    }

    let subTotal = 0;

    const items = validCartItems.map((i) => {
        const itemSubtotal = i.product.price * i.quantity;
        subTotal += itemSubtotal;

        return {
            product: i.product._id,
            name: i.product.title,
            price: i.product.price,
            quantity: i.quantity, 
        };
    });

    const order = await Order.create({
        items,
        method,
        user: req.user._id, 
        phone,
        address,
        subTotal,
    });

    for (let i of order.items) {
        const product = await Product.findById(i.product);

        if (product) {
            product.stock -= i.quantity;
            product.sold += i.quantity;

            await product.save();
        }
    }

    await Cart.deleteMany({ user: req.user._id });

    await sendOrderConfirmation({
        email: req.user.email,
        subject: "Order Confirmed",
        orderId: order._id,
        products: items,
        totalAmount: subTotal,
    });

    res.json({
        messege: "order created successfully",
        order,
    });
});

export const getAllOrders = TryCatch(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });

    res.json({ orders: orders.reverse() });
});

export const getAllOrdersAdmin = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({
        messege: "you are not a admin"
    });

    const orders = await Order.find().populate("user").sort({
        createdAt: -1
    });

    res.json(orders);
});

export const getMyOrder = TryCatch(async (req, res) => {
    const order = await Order.findById(req.params.id).populate("items.product").populate("user");

    res.json(order);
});

export const updateStatus = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            messege: "you are not a admin"
        });
    } 

    const order = await Order.findById(req.params.id).populate("items.product");

    const { status } = req.body;
    order.status = status;

    await order.save();

    res.json({
        messege: "order status updated",
        order,
    });
});

export const getStats = TryCatch(async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            messege: "you are not a admin"
        });
    }
        
    const cod = await Order.find({ method: "cod" }).countDocuments();
    const products = await Product.find();

    const data = products.map((prod) => ({
        name: prod.title,
        sold: prod.sold
    }));

    res.json({
        cod,
        data,
    });
});
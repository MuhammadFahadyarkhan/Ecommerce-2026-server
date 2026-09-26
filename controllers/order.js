import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import sendOrderConfirmation from "../utils/sendOrderConfirmation.js";
import TryCatch from "../utils/TryCatch.js";
import dotenv from "dotenv";
import cloudinary from "cloudinary";

dotenv.config();

// Helper function to handle buffer upload to Cloudinary for memoryStorage
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream(
            { folder: "payment_proofs" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// Existing COD Order Handler
export const newOrderCod = TryCatch(async (req, res) => {
    const { method, phone, address } = req.body;

    // 🛡️ Added discountPercent and discount to the select fields
    const cartItems = await Cart.find({ user: req.user._id }).populate({
        path: "product",
        select: "title price stock discountPercent discount",
    });

    if (!cartItems || !cartItems.length) {
        return res.status(400).json({ messege: "Cart is empty" });
    }

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
        // 🛡️ Dynamically calculate discounted price per item
        const discountPercent = i.product.discountPercent || i.product.discount || 0;
        const discountedPrice = discountPercent > 0 
            ? i.product.price * (1 - discountPercent / 100) 
            : i.product.price;

        const itemSubtotal = discountedPrice * i.quantity;
        subTotal += itemSubtotal;

        return {
            product: i.product._id,
            quantity: i.quantity, 
        };
    });

    const order = await Order.create({
        items,
        method,
        user: req.user._id, 
        phone,
        address,
        subTotal, // Stores correct discounted subtotal
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

// Order Handler for 25% Advance with Screenshot Proof (Memory Storage)
export const newOrderWithProof = TryCatch(async (req, res) => {
    const { method, phone, address } = req.body;
    const paymentProofFiles = req.files; 

    if (!paymentProofFiles || !paymentProofFiles.length) {
        return res.status(400).json({ message: "Please upload the payment proof image" });
    }

    // 🛡️ Added discountPercent and discount to the select fields
    const cartItems = await Cart.find({ user: req.user._id }).populate({
        path: "product",
        select: "title price stock discountPercent discount",
    });

    if (!cartItems || !cartItems.length) {
        return res.status(400).json({ message: "Cart is empty" });
    }

    let subTotal = 0;
    const items = cartItems.map((i) => {
        // 🛡️ Dynamically calculate discounted price per item
        const discountPercent = i.product.discountPercent || i.product.discount || 0;
        const discountedPrice = discountPercent > 0 
            ? i.product.price * (1 - discountPercent / 100) 
            : i.product.price;

        const itemSubtotal = discountedPrice * i.quantity;
        subTotal += itemSubtotal;

        return {
            product: i.product._id,
            quantity: i.quantity,
        };
    });

    // Upload buffer to Cloudinary and get the secure URL
    const paymentProofUrl = await uploadToCloudinary(paymentProofFiles[0].buffer);

    const order = await Order.create({
        items,
        method: method || "25% Advance",
        user: req.user._id,
        phone,
        address,
        subTotal, // Stores correct discounted subtotal
        paymentProof: paymentProofUrl,
        status: "Awaiting Admin Approval",
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

    res.json({
        message: "Order placed successfully! Awaiting admin approval of your payment proof.",
        order,
    });
});

// Update existing order with payment proof (Memory Storage -> Cloudinary)
export const updateOrderProof = TryCatch(async (req, res) => {
    const { id } = req.params;
    const paymentProofFiles = req.files;

    if (!paymentProofFiles || !paymentProofFiles.length) {
        return res.status(400).json({ message: "Please upload the payment proof image" });
    }

    const order = await Order.findById(id);

    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    // Upload the memory buffer to Cloudinary
    const paymentProofUrl = await uploadToCloudinary(paymentProofFiles[0].buffer);

    order.paymentProof = paymentProofUrl;
    order.method = "25% Advance";
    order.status = "Awaiting Admin Approval";

    await order.save();

    res.json({
        message: "Payment proof uploaded successfully! Order status updated to Awaiting Admin Approval.",
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
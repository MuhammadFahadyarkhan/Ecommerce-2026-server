import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import sendOrderConfirmation from "../utils/sendOrderConfirmation.js";
import TryCatch from "../utils/TryCatch.js";
import Stripe from 'stripe';
import dotenv from "dotenv";

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

export const getAllOrders = TryCatch(async(req,res)=>{
    const orders = await Order.find({ user: req.user._id});

    res.json({ orders: orders.reverse()});
});

export const getAllOrdersAdmin =  TryCatch(async(req,res)=>{
 if(req.user.role!=="admin") return res.status(403).json({
    messege: "you are not a admin"
 });

const orders = await Order.find().populate("user").sort({
        createdAt: -1
    });

    res.json(orders);
});

export const getMyOrder = TryCatch(async(req,res)=>{
    const order = await Order.findById(req.params.id).populate("items.product").populate("user")

    res.json(order);
});

export const updateStatus = TryCatch(async(req,res)=>{
   if(req.user.role!=="admin"){
    return res.status(403).json({
    messege: "you are not a admin"
});
} 

    const order = await Order.findById(req.params.id).populate("items.product")

    const {status} = req.body
    order.status = status

    await order.save()

     res.json({
        messege: "order status updated",
        order,
     });
});

export const getStats = TryCatch(async(req,res)=>{

    if(req.user.role!=="admin") {
    return res.status(403).json({
    messege: "you are not a admin"
     });
    }
        
    const cod = await Order.find({method:"cod"}).countDocuments()
    const online = await Order.find({method:"online"}).countDocuments()

    const products = await Product.find()

    const data = products.map((prod)=>({
        name: prod.title,
        sold: prod.sold
    }));

    res.json({
        cod,
        online,
        data,
    });
});


dotenv.config();

const stripe = new Stripe(process.env.Stripe_Secret_Key);

export const newOrderOnline = async (req, res) => {
try {
    const { method, phone, address } = req.body;

    const cart = await Cart.find({ user: req.user._id }).populate("product");

    if (!cart.length) {
        return res.status(400).json({
            message: "Cart is empty"
        });
    }

    // 🛡️ Filter out deleted products for Stripe session creation
    const validCartItems = [];
    for (const item of cart) {
        if (!item.product) {
            await item.deleteOne();
        } else {
            validCartItems.push(item);
        }
    }

    if (!validCartItems.length) {
        return res.status(400).json({ message: "Cart contains unavailable products" });
    }

    const subTotal = validCartItems.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0
    );

    const lineItems = validCartItems.map((item) => ({
        price_data: {
            currency: "pkr",
            product_data: {
                name: item.product.title,
                images: item.product.images && item.product.images.length > 0 ? [item.product.images[0].url] : [],
            },
            unit_amount: Math.round(item.product.price * 100),
        },
        quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.Frontend_Url}/ordersuccess?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.Frontend_Url}/cart`,
        metadata: {
            userId: req.user._id.toString(),
            method,
            phone,
            address,
            subTotal,
        },
    });

    res.json({
        url: session.url,
    });
  } catch (error) {
   console.log("Error creating Stripe session", error);
   res.status(500).json({
      message: "Failed to create payment session",
    });
  }
};


export const verifyPayment = async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const {
      userId,
      method,
      phone,
      address,
      subTotal,
    } = session.metadata;
      
    const cart = await Cart.find({ user: userId }).populate("product");
     
    const validCartItems = [];
    for (const item of cart) {
        if (!item.product) {
            await item.deleteOne();
        } else {
            validCartItems.push(item);
        }
    }

    if (validCartItems.length === 0) {
        return res.status(400).json({
            message: "Cart is empty"
        });
    }

    const items = validCartItems.map((i) => {
      return {
        product: i.product._id,
        name: i.product.title,
        price: i.product.price,
        quantity: i.quantity,
      };
    });

    const existingOrder = await Order.findOne({ paymentInfo: sessionId });

    if (!existingOrder) {
      const order = await Order.create({
        items: validCartItems.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
        })),
        method,
        user: userId,
        phone,
        address,
        subTotal,
        paidAt: new Date(),
        paymentInfo: sessionId,
      });

      for (let i of order.items) {
          const product = await Product.findById(i.product);

          if (product) {
              product.stock -= i.quantity;
              product.sold += i.quantity;

              await product.save();
          }
      }

      await Cart.deleteMany({ user: userId });

      await sendOrderConfirmation({
          email: session.customer_email || req.user?.email,
          subject: "Order Confirmed",
          orderId: order._id,
          products: items,
          totalAmount: subTotal,
      });

      return res.status(201).json({
        success: true,
        message: "Order created Successfully",
        order,
      });
    }

    res.status(200).json({ success: true, message: "Order already verified" });
  } catch (error) {
    console.log("Error verifying payment", error.message);
    res.status(500).json({
      message: error.message,
    });
  }
};
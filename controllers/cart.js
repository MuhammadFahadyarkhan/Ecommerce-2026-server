import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";
import TryCatch from "../utils/TryCatch.js";

export const addToCart = TryCatch(async (req, res) => {
    const { product } = req.body;

    const cart = await Cart.findOne({
        product: product,
        user: req.user._id
    }).populate("product");

    if (cart) {
        if (!cart.product || cart.product.stock === cart.quantity) {
            return res.status(400).json({
                message: "Out of Stock or Product Unavailable"
            });
        }

        cart.quantity = cart.quantity + 1;
        await cart.save();

        return res.json({
            message: "Added to Cart",
        });
    }

    const cartProd = await Product.findById(product);

    if (!cartProd || cartProd.stock === 0) {
        return res.status(400).json({
            message: "Out of Stock or Product Unavailable",
        });
    }

    await Cart.create({
        quantity: 1,
        product: product,
        user: req.user._id
    });

    res.json({
        message: "Added to Cart",
    });
});

export const removeFromCart = TryCatch(async (req, res) => {
    const cart = await Cart.findById(req.params.id);

    if (!cart) {
        return res.status(404).json({
            message: "Cart item not found",
        });
    }

    await cart.deleteOne();

    res.json({
        message: "Removed from Cart",
    });
});

export const updateCart = TryCatch(async (req, res) => {
    const { action } = req.query;

    if (action === "inc") {
        const { id } = req.body;
        const cart = await Cart.findById(id).populate("product");

        if (!cart || !cart.product) {
            // 🛡️ Auto-cleanup if product was deleted
            if (cart) await cart.deleteOne();
            return res.status(404).json({
                message: "Product no longer available",
            });
        }

        if (cart.quantity < cart.product.stock) {
            cart.quantity++;
            await cart.save();
        } else {
            return res.status(400).json({
                message: "Out of stock",
            });
        }

        return res.json({
            message: "cart updated"
        });
    }

    if (action === "dec") {
        const { id } = req.body;
        const cart = await Cart.findById(id).populate("product");

        if (!cart) {
            return res.status(404).json({
                message: "Cart item not found",
            });
        }

        // 🛡️ Auto-cleanup if product was deleted while sitting in cart
        if (!cart.product) {
            await cart.deleteOne();
            return res.status(404).json({
                message: "Product no longer available",
            });
        }

        if (cart.quantity > 1) {
            cart.quantity--;
            await cart.save();
        } else {
            return res.status(400).json({
                message: "You have only one item"
            });
        }

        return res.json({
            message: "cart updated",
        });
    }
});

export const fetchCart = TryCatch(async (req, res) => {
    let cart = await Cart.find({ user: req.user._id }).populate("product");

    // 🛡️ Automatically clean up cart items if the product was deleted from database
    const validCartItems = [];
    for (const item of cart) {
        if (!item.product) {
            await item.deleteOne();
        } else {
            validCartItems.push(item);
        }
    }

    const sumofQuantities = validCartItems.reduce(
        (total, item) => total + item.quantity,
        0
    );

    let subTotal = 0;
    
    validCartItems.forEach((i) => {
        const itemSubTotal = i.product.price * i.quantity;
        subTotal += itemSubTotal;
    });

    res.json({ cart: validCartItems, subTotal, sumofQuantities });
});
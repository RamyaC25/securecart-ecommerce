
const express = require("express");
const initSqlJs = require("sql.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

dotenv.config();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
}

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.static(__dirname));

const dbPath = path.join(__dirname, "database", "ecommerce.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;

function saveDatabase() {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function run(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
}

function getOne(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];

    return Object.fromEntries(
        columns.map((column, index) => [column, values[index]])
    );
}

function getAll(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length) return [];

    const columns = result[0].columns;

    return result[0].values.map(values =>
        Object.fromEntries(
            columns.map((column, index) => [column, values[index]])
        )
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Please login first." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({
                message: "Invalid or expired token."
            });
        }

        req.user = user;
        next();
    });
}

async function startServer() {
    const SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
        db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
        db = new SQL.Database();
    }

    db.run("PRAGMA foreign_keys = ON");

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            UNIQUE(user_id, product_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            payment_id TEXT UNIQUE,
            total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending'
        );
    `);

    const productCount = getOne(
        "SELECT COUNT(*) AS count FROM products"
    ).count;

    if (productCount === 0) {
        const products = [
            ["Wireless Headphones", 1499, 10],
            ["Smart Watch", 1999, 8],
            ["Bluetooth Speaker", 999, 15],
            ["Laptop Backpack", 799, 12]
        ];

        for (const product of products) {
            db.run(
                "INSERT INTO products (name, price, stock) VALUES (?, ?, ?)",
                product
            );
        }
    }

    saveDatabase();

    console.log("Database connected successfully!");
    console.log("Database tables created successfully!");
    console.log("Sample products ready!");

    // GET PRODUCTS
    app.get("/api/products", (req, res) => {
        res.json(getAll("SELECT * FROM products"));
    });

    // REGISTER
    app.post("/api/register", async (req, res) => {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({
                    message: "All fields are required."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    message: "Password must contain at least 8 characters."
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            run(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [name.trim(), email.trim().toLowerCase(), hashedPassword]
            );

            res.status(201).json({
                message: "Registration successful!"
            });
        } catch (error) {
            if (error.message.includes("UNIQUE")) {
                return res.status(409).json({
                    message: "Email already registered."
                });
            }

            console.error(error);
            res.status(500).json({
                message: "Registration failed."
            });
        }
    });

    // LOGIN
    app.post("/api/login", async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    message: "Email and password are required."
                });
            }

            const user = getOne(
                "SELECT * FROM users WHERE email = ?",
                [email.trim().toLowerCase()]
            );

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "2h" }
            );

            res.json({
                message: "Login successful!",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Login failed." });
        }
    });

    // ADD TO CART
    app.post("/api/cart", authenticateToken, (req, res) => {
        const { productId, quantity } = req.body;

        if (!Number.isInteger(productId) ||
            !Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({
                message: "Invalid product or quantity."
            });
        }

        const product = getOne(
            "SELECT * FROM products WHERE id = ?",
            [productId]
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        const existing = getOne(
            "SELECT quantity FROM cart WHERE user_id = ? AND product_id = ?",
            [req.user.id, productId]
        );

        const currentQuantity = existing ? existing.quantity : 0;

        if (currentQuantity + quantity > product.stock) {
            return res.status(400).json({
                message: "Not enough stock available."
            });
        }

        if (existing) {
            run(
                "UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?",
                [quantity, req.user.id, productId]
            );
        } else {
            run(
                "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)",
                [req.user.id, productId, quantity]
            );
        }

        res.json({ message: "Product added to cart!" });
    });

    // VIEW CART
    app.get("/api/cart", authenticateToken, (req, res) => {
        const items = getAll(`
            SELECT cart.product_id, products.name, products.price,
                   cart.quantity,
                   products.price * cart.quantity AS subtotal
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        `, [req.user.id]);

        const total = items.reduce(
            (sum, item) => sum + item.subtotal, 0
        );

        res.json({ items, total });
    });

    // REMOVE CART ITEM
    app.delete("/api/cart/:productId", authenticateToken, (req, res) => {
        const productId = Number(req.params.productId);

        const item = getOne(
            "SELECT id FROM cart WHERE user_id = ? AND product_id = ?",
            [req.user.id, productId]
        );

        if (!item) {
            return res.status(404).json({
                message: "Cart item not found."
            });
        }

        run(
            "DELETE FROM cart WHERE user_id = ? AND product_id = ?",
            [req.user.id, productId]
        );

        res.json({ message: "Item removed from cart!" });
    });

    // PREPARE CHECKOUT
    app.post("/api/checkout", authenticateToken, (req, res) => {
        const items = getAll(`
            SELECT cart.product_id, cart.quantity,
                   products.name, products.price, products.stock
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        `, [req.user.id]);

        if (items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty."
            });
        }

        for (const item of items) {
            if (item.quantity > item.stock) {
                return res.status(400).json({
                    message: `Insufficient stock for ${item.name}.`
                });
            }
        }

        const total = items.reduce(
            (sum, item) => sum + item.price * item.quantity, 0
        );

        const paymentId = crypto.randomUUID();

        run(
            `INSERT INTO orders (user_id, payment_id, total, status)
             VALUES (?, ?, ?, 'Pending')`,
            [req.user.id, paymentId, total]
        );

        res.json({
            message: "Checkout prepared.",
            paymentId,
            total,
            items,
            paymentMode: "SIMULATED TEST MODE"
        });
    });

    // SIMULATED PAYMENT
    app.post("/api/payment/simulate", authenticateToken, (req, res) => {
        const { paymentId, outcome } = req.body;

        if (!paymentId ||
            !["success", "failure"].includes(outcome)) {
            return res.status(400).json({
                message: "Invalid simulated payment details."
            });
        }

        const order = getOne(
            "SELECT * FROM orders WHERE payment_id = ? AND user_id = ?",
            [paymentId, req.user.id]
        );

        if (!order) {
            return res.status(404).json({
                message: "Order not found."
            });
        }

        if (order.status !== "Pending") {
            return res.status(400).json({
                message: "Payment already processed."
            });
        }

        if (outcome === "failure") {
            run(
                "UPDATE orders SET status = 'Failed' WHERE id = ?",
                [order.id]
            );

            return res.json({
                message: "Simulated payment failed. Your cart is unchanged.",
                status: "Failed"
            });
        }

        const items = getAll(`
            SELECT cart.product_id, cart.quantity, products.name,
                   products.stock
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = ?
        `, [req.user.id]);

        if (items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty."
            });
        }

        for (const item of items) {
            if (item.quantity > item.stock) {
                return res.status(400).json({
                    message: `Insufficient stock for ${item.name}.`
                });
            }
        }

        try {
            db.run("BEGIN TRANSACTION");

            for (const item of items) {
                db.run(
                    "UPDATE products SET stock = stock - ? WHERE id = ?",
                    [item.quantity, item.product_id]
                );
            }

            db.run(
                "UPDATE orders SET status = 'Paid' WHERE id = ?",
                [order.id]
            );

            db.run(
                "DELETE FROM cart WHERE user_id = ?",
                [req.user.id]
            );

            db.run("COMMIT");
            saveDatabase();

            res.json({
                message: "Simulated payment successful! Order placed.",
                status: "Paid",
                orderId: order.id,
                total: order.total
            });
        } catch (error) {
            db.run("ROLLBACK");
            saveDatabase();

            console.error(error);
            res.status(500).json({
                message: "Payment failed. Please try again."
            });
        }
    });

    // ORDER HISTORY
    app.get("/api/orders", authenticateToken, (req, res) => {
        const orders = getAll(
            `SELECT id, payment_id, total, status
             FROM orders WHERE user_id = ?
             ORDER BY id DESC`,
            [req.user.id]
        );

        res.json(orders);
    });

    // SERVER
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer().catch(error => {
    console.error("Server startup failed:", error);
});

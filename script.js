
let token = localStorage.getItem("token");

function showMessage(message) {
    document.getElementById("message").textContent = message;
}

function showSection(sectionId) {
    document.querySelectorAll("main section").forEach(section => {
        section.classList.add("hidden");
    });

    document.getElementById(sectionId).classList.remove("hidden");

    if (sectionId === "cart") loadCart();
}

async function loadProducts() {
    const response = await fetch("/api/products");
    const products = await response.json();

    document.getElementById("products").innerHTML =
        products.map(product => `
            <div class="product-card">
                <h3>${product.name}</h3>
                <p>Price: ₹${product.price}</p>
                <p>Available stock: ${product.stock}</p>
                <button class="addCartButton" data-product-id="${product.id}">
                    Add to Cart
                </button>
            </div>
        `).join("");
}

document.getElementById("registerForm").addEventListener("submit", async event => {
    event.preventDefault();

    const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: document.getElementById("registerName").value,
            email: document.getElementById("registerEmail").value,
            password: document.getElementById("registerPassword").value
        })
    });

    const data = await response.json();
    showMessage(data.message);
});

document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value
        })
    });

    const data = await response.json();

    if (response.ok) {
        token = data.token;
        localStorage.setItem("token", token);
        showMessage("Welcome, " + data.user.name + "!");
        showSection("store");
    } else {
        showMessage(data.message);
    }
});

async function addToCart(productId) {
    if (!token) {
        showMessage("Please login first.");
        showSection("login");
        return;
    }

    const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ productId, quantity: 1 })
    });

    const data = await response.json();
    showMessage(data.message);
}

async function loadCart() {
    if (!token) {
        showMessage("Please login to view your cart.");
        return;
    }

    const response = await fetch("/api/cart", {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await response.json();

    if (!response.ok) {
        showMessage(data.message);
        return;
    }

    document.getElementById("cartItems").innerHTML =
        data.items.map(item => `
            <div class="cart-item">
                <h3>${item.name}</h3>
                <p>Quantity: ${item.quantity}</p>
                <p>Subtotal: ₹${item.subtotal}</p>
                <button class="removeButton" data-product-id="${item.product_id}">
                    Remove
                </button>
            </div>
        `).join("") || "Your cart is empty.";

    document.getElementById("cartTotal").textContent =
        "Total: ₹" + data.total;
}

async function removeFromCart(productId) {
    const response = await fetch("/api/cart/" + productId, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await response.json();
    showMessage(data.message);
    loadCart();
}

async function checkout() {
    if (!token) {
        showMessage("Please login first.");
        return;
    }

    try {
        const response = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message);
            return;
        }

        const paymentSuccess = confirm(
            "SIMULATED PAYMENT SANDBOX\n\n" +
            "Total: ₹" + data.total +
            "\n\nOK = Simulate SUCCESS\nCancel = Simulate FAILURE"
        );

        const paymentResponse = await fetch("/api/payment/simulate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                paymentId: data.paymentId,
                outcome: paymentSuccess ? "success" : "failure"
            })
        });

        const paymentData = await paymentResponse.json();
        showMessage(paymentData.message);

        if (paymentResponse.ok && paymentSuccess) {
            await loadProducts();
            await loadCart();
        }

    } catch (error) {
        showMessage("Payment processing error.");
    }
}

// Navigation buttons
document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

// Add to cart buttons
document.getElementById("products").addEventListener("click", event => {
    const button = event.target.closest(".addCartButton");

    if (button) {
        addToCart(Number(button.dataset.productId));
    }
});

// Remove cart buttons
document.getElementById("cartItems").addEventListener("click", event => {
    const button = event.target.closest(".removeButton");

    if (button) {
        removeFromCart(Number(button.dataset.productId));
    }
});

// Checkout button
document.getElementById("checkoutButton").addEventListener("click", checkout);

loadProducts();

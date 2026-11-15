
# Secure E-Commerce Engine with Checkout Sandbox

## Project Overview
This project is a mini e-commerce application developed as part of the Future Interns Full Stack Internship Task 4.

It provides secure user authentication, product browsing, shopping cart management, checkout simulation, and inventory updates.

## Features

- User registration and login
- Password hashing using bcrypt
- JWT-based authentication
- Product listing with prices and stock availability
- Persistent shopping cart using SQLite
- Add and remove cart items
- Checkout functionality
- Simulated payment sandbox (test mode)
- Automatic inventory reduction after successful simulated payment
- Order history API
- Security headers using Helmet

## Technologies Used

**Frontend:**
- HTML
- CSS
- JavaScript

**Backend:**
- Node.js
- Express.js

**Database:**
- SQLite using sql.js

**Security:**
- bcryptjs
- JSON Web Tokens (JWT)
- Helmet
- dotenv

## Project Structure

```text
Task4-Secure-Ecommerce/
│
├── database/
│   └── ecommerce.db
│
├── index.html
├── style.css
├── script.js
├── server.js
├── package.json
├── package-lock.json
├── .env
├── .gitignore
└── README.md
```

## Installation and Setup

1. Install Node.js.
2. Open the project folder in VS Code.
3. Open the terminal.
4. Install the dependencies:

```bash
npm install
```

5. Create a `.env` file with:

```env
PORT=3000
JWT_SECRET=your_private_secret_key
```

6. Start the server:

```bash
node server.js
```

7. Open the application:

```text
http://localhost:3000
```

## Payment Sandbox

This project uses a simulated payment sandbox for demonstration purposes.

- Users can simulate successful or failed payments.
- Successful simulated payments update product inventory.
- The shopping cart is cleared after successful payment.
- Failed simulated payments leave the cart unchanged.

**Note:** This is not a live payment gateway integration. No real money is transferred, and Stripe/Razorpay transactions are not processed.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/products | View products |
| POST | /api/register | Register user |
| POST | /api/login | Login user |
| POST | /api/cart | Add item to cart |
| GET | /api/cart | View cart |
| DELETE | /api/cart/:productId | Remove cart item |
| POST | /api/checkout | Prepare checkout |
| POST | /api/payment/simulate | Simulate payment |
| GET | /api/orders | View order history |

Authenticated endpoints require a valid JWT token.

## Security Measures

- Passwords are stored as bcrypt hashes.
- JWT authentication protects user-specific routes.
- Helmet adds HTTP security headers.
- Environment variables are used for private configuration.
- Database queries use parameterized inputs.

## Conclusion

The project demonstrates the development of a basic secure e-commerce system with user authentication, persistent cart management, checkout simulation, and automatic inventory adjustment.

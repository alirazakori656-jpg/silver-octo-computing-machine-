# ShopEase

A runnable full-stack ecommerce starter using Node.js, Express and SQLite.

## Run

1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`.

## Included

- Responsive modern storefront
- Product search and sorting
- Categories
- Product cards
- Cart with localStorage
- Checkout
- Cash on Delivery / Bank Transfer / Online Payment selection
- Persistent SQLite orders and products
- Order tracking/statuses
- Admin dashboard statistics
- Add products from admin dashboard
- Order status management
- SEO meta basics
- Mobile responsive design

## Production notes

This is a strong starter, not a finished payment/authentication deployment. Before production, add real authentication/authorization, password hashing, CSRF protection, rate limiting, server-side validation, HTTPS, real payment gateway integration, image uploads/storage, email/SMS notifications, and proper secret management.

Set `SESSION_SECRET` to a long random value in production.

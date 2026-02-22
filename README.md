# Solace and Stone — E-Commerce Studio

A premium front-end ecommerce experience with account, loyalty, reviews, wishlist, analytics, and a lightweight Node API for auth, orders, and Stripe test payments.

## Features
- Full catalog, filters, cart, checkout, and order success flow
- Account: loyalty tier, returns, tracking, reorder, invoice download
- Wishlist + recently viewed + reviews
- Admin analytics dashboard with CSV export
- Optional Node API + Stripe test payments

## Quick Start (Front-End Only)
1. Open `index.html` in a local server (VS Code Live Server or similar).
2. The site runs fully with localStorage data and demo order seeding.

## Backend Setup (Node API + Stripe)
1. Install dependencies:
   ```
   npm install
   ```
2. Create env file:
   ```
   copy server\.env.example server\.env
   ```
3. Update `server/.env`:
   - `STRIPE_SECRET_KEY` from Stripe dashboard
   - `ADMIN_EMAILS` for admin access
4. Start the API:
   ```
   npm run dev
   ```
5. Configure the frontend in `js/config.js`:
   ```
   window.API_BASE = 'http://localhost:4000';
   window.STRIPE_PUBLISHABLE_KEY = 'pk_test_your_key_here';
   ```

## Stripe Test Card
Use Stripe test card  with any future date and any CVC.

## Tests
Run:
```
npm test
```

## Deployment Notes
1. Frontend: deploy static files to Netlify/Vercel.
2. Backend: deploy `server/` to Render/Fly/Heroku.
3. Set `API_BASE` + `STRIPE_PUBLISHABLE_KEY` in `js/config.js` to the deployed API.

## Admin Access
Set `ADMIN_EMAILS` in `server/.env`. Any user with a matching email can view all orders on `admin.html`.

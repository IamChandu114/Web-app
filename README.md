# Solace and Stone — E-Commerce Studio

A premium front-end ecommerce experience with account, loyalty, reviews, wishlist, analytics, and a lightweight Node API for auth, orders, and Stripe test payments.

# Live Demo — https://web-app-nu-umber.vercel.app/
Visit the Web https://web-app-nu-umber.vercel.app/ 
## Features
- Full catalog, filters, cart, checkout, and order success flow
- Account: loyalty tier, returns, tracking, reorder, invoice download
- Wishlist + recently viewed + reviews
- Admin analytics dashboard with CSV export
- Optional Node API + Stripe test payments

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
4. 
5. Start the API:
   ```
   npm run dev
   ```
6. Configure the frontend in `js/config.js`:
   ```
   window.API_BASE = 'http://localhost:4000';

   ```

## Stripe Test Card
Use Stripe test card  with any future date and any CVC.

## Tests
Run:
```
npm test
```

# Shivam Store

I’m building **Shivam Store** as a full-stack online storefront inspired by the experience of a neighborhood bakery and grocery shop. My goal is to make it easy for customers to discover everyday products, order cakes for special occasions, and manage their purchases, while giving the store team tools to run the business.

This project is built with the **MERN stack**: MongoDB, Express, React, and Node.js. I’m also exploring how AI can make shopping and store operations more helpful. The current codebase includes the store, checkout, custom cake requests, administration, and live customer support features; an AI assistant or other AI-powered features are future development ideas and are not implemented yet.

## What I’m building

- A responsive storefront with product search, categories, product details, a cart, and wishlist.
- Product detail pages with category, price, and keyword based recommendations.
- Customer accounts, Google sign-in support, saved addresses, order history, and notifications.
- Checkout with delivery scheduling, coupons, cash on delivery, and optional Razorpay online payments.
- Custom cake requests with size, flavor, shape, toppings, message, delivery details, and an optional reference photo.
- An admin area for managing products, inventory, orders, custom cake requests, and customer conversations.
- Per-account notification preferences for customers and admins, including event types, email, sound choice, volume, and optional custom sounds.
- Admin product image capture and multi-image uploads with previews, main-image selection, validation, and upload progress.
- Live customer and admin chat using Socket.IO.
- An AI-ready direction for future features such as product discovery, shopping assistance, and operational insights.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, Vite, React Router, Zustand, Tailwind CSS |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB with Mongoose |
| Authentication | JWT, bcrypt, Google sign-in support |
| Payments and media | Razorpay integration, optional Cloudinary storage |
| Validation and security | Zod, Helmet, rate limiting, MongoDB input sanitization |

## Project structure

```text
client/                 React storefront and admin interface
  src/pages/            Shop, product, cart, checkout, account, chat, admin
  public/img/            Store and product images
server/                 Express API and Socket.IO server
  src/models.js          MongoDB models
  src/*Routes.js         API routes for shop, authentication, and admin
  src/seed.js            Sample catalog and store data
```

## Getting started

### Requirements

- Node.js 18 or later and npm
- A MongoDB database, local or hosted

### Install dependencies

From the project root:

```bash
npm install
```

### Configure the server

Copy `server/.env.example` to `server/.env` and set at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/shivam-store
JWT_SECRET=replace-this-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
PORT=5000
```

The server can also use optional settings for Google sign-in, Razorpay, Cloudinary, SMTP email, delivery fees, and store time zone. Those integrations need their corresponding credentials to work. Keep real secrets in your local environment; do not commit them.

### Web Push notifications

Offline Web Push requires a VAPID key pair and an HTTPS site. Generate a pair with `npx web-push generate-vapid-keys`, then add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to the Render service environment. Keep the private key only on Render. Set the matching public key as `VITE_VAPID_PUBLIC_KEY` in the Vercel project before building the client. Keep the existing `VITE_API_URL` pointed at the Render API origin.

Customers can enable push from Account → Notifications after granting browser permission. Android Chrome supports browser push over HTTPS; on iPhone/iPad, add the site to the Home Screen and open it from that icon before enabling push. Push delivery depends on browser and operating-system support, connectivity, and notification permission; delivery time is not guaranteed. Subscriptions are stored per device and invalid subscriptions are removed when the push service reports that they have expired.

### Start the app

Run both the API and the Vite development server from the root:

```bash
npm run dev
```

The client runs at `http://localhost:5173` and the API defaults to `http://localhost:5000`.

To load the sample categories, products, delivery slots, banner, and coupon into MongoDB, run:

```bash
npm run seed
```

The seed script does not create user accounts. Create an account through the app, and configure an admin account/role in the database before using the admin area.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the client and API in development mode |
| `npm run build` | Build the client for production |
| `npm start` | Start the API server |
| `npm run seed` | Add or update sample store data |

## Configuration notes

- Online payments require `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server. `TEST_PAYMENT=true` enables the local test-payment flow only outside production.
- Google sign-in requires the client ID on both sides: `VITE_GOOGLE_CLIENT_ID` for the client and `GOOGLE_CLIENT_ID` for the server.
- Cloudinary and SMTP are optional. The app can run without them, but their related hosted image and email functions need configuration.
- The server creates an `uploads/` directory for uploaded files when it starts.

## AI roadmap

I want to extend the shopping experience with AI in a practical way—for example, helping customers find products using natural-language requests or suggesting items based on their needs. I’ll add an AI provider and features when I choose the integration and define how customer and store data should be handled. **There is no AI model/API integration in the current codebase.**

## Current status

This is an actively developed project. Payment, Google sign-in, email, and cloud media depend on external credentials and configuration. Review the available settings in `server/.env.example` before deploying, and use a production-ready MongoDB URI and strong secrets for a live environment.

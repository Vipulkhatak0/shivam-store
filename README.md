# Shivam Store
Fresh Cakes • Snacks • Everyday Essentials. Bakery + grocery ordering with real-time admin notifications, custom cake requests, chat and Razorpay payments.

**Stack:** React + Vite + Tailwind + Zustand (client) · Node + Express + Socket.IO + Mongoose (server) · MongoDB · JWT · Nodemailer · Razorpay.

## Quick start
1. Install Node 18+ and MongoDB (local, or a free MongoDB Atlas URI).
2. `cp server/.env.example server/.env` and set `MONGODB_URI` and `JWT_SECRET`.
3. `cp client/.env.example client/.env` (default API is http://localhost:5000).
4. From this folder:
```
npm install
npm run seed      # categories, products, SHIVAM10 coupon, admin account
npm run dev       # API :5000, site :5173
npm run build     # production client build -> client/dist
npm run start     # production API
```
**Admin:** open `/admin/login` — `admin@shivamstore.com` / `ChangeMe123!` (you are forced to change it on first login).

## Design
The UI follows your `shivamm.png` reference. The chubby baker mascot, hero art and product/category images were cropped straight from it into `client/public/img` (the logo, hero, login card and the Chocolate Cake, Black Forest, Oreo, Lays, Milk Bread and Namkeen photos). Products without art in the reference (e.g. Butterscotch Cake, Croissant) show an emoji tile until you upload a photo in Admin → Products. Re-crop or swap any file in that folder to change the art.

## Services (all optional locally, all fail loudly if missing)
- **Google login:** create an OAuth *Web* client at console.cloud.google.com, add your site URL under "Authorized JavaScript origins", then set `GOOGLE_CLIENT_ID` (server/.env) and `VITE_GOOGLE_CLIENT_ID` (client/.env) to the same ID. Without them the Google button explains that it is not configured.
- **Cloudinary (optional):** set `CLOUDINARY_*` in server/.env and uploads go to Cloudinary; otherwise they are saved in `server/uploads`.
- **Email/OTP:** set `SMTP_*`. With no SMTP in development the OTP is printed in the server terminal. In production a missing SMTP returns a configuration error.
- **Razorpay:** set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Payments are verified server-side with an HMAC signature. Without keys, "Pay online" returns "Online payments are not configured". For local demos only, `TEST_PAYMENT=true` enables a clearly labelled test mode (disabled when `NODE_ENV=production`).
- **Images:** product and reference photos are stored in `server/uploads` (served at `/uploads`). On Render/Railway use a persistent disk, or swap multer's storage for Cloudinary.

## The custom cake flow
Customer: Chocolate Cake → Customize (size, flavor, shape, eggless, message, photo, toppings, date/time) → **Request Custom Cake** → admin gets a real-time "🔔 New Custom Cake Request" (Accept ₹ / Reject / Chat) → on accept the customer gets "🎂 Your custom cake request has been accepted!" with **Confirm & Pay** → payment → order is created → admin moves it Preparing → Ready → Out for Delivery → Delivered, customer notified at each step.
Prices are always calculated on the server (cakes are priced per KG + toppings + shape).

## Real-time
Socket.IO is authenticated with the JWT. Rooms: `user:<id>` and `admin`. Events: `notification:new`, `order:created`, `order:updated`, `custom-order:new`, `custom-order:updated`, `chat:message`, `inventory:updated`. The server decides the room from the token; clients cannot choose a user id.

## API (JSON: `{success, message, data}` / `{success:false, message, errorCode}`)
Auth: `POST /api/auth/{register,verify-otp,resend-otp,login,google,forgot-password,reset-password,logout,change-password}`, `GET|PATCH /api/auth/me`
Shop: `GET /api/categories`, `GET /api/products?q&category&sort&page&eggless&customizable&maxPrice`, `GET /api/products/:slug`, `POST /api/coupons/validate`
Orders: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/{verify,cancel}`
Custom: `POST /api/custom-orders/estimate`, `POST|GET /api/custom-orders`, `POST /api/custom-orders/:id/pay`
Other: `GET /api/notifications`, `POST /api/notifications/read`, `GET|POST /api/chat`, `GET|POST /api/wishlist[/:id]`, `GET|POST|DELETE /api/addresses`, `GET|POST /api/products/:id/reviews`, `GET /api/orders/:id/reorder`, `GET /api/banner`, `GET /api/delivery-slots`, `GET /sitemap.xml`
Admin (role ADMIN): `/api/admin/{dashboard,orders,custom-orders,products,categories,customers,coupons,audit,chat}`

## Deployment
- **Database:** MongoDB Atlas → copy the URI into `MONGODB_URI`.
- **API (Render/Railway):** root `server`, build `npm install`, start `npm run start`. Set all env vars, `NODE_ENV=production`, `CLIENT_URL=<your Vercel URL>`. Run `npm run seed` once.
- **Site (Vercel):** root `client`, build `npm run build`, output `dist`, env `VITE_API_URL=<API URL>`. Add a rewrite of all paths to `/index.html` for React Router.

## Not built yet
TypeScript (the code is JavaScript/ESM), refresh tokens (one 7-day login token is used), Framer Motion / TanStack Query / React Hook Form, review photos, a manual "create order" button in admin, category image upload in admin, SMS/WhatsApp, and saved-payment methods. Nothing here has been run end to end yet: expect to fix a few errors on first `npm run dev`.

## Test checklist
Register → OTP → login · search/filter/sort · add to cart · coupon `SHIVAM10` · COD checkout · forgot password · wishlist heart · saved address at checkout · reorder · leave a review after delivery · chat with a photo and typing indicator · edit the Today's Special banner and delivery slots in Admin → Settings · admin receives order live · accept/prepare/deliver and watch the customer's tracker · custom cake request → accept/reject → pay → order · chat both ways · add product (customers get a notification) · stock drops on order and restores on cancel · low-stock alert · mobile layout at 320–414px · admin panel on mobile.

import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { AppError, setIO, userFromToken } from './util.js';
import authRoutes from './authRoutes.js';
import shopRoutes from './shopRoutes.js';
import adminRoutes from './adminRoutes.js';
import adminExtra from './adminExtra.js';
import extraRoutes from './extraRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import { Product } from './models.js';

for (const k of ['MONGODB_URI', 'JWT_SECRET']) if (!process.env[k]) { console.error(`Missing ${k}. Copy server/.env.example to server/.env and fill it in.`); process.exit(1); }
fs.mkdirSync('uploads', { recursive: true });

const app = express();
const server = http.createServer(app);
const origin = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
const io = new Server(server, { cors: { origin, credentials: true } });
setIO(io);
io.use(async (s, next) => { const u = await userFromToken(s.handshake.auth?.token); if (!u) return next(new Error('UNAUTHORIZED')); s.user = u; next(); });
io.on('connection', (s) => {
  s.join(`user:${s.user._id}`); if (s.user.role === 'ADMIN') s.join('admin');
  // Typing indicator: the sender is always taken from the verified token, never from the client.
  s.on('chat:typing', (d) => {
    if (s.user.role === 'ADMIN') { if (typeof d?.to === 'string') io.to(`user:${d.to}`).emit('chat:typing', { from: 'admin' }); }
    else io.to('admin').emit('chat:typing', { from: String(s.user._id) });
  });
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(mongoSanitize());
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60e3, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (q, r) => r.json({ success: true, message: 'ok', data: {} }));
app.use('/api/auth', authRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminExtra);
app.use('/api', extraRoutes);
app.use('/api', shopRoutes);
app.get('/sitemap.xml', async (q, r) => {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0];
  const ps = await Product.find({ active: true }).select('slug updatedAt');
  const urls = ['', '/shop', ...ps.map((p) => `/product/${p.slug}`)].map((u) => `<url><loc>${base}${u}</loc></url>`).join('');
  r.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});
app.use((q, r, n) => n(new AppError('Not found.', 'NOT_FOUND', 404)));
app.use((e, req, res, next) => {
  let status = e.status || 500, message = e.message, code = e.errorCode || 'SERVER_ERROR';
  if (e.name === 'CastError' || e.name === 'ValidationError') { status = 400; code = 'VALIDATION_ERROR'; message = 'Some of the details sent were invalid.'; }
  else if (e.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'That already exists.'; }
  else if (e.name === 'MulterError') { status = 422; code = 'UPLOAD_ERROR'; message = e.message; }
  else if (!e.status) { console.error(e); message = 'Something went wrong on our side. Please try again.'; }
  res.status(status).json({ success: false, message, errorCode: code });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => server.listen(process.env.PORT || 5000, () => console.log(`Shivam Store API on :${process.env.PORT || 5000}`)))
  .catch((e) => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });

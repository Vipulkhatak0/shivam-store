import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from './models.js';
import { OAuth2Client } from 'google-auth-library';
import { ok, AppError, wrap, auth, validate, sign, sendMail, mailHtml } from './util.js';
const r = Router();

async function issueOtp(u) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  u.otp = await bcrypt.hash(otp, 8); u.otpExpires = new Date(Date.now() + 5 * 60e3); u.otpTries = 0; await u.save();
  await sendMail(u.email, 'Your Shivam Store verification code', `Your Shivam Store verification code is ${otp}. It expires in 5 minutes.`, mailHtml('Your verification code', `Your Shivam Store verification code is <b style="font-size:22px;letter-spacing:3px">${otp}</b>.<br>It expires in 5 minutes.`));
}
const email = z.string().email().transform((s) => s.toLowerCase());

r.post('/register', validate(z.object({
  name: z.string().min(2).max(60), email,
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(8).max(72),
})), wrap(async (req, res) => {
  const { name, phone, password } = req.body;
  let u = await User.findOne({ email: req.body.email });
  if (u?.verified) throw new AppError('An account with this email already exists.', 'EMAIL_EXISTS', 409);
  u = u || new User({ email: req.body.email });
  Object.assign(u, { name, phone, password: await bcrypt.hash(password, 10) });
  await issueOtp(u); ok(res, { email: u.email }, 'Verification code sent to your email.', 201);
}));

r.post('/resend-otp', validate(z.object({ email })), wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || u.verified) throw new AppError('No pending verification for this email.', 'NOT_FOUND', 404);
  await issueOtp(u); ok(res, {}, 'A new code has been sent.');
}));

r.post('/verify-otp', validate(z.object({ email, otp: z.string().length(6) })), wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !u.otp) throw new AppError('No verification pending for this email.', 'NOT_FOUND', 404);
  if (u.otpTries >= 5) throw new AppError('Too many attempts. Request a new code.', 'OTP_LOCKED', 429);
  if (u.otpExpires < new Date()) throw new AppError('This code has expired. Request a new one.', 'OTP_EXPIRED');
  u.otpTries += 1;
  if (!(await bcrypt.compare(req.body.otp, u.otp))) { await u.save(); throw new AppError('Incorrect code.', 'OTP_INVALID'); }
  u.verified = true; u.otp = undefined; u.otpExpires = undefined; await u.save();
  ok(res, {}, 'Email verified. You can log in now.');
}));

r.post('/login', validate(z.object({ email, password: z.string().min(1) })), wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u || !u.password || !(await bcrypt.compare(req.body.password, u.password))) throw new AppError('Incorrect email or password.', 'INVALID_CREDENTIALS', 401);
  if (!u.active) throw new AppError('This account has been disabled.', 'ACCOUNT_DISABLED', 403);
  if (!u.verified) throw new AppError('Please verify your email first.', 'NOT_VERIFIED', 403);
  ok(res, { token: sign(u), user: u });
}));

r.get('/me', auth, (req, res) => ok(res, { user: req.user }));
r.post('/logout', (req, res) => ok(res, {}, 'Logged out.'));
r.post('/change-password', auth, validate(z.object({ current: z.string(), password: z.string().min(8).max(72) })), wrap(async (req, res) => {
  if (!req.user.password) throw new AppError('This account signs in with Google. Use “Forgot password” on the login page to set a password.', 'NO_PASSWORD');
  if (!(await bcrypt.compare(req.body.current, req.user.password))) throw new AppError('Current password is incorrect.', 'INVALID_CREDENTIALS', 401);
  req.user.password = await bcrypt.hash(req.body.password, 10); req.user.mustChangePassword = false; await req.user.save();
  ok(res, { user: req.user }, 'Password updated.');
}));

async function checkOtp(u, otp) {
  if (!u || !u.otp) throw new AppError('No code is pending for this email.', 'NOT_FOUND', 404);
  if (u.otpTries >= 5) throw new AppError('Too many attempts. Request a new code.', 'OTP_LOCKED', 429);
  if (u.otpExpires < new Date()) throw new AppError('This code has expired. Request a new one.', 'OTP_EXPIRED');
  u.otpTries += 1;
  if (!(await bcrypt.compare(otp, u.otp))) { await u.save(); throw new AppError('Incorrect code.', 'OTP_INVALID'); }
}
r.post('/forgot-password', validate(z.object({ email })), wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email, verified: true });
  if (u && u.active) await issueOtp(u);
  ok(res, {}, 'If that email has an account, a reset code is on its way.');
}));
r.post('/reset-password', validate(z.object({ email, otp: z.string().length(6), password: z.string().min(8).max(72) })), wrap(async (req, res) => {
  const u = await User.findOne({ email: req.body.email, verified: true });
  await checkOtp(u, req.body.otp);
  u.password = await bcrypt.hash(req.body.password, 10); u.otp = undefined; u.otpExpires = undefined; await u.save();
  ok(res, {}, 'Password updated. You can log in now.');
}));
r.post('/google', validate(z.object({ credential: z.string().min(10) })), wrap(async (req, res) => {
  const cid = process.env.GOOGLE_CLIENT_ID;
  if (!cid) throw new AppError('Google login is not configured on this server.', 'GOOGLE_NOT_CONFIGURED', 503);
  let p;
  try { p = (await new OAuth2Client(cid).verifyIdToken({ idToken: req.body.credential, audience: cid })).getPayload(); }
  catch { throw new AppError('Google sign-in failed. Please try again.', 'GOOGLE_FAILED', 401); }
  if (!p?.email || !p.email_verified) throw new AppError('Your Google email is not verified.', 'GOOGLE_FAILED', 401);
  const email = p.email.toLowerCase(); let u = await User.findOne({ email });
  if (!u) u = await User.create({ name: p.name || email.split('@')[0], email, googleId: p.sub, avatar: p.picture, verified: true });
  else {
    if (!u.verified) u.password = undefined; // never keep a password set by someone who did not prove ownership of this email
    u.googleId = u.googleId || p.sub; u.avatar = u.avatar || p.picture; u.verified = true; await u.save();
  }
  if (!u.active) throw new AppError('This account has been disabled.', 'ACCOUNT_DISABLED', 403);
  ok(res, { token: sign(u), user: u });
}));
r.patch('/me', auth, validate(z.object({ name: z.string().min(2).max(60).optional(), phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number').optional() })), wrap(async (req, res) => {
  Object.assign(req.user, req.body); await req.user.save(); ok(res, { user: req.user }, 'Profile updated.');
}));
export default r;

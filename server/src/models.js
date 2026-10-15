import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const T = { timestamps: true };
const hide = (s) => s.set('toJSON', { transform: (d, r) => { delete r.password; delete r.otp; delete r.otpExpires; delete r.otpTries; return r; } });
const id = (ref) => ({ type: Schema.Types.ObjectId, ref });

const userS = new Schema({
  name: String, phone: String, password: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['CUSTOMER', 'ADMIN'], default: 'CUSTOMER' },
  verified: { type: Boolean, default: false }, active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  googleId: String, avatar: String,
  addresses: [{ label: String, name: String, phone: String, line1: String, area: String, city: String, pincode: String, landmark: String }],
  wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  otp: String, otpExpires: Date, otpTries: { type: Number, default: 0 },
}, T); hide(userS);
export const User = model('User', userS);

export const Category = model('Category', new Schema({
  name: String, slug: { type: String, unique: true }, emoji: String, image: String,
  order: { type: Number, default: 0 }, active: { type: Boolean, default: true },
}));

const productS = new Schema({
  name: { type: String, required: true }, slug: { type: String, unique: true }, description: String,
  category: id('Category'), image: String, images: [String], emoji: String, brand: String, condition: String,
  price: { type: Number, min: 0, required: true }, comparePrice: { type: Number, min: 0 },
  stock: { type: Number, min: 0, default: 0 }, unit: { type: String, default: 'pc' },
  active: { type: Boolean, default: true }, featured: Boolean, popular: Boolean,
  customizable: Boolean, eggless: Boolean, tags: [String],
  rating: { type: Number, default: 0 }, reviewCount: { type: Number, default: 0 },
}, T);
productS.index({ active: 1, category: 1, stock: 1, price: 1 });
productS.index({ active: 1, popular: -1, featured: -1 });
export const Product = model('Product', productS);

const addr = { name: String, phone: String, line1: String, area: String, city: String, pincode: String, landmark: String };
export const Order = model('Order', new Schema({
  code: { type: String, unique: true }, user: id('User'),
  items: [{ product: id('Product'), name: String, price: Number, qty: Number }],
  subtotal: Number, deliveryFee: Number, discount: Number, total: Number, coupon: String,
  address: addr, deliveryDate: String, deliverySlot: String, note: String,
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'] },
  payment: { method: String, status: { type: String, default: 'UNPAID' }, razorpayOrderId: String, paymentId: String, signature: String, amount: Number, test: Boolean },
  customRequest: id('CustomRequest'), stockRestored: Boolean,
  history: [{ status: String, at: { type: Date, default: Date.now } }],
}, T));

export const CustomRequest = model('CustomRequest', new Schema({
  code: String, user: id('User'), product: id('Product'), productName: String,
  customization: { kg: Number, flavor: String, shape: String, cream: String, theme: String, eggless: Boolean, message: String, notes: String, toppings: [String], photo: String },
  deliveryDate: String, deliveryTime: String, address: addr,
  estimatedPrice: Number, finalPrice: Number, rejectReason: String, order: id('Order'),
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'PAID'] },
}, T));

export const Notification = model('Notification', new Schema({
  user: id('User'), type: String, title: String, message: String, data: Object, read: { type: Boolean, default: false },
}, T));
const prefS = new Schema({ user: { ...id('User'), unique: true, index: true }, push: { enabled: { type: Boolean, default: true } }, sound: { enabled: { type: Boolean, default: true }, soundId: { type: String, default: 'universfield' }, volume: { type: Number, min: 0, max: 1, default: 0.7 } }, notifications: { type: Schema.Types.Mixed, default: {} }, email: { type: Schema.Types.Mixed, default: {} } }, T);
export const NotificationPreference = model('NotificationPreference', prefS);
export const Message = model('Message', new Schema({
  customer: id('User'), senderRole: String, sender: id('User'), text: String, attachments: [String], read: { type: Boolean, default: false },
}, T));
export const Coupon = model('Coupon', new Schema({
  code: { type: String, unique: true, uppercase: true }, type: { type: String, enum: ['PERCENT', 'FLAT'] },
  amount: Number, minOrder: { type: Number, default: 0 }, maxDiscount: Number, expiresAt: Date,
  usageLimit: Number, used: { type: Number, default: 0 }, active: { type: Boolean, default: true },
}));
export const AuditLog = model('AuditLog', new Schema({ admin: id('User'), action: String, target: String }, T));

const rev = new Schema({ product: id('Product'), user: id('User'), name: String, rating: { type: Number, min: 1, max: 5 }, comment: String }, T);
rev.index({ product: 1, user: 1 }, { unique: true });
export const Review = model('Review', rev);
export const Banner = model('Banner', new Schema({ key: { type: String, unique: true }, title: String, subtitle: String, cta: String, link: String, active: { type: Boolean, default: true } }));
export const DeliverySlot = model('DeliverySlot', new Schema({ label: { type: String, unique: true }, order: { type: Number, default: 0 }, active: { type: Boolean, default: true } }));

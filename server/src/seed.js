import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Category, Product, Coupon, Banner, DeliverySlot } from './models.js';
await mongoose.connect(process.env.MONGODB_URI);

// Images live in client/public/img (cropped from the Shivam Store reference art). Items without an image show an emoji tile.
const cats = [['Cakes', '🎂', '/img/cat-cakes.png'], ['Biscuits', '🍪', '/img/cat-biscuits.png'], ['Snacks', '🍟', '/img/cat-snacks.png'], ['Grocery', '🛒', '/img/cat-grocery.png'], ['Bread', '🍞', '/img/bread.png'], ['Dairy', '🥛', '/img/milk.png'], ['Chocolates', '🍫'], ['Namkeen', '🥨', '/img/namkeen.png'], ['Cold Drinks', '🥤'], ['Bakery Specials', '🥐']];
const C = {};
for (const [i, [name, emoji, image]] of cats.entries()) {
  const slug = name.toLowerCase().replace(/ /g, '-');
  C[name] = await Category.findOneAndUpdate({ slug }, { name, slug, emoji, image, order: i, active: true }, { upsert: true, new: true });
}
// Customizable cakes: price is for 1 KG. Other sizes use multipliers on the server (2 KG = 1.8x).
const P = [
  ['Chocolate Cake', 'Cakes', 499, 549, 8, '1 kg', '🍫', '/img/choc-cake.png', { customizable: true, eggless: true, popular: true, featured: true }, 'Rich chocolate sponge with ganache and strawberries.'],
  ['Black Forest Cake', 'Cakes', 599, 649, 6, '1 kg', '🍒', '/img/black-forest.png', { customizable: true, eggless: true, popular: true, featured: true }, 'Cherries, whipped cream and chocolate shavings.'],
  ['Butterscotch Cake', 'Cakes', 549, 0, 5, '1 kg', '🧁', undefined, { customizable: true, eggless: true }, 'Crunchy butterscotch praline.'],
  ['Red Velvet Cake', 'Cakes', 649, 699, 4, '1 kg', '❤️', undefined, { customizable: true, eggless: true }, 'Cream cheese frosting.'],
  ['Oreo Biscuits', 'Biscuits', 40, 45, 120, 'pack', '🍪', '/img/oreo.png', { popular: true, featured: true, eggless: true }, 'Chocolate sandwich biscuits.'],
  ['Choco Chip Cookies', 'Biscuits', 120, 0, 40, 'pack', '🍪', '/img/cat-biscuits.png', { popular: true }, 'Baked fresh every morning.'],
  ['Lays Classic', 'Snacks', 30, 0, 200, 'pack', '🥔', '/img/lays.png', { popular: true, featured: true, eggless: true }, 'Classic salted potato chips.'],
  ['Milk Bread', 'Bread', 45, 0, 60, 'loaf', '🍞', '/img/bread.png', { popular: true, featured: true, eggless: true }, 'Soft sandwich loaf.'],
  ['Namkeen Mix', 'Namkeen', 60, 70, 80, 'pack', '🥨', '/img/namkeen.png', { popular: true, featured: true, eggless: true }, 'Crunchy savoury mix.'],
  ['Fresh Milk 1L', 'Dairy', 66, 0, 50, 'litre', '🥛', '/img/milk.png', { eggless: true }, 'Toned milk.'],
  ['Dairy Milk Silk', 'Chocolates', 90, 0, 70, 'bar', '🍫', undefined, { popular: true, eggless: true }, 'Smooth milk chocolate.'],
  ['Cold Drink 750ml', 'Cold Drinks', 40, 0, 90, 'bottle', '🥤', undefined, { eggless: true }, 'Chilled soft drink.'],
  ['Butter Croissant', 'Bakery Specials', 90, 0, 25, 'pc', '🥐', undefined, {}, 'Flaky and buttery.'],
  ['Atta 5kg', 'Grocery', 245, 260, 40, 'pack', '🌾', '/img/cat-grocery.png', { eggless: true }, 'Whole wheat flour.'],
];
for (const [name, cat, price, cmp, stock, unit, emoji, image, flags, description] of P) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await Product.findOneAndUpdate({ slug }, { name, slug, category: C[cat]._id, price, comparePrice: cmp || undefined, stock, unit, emoji, image, description, tags: [name.toLowerCase(), cat.toLowerCase()], active: true, ...flags }, { upsert: true });
}
for (const [i, label] of ['ASAP', '10-12', '12-2', '2-4', '4-6', '6-8', '8-10'].entries()) await DeliverySlot.findOneAndUpdate({ label }, { label, order: i }, { upsert: true });
await Banner.findOneAndUpdate({ key: 'special' }, { key: 'special', title: 'Delicious Cakes', subtitle: 'For Every Occasion', cta: 'Order Now', link: '/shop/cakes', active: true }, { upsert: true });
await Coupon.findOneAndUpdate({ code: 'SHIVAM10' }, { code: 'SHIVAM10', type: 'PERCENT', amount: 10, minOrder: 200, maxDiscount: 100, active: true }, { upsert: true });
if (!(await User.findOne({ email: 'admin@shivamstore.com' })))
  await User.create({ name: 'Shivam Admin', email: 'admin@shivamstore.com', phone: '9999999999', password: await bcrypt.hash('ChangeMe123!', 10), role: 'ADMIN', verified: true, mustChangePassword: true });
console.log('Seeded. Admin: admin@shivamstore.com / ChangeMe123!  (you must change it on first login)');
await mongoose.disconnect();

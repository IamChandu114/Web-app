const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  hashPassword,
  verifyPassword,
  createToken,
  createId
} = require('./utils');
const {
  getUsers,
  setUsers,
  getOrders,
  setOrders,
  getSessions,
  setSessions
} = require('./store');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, '..');
app.use(express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 4000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

const isAdminEmail = email => {
  const lower = (email || '').toLowerCase();
  return ADMIN_EMAILS.includes(lower) || lower.endsWith('@solaceandstone.com');
};

const publicUser = user => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const sessions = getSessions();
  const session = sessions.find(item => item.token === token);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const users = getUsers();
  const user = users.find(item => item.id === session.userId);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.user = user;
  req.session = session;
  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const users = getUsers();
  if (users.find(user => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'Email already in use' });
  }
  const user = {
    id: createId('usr'),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    isAdmin: isAdminEmail(email)
  };
  users.push(user);
  setUsers(users);

  const token = createToken();
  const sessions = getSessions();
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  setSessions(sessions);

  res.json({ user: publicUser(user), token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const users = getUsers();
  const user = users.find(item => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = createToken();
  const sessions = getSessions();
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  setSessions(sessions);
  res.json({ user: publicUser(user), token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = getOrders();
  const isAdmin = req.user.isAdmin;
  if (req.query.all === '1' && isAdmin) {
    return res.json({ orders });
  }
  const ownOrders = orders.filter(order => order.userId === req.user.id);
  res.json({ orders: ownOrders });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const payload = req.body || {};
  if (!payload.items || !payload.items.length) {
    return res.status(400).json({ message: 'Order has no items' });
  }
  const orders = getOrders();
  const order = {
    ...payload,
    id: payload.id || createId('ord'),
    userId: req.user.id,
    createdAt: payload.createdAt || new Date().toISOString()
  };
  orders.unshift(order);
  setOrders(orders);
  res.json({ order });
});

app.patch('/api/orders/:id', authMiddleware, (req, res) => {
  const orders = getOrders();
  const order = orders.find(item => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  const isOwner = order.userId === req.user.id;
  if (!isOwner && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const allowed = [
    'returnRequested',
    'canceledAt',
    'canceledReason',
    'shippingMethod',
    'shippingEta',
    'paymentStatus',
    'paymentIntentId'
  ];
  allowed.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      order[field] = req.body[field];
    }
  });
  setOrders(orders);
  res.json({ order });
});

app.post('/api/payments/intent', authMiddleware, async (req, res) => {
  if (!stripe) {
    return res.status(400).json({ message: 'Stripe not configured' });
  }
  const { amount, currency } = req.body || {};
  if (!amount || !currency) {
    return res.status(400).json({ message: 'Missing amount or currency' });
  }
  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true }
    });
    res.json({ clientSecret: intent.client_secret, id: intent.id });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Stripe error' });
  }
});

app.use((err, req, res, next) => {
  if (err) {
    res.status(500).json({ message: 'Server error' });
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

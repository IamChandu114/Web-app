const products = window.LUX_PRODUCTS || [];

const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
const STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || '';
const useApi = Boolean(API_BASE);

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const byId = id => document.getElementById(id);

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch (e) {
    return null;
  }
};

const setUser = user => {
  localStorage.setItem('user', JSON.stringify(user));
};

const clearUser = () => {
  localStorage.removeItem('user');
  clearAuthToken();
};

const hasSeenOnboarding = () => localStorage.getItem('onboardingSeen') === '1';
const markOnboardingSeen = () => localStorage.setItem('onboardingSeen', '1');
const emitAuthChanged = () => document.dispatchEvent(new CustomEvent('auth:changed'));
const emitWishlistChanged = () => document.dispatchEvent(new CustomEvent('wishlist:changed'));

const getAuthToken = () => localStorage.getItem('authToken') || '';
const setAuthToken = token => localStorage.setItem('authToken', token);
const clearAuthToken = () => localStorage.removeItem('authToken');

const parseMoney = value => Number(String(value || '').replace(/[^0-9.-]+/g, '')) || 0;

const getStoreCredit = () => Number(localStorage.getItem('storeCredit') || 0);
const setStoreCredit = value => localStorage.setItem('storeCredit', Number(value || 0).toFixed(2));

const getSavedAddress = () => {
  try {
    return JSON.parse(localStorage.getItem('savedAddress') || 'null');
  } catch (e) {
    return null;
  }
};

const setSavedAddress = address => {
  localStorage.setItem('savedAddress', JSON.stringify(address));
};

const getCart = () => {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch (e) {
    return [];
  }
};

const apiFetch = async (path, options = {}) => {
  if (!useApi) throw new Error('API not configured');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
};

const apiRegister = payload => apiFetch('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify(payload)
});

const apiLogin = payload => apiFetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify(payload)
});

const apiMe = () => apiFetch('/api/auth/me');

const apiGetOrders = (all = false) => apiFetch(`/api/orders${all ? '?all=1' : ''}`);

const apiCreateOrder = payload => apiFetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify(payload)
});

const apiUpdateOrder = (orderId, payload) => apiFetch(`/api/orders/${orderId}`, {
  method: 'PATCH',
  body: JSON.stringify(payload)
});

const apiCreatePaymentIntent = payload => apiFetch('/api/payments/intent', {
  method: 'POST',
  body: JSON.stringify(payload)
});

const initApiSession = () => {
  if (!useApi) return;
  const token = getAuthToken();
  if (!token) return;
  apiMe()
    .then(data => {
      if (data && data.user) {
        setUser(data.user);
        emitAuthChanged();
      }
    })
    .catch(() => {
      clearAuthToken();
    });
};

const getWishlist = () => {
  try {
    return JSON.parse(localStorage.getItem('wishlist')) || [];
  } catch (e) {
    return [];
  }
};

const saveWishlist = list => {
  localStorage.setItem('wishlist', JSON.stringify(list));
  emitWishlistChanged();
};

const addToWishlist = productId => {
  const list = getWishlist();
  if (!list.includes(productId)) {
    list.unshift(productId);
    saveWishlist(list.slice(0, 50));
  }
  return true;
};

const removeFromWishlist = productId => {
  const list = getWishlist().filter(id => id !== productId);
  saveWishlist(list);
  return false;
};

const toggleWishlist = productId => {
  const list = getWishlist();
  if (list.includes(productId)) {
    removeFromWishlist(productId);
    return false;
  }
  addToWishlist(productId);
  return true;
};

const syncWishlistUI = () => {
  const list = getWishlist();
  document.querySelectorAll('[data-wishlist]').forEach(btn => {
    const id = btn.getAttribute('data-product');
    if (!id) return;
    const active = list.includes(id);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (btn.id === 'wishlistBtn') {
      btn.textContent = active ? 'Saved' : 'Save to wishlist';
    }
  });
};

const getRecentlyViewed = () => {
  try {
    return JSON.parse(localStorage.getItem('recentlyViewed')) || [];
  } catch (e) {
    return [];
  }
};

const saveRecentlyViewed = list => {
  localStorage.setItem('recentlyViewed', JSON.stringify(list));
};

const seedDemoOrder = () => {
  if (useApi) return false;
  const existing = JSON.parse(localStorage.getItem('orders') || '[]');
  if (existing.length) return false;
  if (localStorage.getItem('demoSeeded') === '1') return false;
  if (!products.length) return false;

  const picks = products.slice(0, 3).map((product, index) => {
    const { color, size } = getDefaultVariant(product);
    const qty = index === 0 ? 2 : 1;
    return {
      key: makeKey(product.id, color, size),
      id: product.id,
      name: product.name,
      price: product.price,
      qty,
      color,
      size,
      image: product.image,
      g1: product.g1,
      g2: product.g2
    };
  });

  const subtotal = picks.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingCost = subtotal >= 200 ? 0 : 12;
  const tax = subtotal * 0.085;
  const total = subtotal + shippingCost + tax;

  const order = {
    id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    createdAt: new Date().toISOString(),
    items: picks,
    subtotalValue: subtotal,
    totalValue: total,
    total: money(total),
    email: 'demo@solaceandstone.com',
    shippingMethod: 'Standard',
    shippingCost,
    shippingEta: '3-5 business days',
    paymentMethod: 'card',
    address: {
      first: 'Demo',
      last: 'Customer',
      address: '245 Studio Lane',
      apartment: 'Suite 4',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'United States'
    }
  };

  existing.unshift(order);
  localStorage.setItem('orders', JSON.stringify(existing));
  localStorage.setItem('lastOrder', JSON.stringify(order));
  localStorage.setItem('demoSeeded', '1');
  return true;
};

const getReviews = productId => {
  try {
    const stored = JSON.parse(localStorage.getItem(`reviews_${productId}`) || '[]');
    if (stored.length) return stored;
  } catch (e) {
    // ignore
  }
  const seed = [
    { name: 'Ava M.', rating: 5, title: 'Stunning quality', body: 'The finish and weight are perfect. Feels boutique and holds up beautifully.' },
    { name: 'Leo P.', rating: 4, title: 'Feels premium', body: 'Arrived fast and matches the studio styling. The texture is beautiful in person.' },
    { name: 'Zara K.', rating: 5, title: 'Worth it', body: 'Gifted this and the packaging was gorgeous. Will buy again.' }
  ];
  const seeded = seed.map((item, index) => ({
    id: `${productId}-${index}`,
    ...item,
    date: new Date(Date.now() - (index + 1) * 86400000).toISOString()
  }));
  localStorage.setItem(`reviews_${productId}`, JSON.stringify(seeded));
  return seeded;
};

const saveReviews = (productId, reviews) => {
  localStorage.setItem(`reviews_${productId}`, JSON.stringify(reviews));
};

const downloadText = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
const getDefaultVariant = product => {
  const color = product && product.colors && product.colors[0] ? product.colors[0].name : '';
  const size = product && product.sizes && product.sizes[0] ? product.sizes[0] : '';
  return { color, size };
};

const syncCardQty = (cart = null) => {
  const controls = document.querySelectorAll('[data-qty-controls]');
  if (!controls.length) return;
  const currentCart = cart || getCart();

  controls.forEach(control => {
    const productId = control.getAttribute('data-product');
    const product = products.find(item => item.id === productId);
    if (!product) return;
    const { color, size } = getDefaultVariant(product);
    const key = makeKey(productId, color, size);
    const item = currentCart.find(entry => entry.key === key);
    const actions = control.closest('[data-product-actions]');
    const addBtn = actions ? actions.querySelector('[data-add-to-cart]') : null;
    const valueEl = control.querySelector('[data-qty-value]');
    const qty = item ? item.qty : 0;

    if (valueEl) valueEl.textContent = qty > 0 ? qty : 1;
    if (qty > 0) {
      control.classList.add('active');
      control.setAttribute('aria-hidden', 'false');
      if (actions) actions.classList.add('show-qty');
      if (addBtn) addBtn.setAttribute('aria-hidden', 'true');
    } else {
      control.classList.remove('active');
      control.setAttribute('aria-hidden', 'true');
      if (actions) actions.classList.remove('show-qty');
      if (addBtn) addBtn.setAttribute('aria-hidden', 'false');
    }
  });
};

const saveCart = cart => {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  syncCardQty(cart);
};

const makeKey = (id, color, size) => `${id}|${color || ''}|${size || ''}`;

const updateCartCount = () => {
  const countEl = byId('cartCount');
  if (!countEl) return;
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = count;
};

const showToast = message => {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
};

const flashAddButton = (button, qty = 1) => {
  if (!button) return;
  const original = button.getAttribute('data-original-text') || button.textContent.trim() || 'Add';
  if (!button.hasAttribute('data-original-text')) {
    button.setAttribute('data-original-text', original);
  }
  const label = qty > 1 ? `Added x${qty}` : 'Added +1';
  button.textContent = label;
  button.classList.add('added');
  if (button._addedTimer) {
    clearTimeout(button._addedTimer);
  }
  button._addedTimer = setTimeout(() => {
    button.classList.remove('added');
    button.textContent = original;
  }, 1400);
};

const renderStars = rating => {
  const rounded = Math.round(rating);
  let stars = '';
  for (let i = 1; i <= 5; i += 1) {
    stars += `
      <svg class='star ${i <= rounded ? 'filled' : ''}' viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z'></path>
      </svg>
    `;
  }
  return `${stars}<span class='rating-number'>${rating.toFixed(1)}</span>`;
};

const formatAddress = address => {
  if (!address) return '';
  const parts = [
    `${address.first || ''} ${address.last || ''}`.trim(),
    address.address || '',
    address.apartment || '',
    `${address.city || ''}${address.city ? ', ' : ''}${address.state || ''} ${address.zip || ''}`.trim(),
    address.country || ''
  ].filter(Boolean);
  return parts.join(' • ');
};

const computeLoyalty = orders => {
  const total = orders.reduce((sum, order) => sum + (order.totalValue || parseMoney(order.total)), 0);
  const points = Math.round(total);
  const tiers = [
    { name: 'Bronze', min: 0, max: 499 },
    { name: 'Silver', min: 500, max: 1499 },
    { name: 'Gold', min: 1500, max: 2999 },
    { name: 'Platinum', min: 3000, max: Infinity }
  ];
  const tier = tiers.find(item => points >= item.min && points <= item.max) || tiers[0];
  const nextTier = tiers.find(item => item.min > tier.min) || null;
  const pointsToNext = nextTier ? Math.max(0, nextTier.min - points) : 0;
  const progress = nextTier ? Math.min(100, (points - tier.min) / (nextTier.min - tier.min) * 100) : 100;
  return { total, points, tier: tier.name, nextTier: nextTier ? nextTier.name : null, pointsToNext, progress };
};

const getOrderStatus = order => {
  if (order && order.canceledAt) {
    return { label: 'Canceled', step: -1 };
  }
  if (!order || !order.createdAt) {
    return { label: 'Processing', step: 0 };
  }
  const createdAt = new Date(order.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  if (diffDays >= 6) return { label: 'Delivered', step: 3 };
  if (diffDays >= 3) return { label: 'Shipped', step: 2 };
  if (diffDays >= 1) return { label: 'Packed', step: 1 };
  return { label: 'Processing', step: 0 };
};

const renderTimeline = step => {
  if (step < 0) {
    return `
      <ol class='timeline'>
        <li class='active'>Canceled</li>
      </ol>
    `;
  }
  const steps = ['Order placed', 'Packed', 'Shipped', 'Delivered'];
  return `
    <ol class='timeline'>
      ${steps.map((label, index) => `<li class='${index <= step ? 'active' : ''}'>${label}</li>`).join('')}
    </ol>
  `;
};

const productCard = product => {
  const compare = product.compareAt ? `<span class='compare'>${money(product.compareAt)}</span>` : '';
  const badge = product.badge ? `<div class='badge'>${product.badge}</div>` : '';
  return `
    <article class='product-card' data-reveal>
      ${badge}
      <button class='wishlist-btn' type='button' data-wishlist data-product='${product.id}' aria-label='Save ${product.name}' aria-pressed='false'>
        <svg class='wishlist-icon' viewBox='0 0 24 24' aria-hidden='true'>
          <path d='M12 20.5s-7.5-4.5-9.5-9C1 8.5 2.5 6 5.2 5.5c2.1-.4 4 .7 4.8 2.3.8-1.6 2.7-2.7 4.8-2.3C17.5 6 19 8.5 18.5 11.5c-2 4.5-9.5 9-9.5 9z'></path>
        </svg>
      </button>
      <div class='product-media' style='--g1: ${product.g1}; --g2: ${product.g2};'>
        ${product.image ? `<img class='media-image' src='${product.image}' alt='${product.name}' loading='lazy' decoding='async'>` : ''}
      </div>
      <div class='product-body'>
        <h3>${product.name}</h3>
        <div class='meta'>${product.category}</div>
        <div class='stars'>${renderStars(product.rating)}</div>
        <div class='price-row'>
          <div>
            <strong>${money(product.price)}</strong>
            ${compare}
          </div>
          <div class='card-actions' data-product-actions data-product='${product.id}'>
            <button class='btn small add-to-cart' data-add-to-cart data-product='${product.id}'>Add</button>
            <div class='card-qty' data-qty-controls data-product='${product.id}' aria-hidden='true'>
              <button class='qty-btn' type='button' data-qty-dec data-product='${product.id}' aria-label='Decrease quantity'>-</button>
              <span class='qty-value' data-qty-value>1</span>
              <button class='qty-btn' type='button' data-qty-inc data-product='${product.id}' aria-label='Increase quantity'>+</button>
            </div>
          </div>
        </div>
      </div>
      <a class='card-link' href='product.html?id=${product.id}' aria-label='View ${product.name}'></a>
    </article>
  `;
};

const initNavigation = () => {
  const menuBtn = document.querySelector('[data-menu-toggle]');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }

  const searchToggle = document.querySelector('[data-search-toggle]');
  const searchPanel = byId('searchPanel');
  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', () => {
      searchPanel.classList.toggle('open');
    });
  }

  document.querySelectorAll('[data-search-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = form.querySelector('input[type=search]');
      if (!input) return;
      const query = input.value.trim();
      if (!query) return;
      window.location.href = `collection.html?q=${encodeURIComponent(query)}`;
    });
  });
};

const initReveal = () => {
  if (document.body) {
    document.body.classList.add('reveal-ready');
  }
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(item => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach(item => observer.observe(item));
};

const addToCart = (productId, qty = 1, options = {}) => {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  const color = options.color || (product.colors[0] && product.colors[0].name) || '';
  const size = options.size || (product.sizes[0] || '');
  const key = makeKey(productId, color, size);
  const cart = getCart();
  const existing = cart.find(item => item.key === key);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      price: product.price,
      qty,
      color,
      size,
      image: product.image,
      g1: product.g1,
      g2: product.g2
    });
  }
  saveCart(cart);
  const toastLabel = qty > 1 ? `Added x${qty}` : 'Added (+1)';
  showToast(toastLabel);
};

const updateCartQty = (productId, delta) => {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  const { color, size } = getDefaultVariant(product);
  const key = makeKey(productId, color, size);
  const cart = getCart();
  const existing = cart.find(item => item.key === key);

  if (!existing && delta > 0) {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      color,
      size,
      image: product.image,
      g1: product.g1,
      g2: product.g2
    });
  } else if (existing) {
    existing.qty += delta;
    if (existing.qty <= 0) {
      const index = cart.findIndex(item => item.key === key);
      if (index !== -1) cart.splice(index, 1);
    }
  }

  saveCart(cart);
};

const initAddToCartButtons = () => {
  document.addEventListener('click', async event => {
    const incBtn = event.target.closest('[data-qty-inc]');
    if (incBtn) {
      event.preventDefault();
      const productId = incBtn.getAttribute('data-product');
      if (!productId) return;
      updateCartQty(productId, 1);
      return;
    }

    const decBtn = event.target.closest('[data-qty-dec]');
    if (decBtn) {
      event.preventDefault();
      const productId = decBtn.getAttribute('data-product');
      if (!productId) return;
      updateCartQty(productId, -1);
      return;
    }

    const btn = event.target.closest('[data-add-to-cart]');
    if (!btn) return;
    event.preventDefault();
    const productId = btn.getAttribute('data-product');
    if (!productId) return;
    addToCart(productId, 1, {});
    if (!btn.closest('[data-product-actions]')) {
      flashAddButton(btn, 1);
    }
  });
};

const initWishlist = () => {
  document.addEventListener('click', async event => {
    const btn = event.target.closest('[data-wishlist]');
    if (btn) {
      event.preventDefault();
      const productId = btn.getAttribute('data-product');
      if (!productId) return;
      const active = toggleWishlist(productId);
      showToast(active ? 'Saved to wishlist' : 'Removed from wishlist');
      syncWishlistUI();
      return;
    }

    const removeBtn = event.target.closest('[data-wishlist-remove]');
    if (removeBtn) {
      event.preventDefault();
      const productId = removeBtn.getAttribute('data-product');
      if (!productId) return;
      removeFromWishlist(productId);
      showToast('Removed from wishlist');
      syncWishlistUI();
    }
  });

  document.addEventListener('wishlist:changed', syncWishlistUI);
  syncWishlistUI();
};

const initHome = () => {
  const featuredGrid = byId('featuredGrid');
  const trendingGrid = byId('trendingGrid');
  if (featuredGrid) {
    const featured = products.filter(p => p.featured).slice(0, 8);
    featuredGrid.innerHTML = featured.map(productCard).join('');
  }
  if (trendingGrid) {
    const trending = products.filter(p => p.trending).slice(0, 4);
    trendingGrid.innerHTML = trending.map(productCard).join('');
  }
  initReveal();
  syncCardQty();
  syncWishlistUI();
};

const initCollection = () => {
  const grid = byId('collectionGrid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').toLowerCase();
  const categoryParam = params.get('category');

  const categoryFilters = byId('categoryFilters');
  const sizeFilters = byId('sizeFilters');
  const colorSwatches = byId('colorSwatches');

  const categories = [...new Set(products.map(p => p.category))];
  const sizes = [...new Set(products.flatMap(p => p.sizes))];
  const colors = [...new Set(products.flatMap(p => p.colors.map(c => c.name)))]
    .map(name => {
      const match = products.flatMap(p => p.colors).find(c => c.name === name);
      return { name, hex: match ? match.hex : '#ccc' };
    });

  if (categoryFilters) {
    categoryFilters.innerHTML = categories.map(cat => {
      const checked = categoryParam === cat ? 'checked' : '';
      return `
        <label class='check'>
          <input type='checkbox' value='${cat}' ${checked}>
          <span>${cat}</span>
        </label>
      `;
    }).join('');
  }

  if (sizeFilters) {
    sizeFilters.innerHTML = sizes.map(size => `
      <label class='check'>
        <input type='checkbox' value='${size}'>
        <span>${size}</span>
      </label>
    `).join('');
  }

  if (colorSwatches) {
    colorSwatches.innerHTML = colors.map(color => `
      <button class='color-swatch' style='--swatch: ${color.hex};' data-color='${color.name}' aria-label='${color.name}'></button>
    `).join('');
  }

  const resultsCount = byId('resultsCount');
  const emptyState = byId('emptyState');
  const minPrice = byId('minPrice');
  const maxPrice = byId('maxPrice');
  const ratingFilter = byId('ratingFilter');
  const sortSelect = byId('sortSelect');
  const inStockOnly = byId('inStockOnly');

  const getSelected = selector => Array.from(document.querySelectorAll(selector))
    .filter(input => input.checked)
    .map(input => input.value);

  const getActiveColors = () => Array.from(document.querySelectorAll('.color-swatch.active'))
    .map(btn => btn.getAttribute('data-color'));

  const applyFilters = () => {
    let results = products.slice();

    if (query) {
      results = results.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    const selectedCategories = getSelected('#categoryFilters input');
    if (selectedCategories.length) {
      results = results.filter(product => selectedCategories.includes(product.category));
    }

    const selectedSizes = getSelected('#sizeFilters input');
    if (selectedSizes.length) {
      results = results.filter(product => product.sizes.some(size => selectedSizes.includes(size)));
    }

    const selectedColors = getActiveColors();
    if (selectedColors.length) {
      results = results.filter(product => product.colors.some(color => selectedColors.includes(color.name)));
    }

    const min = minPrice && minPrice.value ? Number(minPrice.value) : null;
    const max = maxPrice && maxPrice.value ? Number(maxPrice.value) : null;
    if (min !== null) {
      results = results.filter(product => product.price >= min);
    }
    if (max !== null) {
      results = results.filter(product => product.price <= max);
    }

    const rating = ratingFilter && ratingFilter.value ? Number(ratingFilter.value) : null;
    if (rating) {
      results = results.filter(product => product.rating >= rating);
    }

    if (inStockOnly && inStockOnly.checked) {
      results = results.filter(product => product.stock > 0);
    }

    if (sortSelect) {
      switch (sortSelect.value) {
        case 'price-asc':
          results.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          results.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          results.sort((a, b) => b.rating - a.rating);
          break;
        case 'newest':
          results.sort((a, b) => Number(b.isNew) - Number(a.isNew));
          break;
        default:
          results.sort((a, b) => Number(b.featured) - Number(a.featured));
      }
    }

    grid.innerHTML = results.map(productCard).join('');
    if (resultsCount) {
      resultsCount.textContent = `${results.length} items`;
    }
    if (emptyState) {
      emptyState.style.display = results.length ? 'none' : 'block';
    }
    initReveal();
    syncCardQty();
    syncWishlistUI();
  };

  document.addEventListener('change', event => {
    if (event.target.closest('#categoryFilters') || event.target.closest('#sizeFilters') || event.target === ratingFilter || event.target === minPrice || event.target === maxPrice || event.target === sortSelect || event.target === inStockOnly) {
      applyFilters();
    }
  });

  document.addEventListener('click', async event => {
    const swatch = event.target.closest('.color-swatch');
    if (swatch && swatch.closest('#colorSwatches')) {
      swatch.classList.toggle('active');
      applyFilters();
    }
  });

  const clearFilters = byId('clearFilters');
  if (clearFilters) {
    clearFilters.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilters input, #sizeFilters input').forEach(input => {
        input.checked = false;
      });
      document.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
      if (minPrice) minPrice.value = '';
      if (maxPrice) maxPrice.value = '';
      if (ratingFilter) ratingFilter.value = '';
      if (sortSelect) sortSelect.value = 'featured';
      if (inStockOnly) inStockOnly.checked = false;
      applyFilters();
    });
  }

  applyFilters();
};

const initProduct = () => {
  const detail = byId('productDetail');
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id') || products[0].id;
  const product = products.find(item => item.id === productId) || products[0];

  const hero = byId('productHero');
  if (hero) {
    hero.style.setProperty('--g1', product.g1);
    hero.style.setProperty('--g2', product.g2);
    hero.innerHTML = product.image ? `<img class="media-image" src="${product.image}" alt="${product.name}" loading="eager" decoding="async">` : '';
  }

  const title = byId('productTitle');
  const category = byId('productCategory');
  const price = byId('productPrice');
  const compare = byId('productCompare');
  const rating = byId('productRating');
  const stockStatus = byId('stockStatus');
  const viewerCount = byId('viewerCount');
  const dispatchNote = byId('dispatchNote');
  const description = byId('productDescription');
  const details = byId('productDetails');

  if (title) title.textContent = product.name;
  if (category) category.textContent = product.category;
  if (price) price.textContent = money(product.price);
  if (compare) compare.textContent = product.compareAt ? ` ${money(product.compareAt)}` : '';
  if (rating) rating.innerHTML = renderStars(product.rating);
  if (stockStatus) {
    if (product.stock <= 0) {
      stockStatus.textContent = 'Out of stock';
    } else if (product.stock <= 10) {
      stockStatus.textContent = `Low stock: only ${product.stock} left.`;
    } else {
      stockStatus.textContent = 'In stock and ready to ship.';
    }
  }
  if (description) description.textContent = product.description;
  if (details) details.innerHTML = product.details.map(item => `<li>${item}</li>`).join('');

  const colors = byId('productColors');
  const sizes = byId('productSizes');
  const selectedColor = byId('selectedColor');
  const selectedSize = byId('selectedSize');
  let activeColor = product.colors[0] ? product.colors[0].name : '';
  let activeSize = product.sizes[0] || '';

  if (colors) {
    colors.innerHTML = product.colors.map(color => `
      <button class='color-swatch ${color.name === activeColor ? 'active' : ''}' style='--swatch: ${color.hex};' data-color='${color.name}' aria-label='${color.name}'></button>
    `).join('');
  }

  if (sizes) {
    sizes.innerHTML = product.sizes.map(size => `
      <button class='size-option ${size === activeSize ? 'active' : ''}' data-size='${size}'>${size}</button>
    `).join('');
  }

  if (selectedColor) selectedColor.textContent = activeColor;
  if (selectedSize) selectedSize.textContent = activeSize;

  if (colors) {
    colors.addEventListener('click', event => {
      const swatch = event.target.closest('.color-swatch');
      if (!swatch) return;
      colors.querySelectorAll('.color-swatch').forEach(item => item.classList.remove('active'));
      swatch.classList.add('active');
      activeColor = swatch.getAttribute('data-color');
      if (selectedColor) selectedColor.textContent = activeColor;
    });
  }

  if (sizes) {
    sizes.addEventListener('click', event => {
      const option = event.target.closest('.size-option');
      if (!option) return;
      sizes.querySelectorAll('.size-option').forEach(item => item.classList.remove('active'));
      option.classList.add('active');
      activeSize = option.getAttribute('data-size');
      if (selectedSize) selectedSize.textContent = activeSize;
    });
  }

  const addButton = byId('addToCart');
  const qtyInput = byId('qtyInput');
  const wishlistBtn = byId('wishlistBtn');
  if (addButton) {
    addButton.addEventListener('click', event => {
      event.preventDefault();
      if (product.stock <= 0) {
        showToast('Currently out of stock');
        return;
      }
      const qty = qtyInput ? Math.max(1, Number(qtyInput.value || 1)) : 1;
      addToCart(product.id, qty, { color: activeColor, size: activeSize });
      flashAddButton(addButton, qty);
    });
  }

  if (wishlistBtn) {
    wishlistBtn.setAttribute('data-product', product.id);
  }

  const related = byId('relatedGrid');
  if (related) {
    const picks = products.filter(item => item.category === product.category && item.id !== product.id).slice(0, 4);
    related.innerHTML = picks.map(productCard).join('');
  }

  const stickyBar = byId('stickyBar');
  const stickyTitle = byId('stickyTitle');
  const stickyMeta = byId('stickyMeta');
  const stickyPrice = byId('stickyPrice');
  const stickyAdd = byId('stickyAdd');
  const productActions = document.querySelector('.product-actions');

  if (stickyTitle) stickyTitle.textContent = product.name;
  if (stickyMeta) stickyMeta.textContent = product.stock <= 0 ? 'Out of stock' : 'Ready to ship';
  if (stickyPrice) stickyPrice.textContent = money(product.price);

  if (stickyAdd) {
    stickyAdd.addEventListener('click', event => {
      event.preventDefault();
      if (product.stock <= 0) {
        showToast('Currently out of stock');
        return;
      }
      const qty = qtyInput ? Math.max(1, Number(qtyInput.value || 1)) : 1;
      addToCart(product.id, qty, { color: activeColor, size: activeSize });
      flashAddButton(stickyAdd, qty);
    });
  }

  if (stickyBar && productActions && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        stickyBar.classList.toggle('show', !entry.isIntersecting);
      });
    }, { threshold: 0.2 });
    observer.observe(productActions);
  }

  if (viewerCount) {
    let viewers = Math.floor(12 + Math.random() * 28);
    viewerCount.textContent = `${viewers} people viewing`;
    setInterval(() => {
      const delta = Math.floor(Math.random() * 4) - 1;
      viewers = Math.max(6, viewers + delta);
      viewerCount.textContent = `${viewers} people viewing`;
    }, 8000);
  }

  if (dispatchNote) {
    const updateDispatch = () => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(17, 0, 0, 0);
      if (now < cutoff) {
        const diff = cutoff - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        dispatchNote.textContent = `Order in ${hours}h ${minutes}m for dispatch today.`;
      } else {
        dispatchNote.textContent = 'Order now for next-day dispatch.';
      }
    };
    updateDispatch();
    setInterval(updateDispatch, 60000);
  }
  const updateRecentlyViewed = () => {
    const list = getRecentlyViewed().filter(id => id !== product.id);
    list.unshift(product.id);
    saveRecentlyViewed(list.slice(0, 6));
  };

  const renderRecentlyViewed = () => {
    const grid = byId('recentlyViewedGrid');
    const empty = byId('recentlyViewedEmpty');
    if (!grid) return;
    const list = getRecentlyViewed().filter(id => id !== product.id);
    const items = list.map(id => products.find(item => item.id === id)).filter(Boolean);
    grid.innerHTML = items.map(productCard).join('');
    if (empty) empty.style.display = items.length ? 'none' : 'block';
    syncCardQty();
    syncWishlistUI();
    initReveal();
  };

  updateRecentlyViewed();
  renderRecentlyViewed();
  const reviews = getReviews(product.id);
  const reviewAverage = byId('reviewAverage');
  const reviewStars = byId('reviewStars');
  const reviewCount = byId('reviewCount');
  const reviewBars = byId('reviewBars');
  const reviewList = byId('reviewList');
  const reviewForm = byId('reviewForm');
  const reviewName = byId('reviewName');
  const reviewTitle = byId('reviewTitle');
  const reviewBody = byId('reviewBody');

  const renderReviews = () => {
    const list = getReviews(product.id);
    const count = list.length;
    const avg = count ? list.reduce((sum, item) => sum + item.rating, 0) / count : 0;
    if (reviewAverage) reviewAverage.textContent = avg.toFixed(1);
    if (reviewStars) reviewStars.innerHTML = renderStars(avg || product.rating);
    if (reviewCount) reviewCount.textContent = `${count} review${count === 1 ? '' : 's'}`;

    const counts = [5, 4, 3, 2, 1].map(star => list.filter(item => item.rating === star).length);
    if (reviewBars) {
      reviewBars.innerHTML = counts.map((value, index) => {
        const star = 5 - index;
        const percent = count ? (value / count) * 100 : 0;
        return `
          <div class='review-bar'>
            <span>${star}★</span>
            <div class='review-track'>
              <div class='review-fill' style='width: ${percent}%;'></div>
            </div>
            <span>${value}</span>
          </div>
        `;
      }).join('');
    }

    if (reviewList) {
      reviewList.innerHTML = list.map(item => `
        <div class='review-card'>
          <div class='stars'>${renderStars(item.rating)}</div>
          <strong>${item.title}</strong>
          <p>${item.body}</p>
          <div class='review-meta'>
            <span>${item.name}</span>
            <span>${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      `).join('');
    }
  };

  if (reviewForm) {
    reviewForm.addEventListener('submit', event => {
      event.preventDefault();
      const ratingInput = reviewForm.querySelector('input[name=rating]:checked');
      const newReview = {
        id: `${product.id}-${Date.now()}`,
        name: reviewName ? reviewName.value.trim() : 'Guest',
        title: reviewTitle ? reviewTitle.value.trim() : 'Review',
        body: reviewBody ? reviewBody.value.trim() : '',
        rating: ratingInput ? Number(ratingInput.value) : 5,
        date: new Date().toISOString()
      };
      if (!newReview.name || !newReview.title || !newReview.body) {
        showToast('Complete all review fields');
        return;
      }
      const list = getReviews(product.id);
      list.unshift(newReview);
      saveReviews(product.id, list);
      reviewForm.reset();
      const rate5 = byId('rate5');
      if (rate5) rate5.checked = true;
      showToast('Review submitted');
      renderReviews();
    });
  }

  renderReviews();
  syncCardQty();
  syncWishlistUI();
};

const initCart = () => {
  const cartItems = byId('cartItems');
  if (!cartItems) return;

  const summarySubtotal = byId('cartSubtotal');
  const summaryShipping = byId('cartShipping');
  const summaryTax = byId('cartTax');
  const summaryTotal = byId('cartTotal');
  const cartEmpty = byId('cartEmpty');
  const checkoutBtn = byId('checkoutBtn');

  const renderCart = () => {
    const cart = getCart();
    if (!cart.length) {
      cartItems.innerHTML = '';
      if (cartEmpty) cartEmpty.style.display = 'block';
      if (checkoutBtn) checkoutBtn.classList.add('ghost');
    } else {
      if (cartEmpty) cartEmpty.style.display = 'none';
      if (checkoutBtn) checkoutBtn.classList.remove('ghost');
    }

    cartItems.innerHTML = cart.map(item => `
      <div class='cart-item'>
        <div class='cart-media' style='--g1: ${item.g1}; --g2: ${item.g2};'>
          ${item.image ? `<img class='media-image' src='${item.image}' alt='${item.name}' loading='lazy' decoding='async'>` : ''}
        </div>
        <div class='cart-info'>
          <h3>${item.name}</h3>
          <div class='meta'>${item.color} ${item.size ? '| ' + item.size : ''}</div>
          <div class='meta'>${money(item.price)}</div>
          <button class='link-btn' data-cart-action='remove' data-key='${item.key}'>Remove</button>
        </div>
        <div class='cart-qty'>
          <button data-cart-action='dec' data-key='${item.key}'>-</button>
          <input type='number' min='1' value='${item.qty}' data-cart-input='${item.key}'>
          <button data-cart-action='inc' data-key='${item.key}'>+</button>
        </div>
        <strong>${money(item.price * item.qty)}</strong>
      </div>
    `).join('');

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = subtotal > 200 || subtotal === 0 ? 0 : 18;
    const tax = subtotal * 0.085;
    const total = subtotal + shipping + tax;

    if (summarySubtotal) summarySubtotal.textContent = money(subtotal);
    if (summaryShipping) summaryShipping.textContent = shipping === 0 ? 'Free' : money(shipping);
    if (summaryTax) summaryTax.textContent = money(tax);
    if (summaryTotal) summaryTotal.textContent = money(total);
  };

  document.addEventListener('click', event => {
    const actionBtn = event.target.closest('[data-cart-action]');
    if (!actionBtn) return;
    const key = actionBtn.getAttribute('data-key');
    if (!key) return;
    const cart = getCart();
    const item = cart.find(entry => entry.key === key);
    if (!item) return;

    if (actionBtn.getAttribute('data-cart-action') === 'inc') {
      item.qty += 1;
    }

    if (actionBtn.getAttribute('data-cart-action') === 'dec') {
      item.qty = Math.max(1, item.qty - 1);
    }

    if (actionBtn.getAttribute('data-cart-action') === 'remove') {
      const index = cart.findIndex(entry => entry.key === key);
      if (index !== -1) cart.splice(index, 1);
    }

    saveCart(cart);
    renderCart();
  });

  document.addEventListener('change', event => {
    const input = event.target.closest('[data-cart-input]');
    if (!input) return;
    const key = input.getAttribute('data-cart-input');
    const cart = getCart();
    const item = cart.find(entry => entry.key === key);
    if (!item) return;
    const value = Math.max(1, Number(input.value || 1));
    item.qty = value;
    saveCart(cart);
    renderCart();
  });

  renderCart();
};

const initCheckout = () => {
  const form = byId('checkoutForm');
  if (!form) return;

  const summaryItems = byId('checkoutItems');
  const summarySubtotal = byId('checkoutSubtotal');
  const summaryShipping = byId('checkoutShipping');
  const summaryTax = byId('checkoutTax');
  const summaryTotal = byId('checkoutTotal');
  const summaryEta = byId('checkoutEta');
  const summaryPoints = byId('checkoutPoints');

  const shippingRadios = form.querySelectorAll('input[name=shipping]');
  const paymentRadios = form.querySelectorAll('input[name=payment]');
  const paymentPanels = form.querySelectorAll('[data-payment-panel]');
  const shippingPriceEls = form.querySelectorAll('[data-shipping-price]');

  const savedAddressCard = byId('savedAddressCard');
  const savedAddressText = byId('savedAddressText');
  const useSavedAddress = byId('useSavedAddress');
  const saveAddress = byId('saveAddress');

  const emailInput = byId('checkoutEmail');
  const firstInput = byId('checkoutFirst');
  const lastInput = byId('checkoutLast');
  const addressInput = byId('checkoutAddress');
  const apartmentInput = byId('checkoutApartment');
  const cityInput = byId('checkoutCity');
  const stateInput = byId('checkoutState');
  const zipInput = byId('checkoutZip');
  const countryInput = byId('checkoutCountry');

    const cardNumber = byId('cardNumber');
    const cardName = byId('cardName');
    const cardExpiry = byId('cardExpiry');
    const cardCvc = byId('cardCvc');
    const cardPostal = byId('cardPostal');
    const cardElement = byId('cardElement');
    const cardErrors = byId('cardErrors');
    const cardFallback = byId('cardFallback');
    const upiId = byId('upiId');
    const paypalEmail = byId('paypalEmail');
    let stripe = null;
    let stripeCard = null;
    const stripeEnabled = Boolean(useApi && STRIPE_PUBLISHABLE_KEY && window.Stripe && cardElement);

  const shippingMethods = {
    standard: { label: 'Standard', base: 12, freeOver: 200, eta: '3-5 business days' },
    express: { label: 'Express', base: 28, eta: '1-2 business days' },
    pickup: { label: 'Studio pickup', base: 0, eta: 'Ready in 2 hours' }
  };

  const getSelectedShipping = () => {
    const selected = form.querySelector('input[name=shipping]:checked');
    return selected ? selected.value : 'standard';
  };

  const getSelectedPayment = () => {
    const selected = form.querySelector('input[name=payment]:checked');
    return selected ? selected.value : 'card';
  };

  const calcShipping = subtotal => {
    const method = getSelectedShipping();
    const config = shippingMethods[method] || shippingMethods.standard;
    const cost = config.freeOver && subtotal >= config.freeOver ? 0 : config.base;
    return { ...config, cost };
  };

  const fillAddress = address => {
    if (!address) return;
    if (firstInput) firstInput.value = address.first || '';
    if (lastInput) lastInput.value = address.last || '';
    if (addressInput) addressInput.value = address.address || '';
    if (apartmentInput) apartmentInput.value = address.apartment || '';
    if (cityInput) cityInput.value = address.city || '';
    if (stateInput) stateInput.value = address.state || '';
    if (zipInput) zipInput.value = address.zip || '';
    if (countryInput) countryInput.value = address.country || '';
  };

  const collectAddress = () => ({
    first: firstInput ? firstInput.value.trim() : '',
    last: lastInput ? lastInput.value.trim() : '',
    address: addressInput ? addressInput.value.trim() : '',
    apartment: apartmentInput ? apartmentInput.value.trim() : '',
    city: cityInput ? cityInput.value.trim() : '',
    state: stateInput ? stateInput.value.trim() : '',
    zip: zipInput ? zipInput.value.trim() : '',
    country: countryInput ? countryInput.value.trim() : ''
  });

  const renderSummary = () => {
    const cart = getCart();
    summaryItems.innerHTML = cart.map(item => `
      <div class='summary-item'>
        <span>${item.name} x ${item.qty}</span>
        <span>${money(item.price * item.qty)}</span>
      </div>
    `).join('');

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shippingInfo = calcShipping(subtotal);
    const shipping = shippingInfo.cost;
    const tax = subtotal * 0.085;
    const total = subtotal + shipping + tax;

    summarySubtotal.textContent = money(subtotal);
    summaryShipping.textContent = shipping === 0 ? 'Free' : money(shipping);
    summaryTax.textContent = money(tax);
    summaryTotal.textContent = money(total);

    if (summaryEta) summaryEta.textContent = shippingInfo.eta;
    if (summaryPoints) summaryPoints.textContent = `${Math.round(subtotal)} pts`;

    shippingPriceEls.forEach(el => {
      const key = el.getAttribute('data-shipping-price');
      const config = shippingMethods[key];
      if (!config) return;
      const price = config.freeOver && subtotal >= config.freeOver ? 0 : config.base;
      el.textContent = price === 0 ? 'Free' : money(price);
    });
  };

  renderSummary();

  if (stripeEnabled) {
    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    const elements = stripe.elements({ appearance: { theme: 'stripe' } });
    stripeCard = elements.create('card', { hidePostalCode: true });
    stripeCard.mount(cardElement);
    if (cardErrors) {
      stripeCard.on('change', event => {
        cardErrors.textContent = event.error ? event.error.message : '';
      });
    }
    if (cardFallback) {
      cardFallback.classList.add('hidden');
    }
  } else {
    if (cardElement) cardElement.style.display = 'none';
  }

  shippingRadios.forEach(radio => {
    radio.addEventListener('change', renderSummary);
  });

  const syncPaymentPanels = () => {
    const selected = getSelectedPayment();
    paymentPanels.forEach(panel => {
      panel.classList.toggle('active', panel.getAttribute('data-payment-panel') === selected);
    });
  };

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', syncPaymentPanels);
  });
  syncPaymentPanels();

  const saved = getSavedAddress();
  if (saved && savedAddressCard && savedAddressText) {
    savedAddressText.textContent = formatAddress(saved);
    savedAddressCard.style.display = 'flex';
  }

  if (useSavedAddress) {
    useSavedAddress.addEventListener('click', () => {
      const savedAddress = getSavedAddress();
      fillAddress(savedAddress);
    });
  }

  const user = getUser();
  if (user && emailInput && !emailInput.value) {
    emailInput.value = user.email || '';
    if (user.name && firstInput && lastInput && !firstInput.value && !lastInput.value) {
      const parts = user.name.split(' ');
      firstInput.value = parts[0] || '';
      lastInput.value = parts.slice(1).join(' ') || '';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const cart = getCart();
    if (!cart.length) {
      showToast('Your cart is empty');
      return;
    }

    const paymentMethod = getSelectedPayment();
    if (useApi && !getAuthToken()) {
      showToast('Please sign in to checkout');
      window.location.href = 'account.html';
      return;
    }

    if (paymentMethod === 'card') {
      if (stripeEnabled) {
        if (!cardName || !cardName.value.trim()) {
          showToast('Enter name on card');
          return;
        }
      } else if (useApi) {
        showToast('Stripe not configured');
        return;
      } else if (!cardNumber || !cardName || !cardExpiry || !cardCvc || !cardNumber.value.trim() || !cardName.value.trim() || !cardExpiry.value.trim() || !cardCvc.value.trim()) {
        showToast('Enter card details');
        return;
      }
    }
    if (paymentMethod === 'upi' && (!upiId || !upiId.value.trim())) {
      showToast('Enter UPI ID');
      return;
    }
    if (paymentMethod === 'paypal' && (!paypalEmail || !paypalEmail.value.trim())) {
      showToast('Enter PayPal email');
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shippingInfo = calcShipping(subtotal);
    const tax = subtotal * 0.085;
    const total = subtotal + shippingInfo.cost + tax;

    const address = collectAddress();
    if (saveAddress && saveAddress.checked) {
      setSavedAddress(address);
    }

    const orderPayload = {
      id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      createdAt: new Date().toISOString(),
      items: cart,
      subtotalValue: subtotal,
      totalValue: total,
      total: money(total),
      email: emailInput ? emailInput.value : '',
      shippingMethod: shippingInfo.label,
      shippingCost: shippingInfo.cost,
      shippingEta: shippingInfo.eta,
      paymentMethod,
      paymentStatus: paymentMethod === 'card' ? 'paid' : 'pending',
      address
    };

    if (stripeEnabled && paymentMethod === 'card') {
      try {
        const intent = await apiCreatePaymentIntent({
          amount: Math.round(total * 100),
          currency: 'usd'
        });
        const result = await stripe.confirmCardPayment(intent.clientSecret, {
          payment_method: {
            card: stripeCard,
            billing_details: {
              name: cardName ? cardName.value.trim() : '',
              email: emailInput ? emailInput.value.trim() : ''
            }
          }
        });
        if (result.error) {
          showToast(result.error.message || 'Payment failed');
          return;
        }
        orderPayload.paymentIntentId = result.paymentIntent.id;
        orderPayload.paymentStatus = result.paymentIntent.status;
      } catch (error) {
        showToast(error.message || 'Payment failed');
        return;
      }
    }

    if (useApi) {
      try {
        const response = await apiCreateOrder(orderPayload);
        const savedOrder = response.order || response;
        localStorage.setItem('lastOrder', JSON.stringify(savedOrder));
        localStorage.setItem('cart', JSON.stringify([]));
        window.location.href = 'success.html';
      } catch (error) {
        showToast(error.message || 'Checkout failed');
      }
      return;
    }

    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.unshift(orderPayload);
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('lastOrder', JSON.stringify(orderPayload));
    localStorage.setItem('cart', JSON.stringify([]));
    window.location.href = 'success.html';
  });
};

const initSuccess = () => {
  const success = byId('orderSuccess');
  if (!success) return;
  const order = JSON.parse(localStorage.getItem('lastOrder') || 'null');
  if (!order) return;

  const summary = byId('orderSummary');
  const items = byId('orderItems');
  const total = byId('orderTotal');
  const shipping = byId('orderShipping');
  const eta = byId('orderEta');
  const payment = byId('orderPayment');
  const tracking = byId('orderTracking');
  if (summary) summary.textContent = `Order ${order.id} placed on ${order.date}. A confirmation email was sent to ${order.email}.`;
  if (items) {
    items.innerHTML = order.items.map(item => `
      <div class='summary-item'>
        <span>${item.name} x ${item.qty}</span>
        <span>${money(item.price * item.qty)}</span>
      </div>
    `).join('');
  }
  if (total) total.textContent = order.total;
  if (shipping) shipping.textContent = order.shippingMethod || 'Standard';
  if (eta) eta.textContent = order.shippingEta || '3-5 business days';
  if (payment) payment.textContent = order.paymentMethod ? order.paymentMethod.toUpperCase() : 'Card';
  if (tracking) {
    const status = getOrderStatus(order);
    tracking.innerHTML = `
      <strong>Tracking status: ${status.label}</strong>
      ${renderTimeline(status.step)}
    `;
  }
};

const initAccount = () => {
  const ordersEl = byId('accountOrders');
  if (!ordersEl) return;
  if (seedDemoOrder()) {
    showToast('Demo order created');
  }
  let orders = JSON.parse(localStorage.getItem('orders') || '[]');

  const loadOrders = async () => {
    if (useApi) {
      try {
        const data = await apiGetOrders();
        orders = data.orders || [];
      } catch (error) {
        orders = [];
      }
      return;
    }
    orders = JSON.parse(localStorage.getItem('orders') || '[]');
  };

  const loyaltyTier = byId('loyaltyTier');
  const loyaltyProgress = byId('loyaltyProgress');
  const loyaltyNext = byId('loyaltyNext');
  const loyaltyPoints = byId('loyaltyPoints');
  const storeCreditEl = byId('storeCredit');
  const returnsList = byId('returnsList');
  const wishlistItems = byId('wishlistItems');
  const accountAddressText = byId('accountAddressText');

  const renderOrders = () => {
    if (!orders.length) {
      ordersEl.innerHTML = '<p class=meta>No orders yet. Start your first order in the studio.</p>';
      return;
    }

    ordersEl.innerHTML = orders.map(order => {
      const status = getOrderStatus(order);
      const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.qty, 0) : 0;
      const canCancel = status.step >= 0 && status.step < 2;
      const cancelAction = order.canceledAt
        ? `<span class='meta'>Canceled</span>`
        : canCancel
          ? `<button class='link-btn' type='button' data-cancel-order='${order.id}'>Cancel order</button>`
          : `<span class='meta'>${status.label}</span>`;
      return `
        <div class='order-row'>
          <div>
            <strong>${order.id}</strong>
            <div class='meta'>${order.date} • ${itemCount} items${order.returnRequested ? ' • Return in progress' : ''}</div>
          </div>
          <div class='order-actions'>
            <span>${order.total}</span>
            <div class='order-action-buttons'>
              <button class='link-btn' type='button' data-track-order='${order.id}'>Track</button>
              <button class='link-btn' type='button' data-reorder-order='${order.id}'>Reorder</button>
              <button class='link-btn' type='button' data-download-invoice='${order.id}'>Invoice</button>
              ${cancelAction}
            </div>
          </div>
          <div class='track-panel' data-track-panel='${order.id}'>
            ${renderTimeline(status.step)}
            <p class='meta'>${order.shippingMethod || 'Standard'} · ${order.shippingEta || '3-5 business days'}</p>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderLoyalty = () => {
    const loyalty = computeLoyalty(orders);
    if (loyaltyTier) loyaltyTier.textContent = `Tier: ${loyalty.tier}`;
    if (loyaltyProgress) loyaltyProgress.style.width = `${loyalty.progress}%`;
    if (loyaltyNext) {
      loyaltyNext.textContent = loyalty.nextTier
        ? `Spend ${money(loyalty.pointsToNext)} more to reach ${loyalty.nextTier}.`
        : 'Top tier unlocked. Enjoy your perks.';
    }
    if (loyaltyPoints) loyaltyPoints.textContent = loyalty.points.toLocaleString();
    if (storeCreditEl) storeCreditEl.textContent = money(getStoreCredit());
  };

  const renderReturns = () => {
    if (!returnsList) return;
    if (!orders.length) {
      returnsList.innerHTML = '<p class=meta>No orders yet. Your returns will appear here.</p>';
      return;
    }

    returnsList.innerHTML = orders.map(order => {
      if (order.canceledAt) {
        return `
          <div class='summary-item'>
            <span>${order.id} · ${order.date}</span>
            <span class='meta'>Canceled</span>
          </div>
        `;
      }
      const label = order.returnRequested ? 'Return requested' : 'Eligible for return';
      const action = order.returnRequested
        ? `<span class='meta'>${label}</span>`
        : `<button class='btn small ghost' type='button' data-return-order='${order.id}'>Request return</button>`;
      return `
        <div class='summary-item'>
          <span>${order.id} · ${order.date}</span>
          ${action}
        </div>
      `;
    }).join('');
  };

  const renderWishlist = () => {
    if (!wishlistItems) return;
    const list = getWishlist();
    if (!list.length) {
      wishlistItems.innerHTML = '<p class=meta>Your wishlist is empty. Save items from the shop.</p>';
      return;
    }
    const items = list.map(id => products.find(item => item.id === id)).filter(Boolean);
    wishlistItems.innerHTML = items.map(item => `
      <div class='summary-item'>
        <span>${item.name}</span>
        <div class='summary-actions'>
          <button class='btn small' type='button' data-add-to-cart data-product='${item.id}'>Add</button>
          <button class='link-btn' type='button' data-wishlist-remove data-product='${item.id}'>Remove</button>
        </div>
      </div>
    `).join('');
  };

  const renderAll = async () => {
    await loadOrders();
    renderOrders();
    renderLoyalty();
    renderReturns();
    renderWishlist();
    if (accountAddressText) {
      const savedAddress = getSavedAddress();
      accountAddressText.textContent = savedAddress ? formatAddress(savedAddress) : 'No address saved yet.';
    }
  };

  renderAll();

  document.addEventListener('click', async event => {
    const trackBtn = event.target.closest('[data-track-order]');
    if (trackBtn) {
      const orderId = trackBtn.getAttribute('data-track-order');
      const panel = ordersEl.querySelector(`[data-track-panel='${orderId}']`);
      if (panel) panel.classList.toggle('active');
      return;
    }

    const returnBtn = event.target.closest('[data-return-order]');
    if (returnBtn) {
      const orderId = returnBtn.getAttribute('data-return-order');
      let order = orders.find(item => item.id === orderId);
      if (!order || order.returnRequested) return;
      if (useApi) {
        try {
          await apiUpdateOrder(orderId, { returnRequested: true });
        } catch (error) {
          showToast(error.message || 'Unable to start return');
          return;
        }
      } else {
        const latestOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        order = latestOrders.find(item => item.id === orderId);
        if (!order || order.returnRequested) return;
        order.returnRequested = true;
        localStorage.setItem('orders', JSON.stringify(latestOrders));
      }
      const creditValue = Math.max(5, Math.round((order.totalValue || parseMoney(order.total)) * 0.1));
      setStoreCredit(getStoreCredit() + creditValue);
      showToast(`Return started. ${money(creditValue)} credit added.`);
      renderAll();
    }

    const cancelBtn = event.target.closest('[data-cancel-order]');
    if (cancelBtn) {
      const orderId = cancelBtn.getAttribute('data-cancel-order');
      let order = orders.find(item => item.id === orderId);
      if (!order || order.canceledAt) return;
      if (useApi) {
        try {
          await apiUpdateOrder(orderId, {
            canceledAt: new Date().toISOString(),
            canceledReason: 'Canceled by customer'
          });
        } catch (error) {
          showToast(error.message || 'Unable to cancel order');
          return;
        }
      } else {
        const latestOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        order = latestOrders.find(item => item.id === orderId);
        if (!order || order.canceledAt) return;
        order.canceledAt = new Date().toISOString();
        order.canceledReason = 'Canceled by customer';
        localStorage.setItem('orders', JSON.stringify(latestOrders));
      }
      showToast('Order canceled');
      renderAll();
    }

    const reorderBtn = event.target.closest('[data-reorder-order]');
    if (reorderBtn) {
      const orderId = reorderBtn.getAttribute('data-reorder-order');
      const order = useApi ? orders.find(item => item.id === orderId) : JSON.parse(localStorage.getItem('orders') || '[]').find(item => item.id === orderId);
      if (!order || !order.items) return;
      const cart = getCart();
      order.items.forEach(item => {
        const key = item.key || makeKey(item.id, item.color, item.size);
        const existing = cart.find(entry => entry.key === key);
        if (existing) {
          existing.qty += item.qty;
        } else {
          cart.push({ ...item, key });
        }
      });
      saveCart(cart);
      showToast('Items added to cart');
    }

    const invoiceBtn = event.target.closest('[data-download-invoice]');
    if (invoiceBtn) {
      const orderId = invoiceBtn.getAttribute('data-download-invoice');
      const order = useApi ? orders.find(item => item.id === orderId) : JSON.parse(localStorage.getItem('orders') || '[]').find(item => item.id === orderId);
      if (!order) return;
      const addressLine = formatAddress(order.address || getSavedAddress());
      const lines = [
        'Solace and Stone',
        `Invoice: ${order.id}`,
        `Date: ${order.date}`,
        `Email: ${order.email || 'N/A'}`,
        addressLine ? `Ship to: ${addressLine}` : '',
        '',
        'Items:'
      ].filter(Boolean);
      order.items.forEach(item => {
        lines.push(`- ${item.name} (${item.color || 'Standard'} ${item.size || ''}) x ${item.qty} — ${money(item.price * item.qty)}`);
      });
      lines.push('');
      lines.push(`Subtotal: ${money(order.subtotalValue || 0)}`);
      lines.push(`Shipping: ${order.shippingMethod || 'Standard'} ${order.shippingCost ? money(order.shippingCost) : ''}`.trim());
      lines.push(`Total: ${order.total}`);
      lines.push(`Payment: ${(order.paymentMethod || 'card').toUpperCase()}`);
      downloadText(`${order.id}-invoice.txt`, lines.join('\n'));
    }
  });

  document.addEventListener('wishlist:changed', renderWishlist);

  const welcome = byId('accountWelcome');
  const greeting = byId('accountGreeting');
  const signInCard = byId('signInCard');
  const registerCard = byId('registerCard');
  const signInBtn = byId('signInBtn');
  const registerBtn = byId('registerBtn');
  const logoutBtn = byId('logoutBtn');
  const signInEmail = byId('signinEmail');
  const signInPassword = byId('signinPassword');
  const registerName = byId('registerName');
  const registerEmail = byId('registerEmail');
  const registerPassword = byId('registerPassword');

  const updateView = () => {
    const user = getUser();
    const isSignedIn = Boolean(user && user.email);
    if (welcome) welcome.style.display = isSignedIn ? 'grid' : 'none';
    if (signInCard) signInCard.style.display = isSignedIn ? 'none' : 'grid';
    if (registerCard) registerCard.style.display = isSignedIn ? 'none' : 'grid';
    if (greeting && user) {
      greeting.textContent = `Signed in as ${user.name || user.email}.`;
    }
  };

  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      const email = signInEmail ? signInEmail.value.trim() : '';
      const password = signInPassword ? signInPassword.value.trim() : '';
      if (!email || !password) {
        showToast('Enter email and password');
        return;
      }
      if (useApi) {
        try {
          const data = await apiLogin({ email, password });
          if (data.token) setAuthToken(data.token);
          if (data.user) setUser(data.user);
        } catch (error) {
          showToast(error.message || 'Sign in failed');
          return;
        }
      } else {
        setUser({ name: email.split('@')[0], email });
      }
      markOnboardingSeen();
      showToast('Signed in');
      emitAuthChanged();
      updateView();
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const name = registerName ? registerName.value.trim() : '';
      const email = registerEmail ? registerEmail.value.trim() : '';
      const password = registerPassword ? registerPassword.value.trim() : '';
      if (!name || !email || !password) {
        showToast('Complete all fields');
        return;
      }
      if (useApi) {
        try {
          const data = await apiRegister({ name, email, password });
          if (data.token) setAuthToken(data.token);
          if (data.user) setUser(data.user);
        } catch (error) {
          showToast(error.message || 'Registration failed');
          return;
        }
      } else {
        setUser({ name, email });
      }
      markOnboardingSeen();
      showToast('Account created');
      emitAuthChanged();
      updateView();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearUser();
      showToast('Signed out');
      emitAuthChanged();
      updateView();
    });
  }

  document.addEventListener('auth:changed', updateView);
  document.addEventListener('auth:changed', () => {
    renderAll();
  });
  updateView();
};

const initAuthModal = () => {
  if (byId('authModal')) return;
  if (getUser()) return;

  const path = window.location.pathname.toLowerCase();
  const onIndex = path.endsWith('/index.html') || path === '/' || path.endsWith('/');
  if (!onIndex) return;

  const firstVisit = !hasSeenOnboarding();

  const forceAuth = true;
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.id = 'authModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class='auth-backdrop' data-auth-close></div>
    <div class='auth-card' role='dialog' aria-modal='true' aria-labelledby='authTitle'>
      <button class='auth-close' type='button' data-auth-close aria-label='Close'>x</button>
      <div class='auth-header'>
        <div class='eyebrow'>Welcome</div>
        <h2 id='authTitle'>Join the studio</h2>
        <p class='meta'>Create an account or sign in to save your picks, track orders, and access member perks.</p>
      </div>
      <div class='auth-tabs' role='tablist'>
        <button class='auth-tab active' type='button' data-auth-tab='register' role='tab' aria-selected='true'>Create account</button>
        <button class='auth-tab' type='button' data-auth-tab='signin' role='tab' aria-selected='false'>Sign in</button>
      </div>
      <div class='auth-panel active' data-auth-panel='register' role='tabpanel'>
        <label class='auth-field'>
          <span>Full name</span>
          <input id='authRegisterName' type='text' placeholder='Full name'>
        </label>
        <label class='auth-field'>
          <span>Email address</span>
          <input id='authRegisterEmail' type='email' placeholder='you@example.com'>
        </label>
        <label class='auth-field'>
          <span>Create password</span>
          <input id='authRegisterPassword' type='password' placeholder='Create password'>
        </label>
        <div class='auth-actions'>
          <button class='btn primary' id='authRegisterBtn' type='button'>Create account</button>
          <button class='btn ghost' type='button' data-auth-skip>Continue as guest</button>
        </div>
      </div>
      <div class='auth-panel' data-auth-panel='signin' role='tabpanel'>
        <label class='auth-field'>
          <span>Email address</span>
          <input id='authSigninEmail' type='email' placeholder='you@example.com'>
        </label>
        <label class='auth-field'>
          <span>Password</span>
          <input id='authSigninPassword' type='password' placeholder='Password'>
        </label>
        <div class='auth-actions'>
          <button class='btn primary' id='authSignInBtn' type='button'>Sign in</button>
          <button class='btn ghost' type='button' data-auth-skip>Continue as guest</button>
        </div>
      </div>
      <p class='auth-note'>We keep it simple: no spam, no surprises.</p>
    </div>
  `;
  document.body.appendChild(modal);

  modal.classList.add('force-auth');
  modal.querySelectorAll('[data-auth-skip]').forEach(btn => btn.remove());
  const closeBtn = modal.querySelector('.auth-close');
  if (closeBtn) closeBtn.remove();
  const backdrop = modal.querySelector('.auth-backdrop');
  if (backdrop) backdrop.removeAttribute('data-auth-close');

  const authTitle = byId('authTitle');
  const authMeta = modal.querySelector('.auth-header .meta');

  const setTab = tab => {
    modal.querySelectorAll('[data-auth-tab]').forEach(btn => {
      const isActive = btn.getAttribute('data-auth-tab') === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-auth-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.getAttribute('data-auth-panel') === tab);
    });
    if (authTitle) {
      authTitle.textContent = tab === 'signin' ? 'Sign in to continue' : 'Create your account';
    }
    if (authMeta) {
      authMeta.textContent = tab === 'signin'
        ? 'Welcome back. Sign in to open the studio and track your orders.'
        : 'Create an account to save your picks, track orders, and access member perks.';
    }
  };

  const focusActiveInput = () => {
    const input = modal.querySelector('.auth-panel.active input');
    if (input) input.focus();
  };

  const close = () => {
    modal.classList.remove('open');
    document.body.classList.remove('auth-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  const open = () => {
    modal.classList.add('open');
    document.body.classList.add('auth-open');
    modal.setAttribute('aria-hidden', 'false');
    focusActiveInput();
  };

  modal.addEventListener('click', event => {
    const closeBtn = event.target.closest('[data-auth-close], [data-auth-skip]');
    if (closeBtn) {
      event.preventDefault();
      close();
      return;
    }

    const tabBtn = event.target.closest('[data-auth-tab]');
    if (tabBtn) {
      event.preventDefault();
      setTab(tabBtn.getAttribute('data-auth-tab'));
      focusActiveInput();
    }
  });

  document.addEventListener('keydown', event => {
    if (forceAuth) return;
    if (event.key === 'Escape' && modal.classList.contains('open')) {
      close();
    }
  });

  const signInBtn = byId('authSignInBtn');
  const registerBtn = byId('authRegisterBtn');
  const signInEmail = byId('authSigninEmail');
  const signInPassword = byId('authSigninPassword');
  const registerName = byId('authRegisterName');
  const registerEmail = byId('authRegisterEmail');
  const registerPassword = byId('authRegisterPassword');

  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      const email = signInEmail ? signInEmail.value.trim() : '';
      const password = signInPassword ? signInPassword.value.trim() : '';
      if (!email || !password) {
        showToast('Enter email and password');
        return;
      }
      if (useApi) {
        try {
          const data = await apiLogin({ email, password });
          if (data.token) setAuthToken(data.token);
          if (data.user) setUser(data.user);
        } catch (error) {
          showToast(error.message || 'Sign in failed');
          return;
        }
      } else {
        setUser({ name: email.split('@')[0], email });
      }
      showToast('Signed in');
      markOnboardingSeen();
      close();
      emitAuthChanged();
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const name = registerName ? registerName.value.trim() : '';
      const email = registerEmail ? registerEmail.value.trim() : '';
      const password = registerPassword ? registerPassword.value.trim() : '';
      if (!name || !email || !password) {
        showToast('Complete all fields');
        return;
      }
      if (useApi) {
        try {
          const data = await apiRegister({ name, email, password });
          if (data.token) setAuthToken(data.token);
          if (data.user) setUser(data.user);
        } catch (error) {
          showToast(error.message || 'Registration failed');
          return;
        }
      } else {
        setUser({ name, email });
      }
      showToast('Account created');
      markOnboardingSeen();
      close();
      emitAuthChanged();
    });
  }

  setTab(firstVisit ? 'register' : 'signin');
  open();
};

const initAdmin = () => {
  const dashboard = byId('adminDashboard');
  if (!dashboard) return;
  if (seedDemoOrder()) {
    showToast('Demo order created');
  }

  const adminDate = byId('adminDate');
  if (adminDate) {
    adminDate.textContent = `Snapshot: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const buildDashboard = orders => {
    const activeOrders = orders.filter(order => !order.canceledAt);
    const revenue = activeOrders.reduce((sum, order) => sum + (order.totalValue || parseMoney(order.total)), 0);
    const orderCount = activeOrders.length;
    const aov = orderCount ? revenue / orderCount : 0;

    const emails = activeOrders.map(order => order.email).filter(Boolean);
    const uniqueEmails = new Set(emails);
    const returningCount = [...uniqueEmails].filter(email => emails.filter(item => item === email).length > 1).length;
    const returningRate = uniqueEmails.size ? Math.round((returningCount / uniqueEmails.size) * 100) : 0;

    const statRevenue = byId('statRevenue');
    const statOrders = byId('statOrders');
    const statAov = byId('statAov');
    const statReturning = byId('statReturning');
    if (statRevenue) statRevenue.textContent = money(revenue);
    if (statOrders) statOrders.textContent = orderCount.toLocaleString();
    if (statAov) statAov.textContent = money(aov);
    if (statReturning) statReturning.textContent = `${returningRate}%`;

    const exportBtn = byId('exportOrders');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (!orders.length) {
          showToast('No orders to export');
          return;
        }
        const header = [
          'Order ID',
          'Date',
          'Email',
          'Total',
          'Status',
          'Items',
          'Shipping',
          'Payment'
        ];
        const rows = orders.map(order => {
          const status = order.canceledAt ? 'Canceled' : getOrderStatus(order).label;
          const items = order.items.map(item => `${item.name} x${item.qty}`).join(' | ');
          return [
            order.id,
            order.date,
            order.email || '',
            order.total,
            status,
            items,
            order.shippingMethod || '',
            order.paymentMethod || ''
          ];
        });
        const csv = [header, ...rows]
          .map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
        downloadText(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      });
    }

    const productMap = {};
    const categoryMap = {};

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.id === item.id);
        const key = item.id;
        if (!productMap[key]) {
          productMap[key] = { name: item.name, qty: 0, revenue: 0 };
        }
        productMap[key].qty += item.qty;
        productMap[key].revenue += item.qty * item.price;

        const category = product ? product.category : 'Other';
        categoryMap[category] = (categoryMap[category] || 0) + item.qty * item.price;
      });
    });

    const salesChart = byId('salesChart');
    if (salesChart) {
      const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      const maxValue = entries.length ? Math.max(...entries.map(entry => entry[1])) : 0;
      salesChart.innerHTML = entries.length ? entries.map(([category, value]) => `
        <div class='bar-row'>
          <span>${category}</span>
          <div class='bar-track'>
            <div class='bar-fill' style='width: ${maxValue ? (value / maxValue) * 100 : 0}%'></div>
          </div>
          <span>${money(value)}</span>
        </div>
      `).join('') : '<p class=meta>No sales yet.</p>';
    }

    const topProducts = byId('topProducts');
    if (topProducts) {
      const top = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      topProducts.innerHTML = top.length ? top.map(item => `
        <div class='summary-item'>
          <span>${item.name} · ${item.qty} sold</span>
          <span>${money(item.revenue)}</span>
        </div>
      `).join('') : '<p class=meta>No sales yet.</p>';
    }

    const lowStock = byId('lowStock');
    if (lowStock) {
      const lowItems = products.filter(item => item.stock <= 10).slice(0, 6);
      lowStock.innerHTML = lowItems.length ? lowItems.map(item => `
        <div class='summary-item'>
          <span>${item.name}</span>
          <span>${item.stock} left</span>
        </div>
      `).join('') : '<p class=meta>All inventory healthy.</p>';
    }

    const recentOrders = byId('recentOrders');
    if (recentOrders) {
      recentOrders.innerHTML = orders.slice(0, 5).map(order => `
        <div class='summary-item'>
          <span>${order.id} · ${order.date}${order.canceledAt ? ' · Canceled' : ''}</span>
          <span>${order.total}</span>
        </div>
      `).join('') || '<p class=meta>No orders yet.</p>';
    }
  };

  const loadOrders = async () => {
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    if (useApi) {
      try {
        const data = await apiGetOrders(true);
        orders = data.orders || [];
      } catch (error) {
        showToast('Admin data unavailable');
        orders = [];
      }
    }
    buildDashboard(orders);
  };

  loadOrders();
};

const initCardImageAnimation = () => {
  document.addEventListener('click', event => {
    const link = event.target.closest('a.card-link');
    if (link) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const card = link.closest('.product-card');
      if (!card) return;
      const media = card.querySelector('.product-media') || card.querySelector('.media-image');
      if (!media) return;
      event.preventDefault();
      media.classList.remove('img-pop');
      void media.offsetWidth;
      media.classList.add('img-pop');
      const href = link.getAttribute('href');
      if (href) {
        setTimeout(() => {
          window.location.href = href;
        }, 300);
      }
      return;
    }

    const image = event.target.closest('.media-image');
    if (!image) return;
    image.classList.remove('img-pop');
    void image.offsetWidth;
    image.classList.add('img-pop');
  });
};

const initFiltersPanel = () => {
  document.addEventListener('click', event => {
    const openBtn = event.target.closest('#openFilters, [data-filters-open]');
    if (openBtn) {
      event.preventDefault();
      document.body.classList.add('filters-open');
      return;
    }

    const closeBtn = event.target.closest('#closeFilters, [data-filters-close]');
    if (closeBtn) {
      event.preventDefault();
      document.body.classList.remove('filters-open');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.body.classList.remove('filters-open');
    }
  });
};

initApiSession();
initNavigation();
initReveal();
initAddToCartButtons();
initHome();
initCollection();
initProduct();
initCart();
initCheckout();
initSuccess();
initAccount();
initAuthModal();
initAdmin();
initFiltersPanel();
initCardImageAnimation();
initWishlist();
updateCartCount();

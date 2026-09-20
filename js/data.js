/**
 * data.js — Data access layer for the store.
 *
 * IMPORTANT (read this before deploying for real):
 * Every function here returns a Promise and never touches the DOM.
 * Right now they read/write the browser's localStorage, which means
 * data only lives on the device of whoever is using it — fine for a
 * demo, not fine for a real shop where the owner and customers use
 * different devices.
 *
 * To connect a real backend later, you only need to rewrite the body
 * of the functions in the `Store` object below (e.g. replace the
 * localStorage calls with `fetch('/api/products')`, etc). Nothing in
 * store.js or admin.js needs to change, because they only ever call
 * `Store.xxx(...)` and `await` the result.
 */

const DB_KEYS = {
  categories: "shopdb_categories",
  products: "shopdb_products",
  orders: "shopdb_orders",
  settings: "shopdb_settings",
  admin: "shopdb_admin",
  orderSeq: "shopdb_order_seq",
};

/* ---------------------------------------------------------------- */
/* Small helpers                                                     */
/* ---------------------------------------------------------------- */

function read(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function delay(ms) {
  // Tiny artificial delay so the UI code already behaves correctly
  // once these calls become real network requests.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------------------------------- */
/* Seed data — only used the very first time the site loads          */
/* ---------------------------------------------------------------- */

function makePlaceholderImage(label, bg, fg) {
  const initial = (label || "?").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="300" height="300" fill="${bg}"/>
    <text x="50%" y="53%" font-family="Georgia, serif" font-size="120" fill="${fg}"
      text-anchor="middle" dominant-baseline="middle">${initial}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

function seedIfEmpty() {
  if (localStorage.getItem(DB_KEYS.categories)) return; // already seeded

  const categories = [
    { id: "cat_grocery", name: "Groceries" },
    { id: "cat_dairy", name: "Dairy & Bakery" },
    { id: "cat_beverages", name: "Beverages" },
    { id: "cat_snacks", name: "Snacks" },
    { id: "cat_household", name: "Household" },
  ];

  const palette = {
    cat_grocery: ["#EADFC4", "#5B4A2F"],
    cat_dairy: ["#F0E6DA", "#7A5C3E"],
    cat_beverages: ["#DCE6DD", "#2F4A38"],
    cat_snacks: ["#F3DCC9", "#8A4A22"],
    cat_household: ["#DEE3E6", "#3B4A52"],
  };

  const productDefs = [
    ["Basmati Rice (1kg)", "cat_grocery", 145, 40],
    ["Toor Dal (1kg)", "cat_grocery", 130, 35],
    ["Sunflower Oil (1L)", "cat_grocery", 165, 25],
    ["Whole Wheat Atta (5kg)", "cat_grocery", 260, 20],
    ["Fresh Milk (500ml)", "cat_dairy", 32, 50],
    ["Paneer (200g)", "cat_dairy", 90, 15],
    ["Brown Bread", "cat_dairy", 45, 18],
    ["Butter (100g)", "cat_dairy", 55, 0],
    ["Filter Coffee Powder (200g)", "cat_beverages", 120, 22],
    ["Masala Chai (250g)", "cat_beverages", 95, 30],
    ["Orange Juice (1L)", "cat_beverages", 110, 12],
    ["Mineral Water (1L)", "cat_beverages", 20, 60],
    ["Banana Chips (150g)", "cat_snacks", 60, 28],
    ["Masala Peanuts (200g)", "cat_snacks", 45, 33],
    ["Digestive Biscuits", "cat_snacks", 35, 40],
    ["Dish Wash Bar", "cat_household", 25, 45],
    ["Laundry Detergent (1kg)", "cat_household", 140, 16],
    ["Room Freshener", "cat_household", 85, 0],
  ];

  const products = productDefs.map(([name, categoryId, price, stock]) => {
    const [bg, fg] = palette[categoryId];
    return {
      id: uid("prod"),
      name,
      categoryId,
      price,
      stock,
      image: makePlaceholderImage(name, bg, fg),
      description: "",
    };
  });

  const settings = {
    storeName: "Shree Ganesh General Store",
    storeAddress: "12, Market Road, Near Bus Stand",
    contactNumber: "+91 90000 00000",
    ownerWhatsApp: "919000000000", // digits only, country code first, used for wa.me links
    ownerEmail: "",
  };

  const admin = {
    username: "owner",
    // Demo-only credential check. See the big warning in verifyAdmin().
    password: "store123",
  };

  write(DB_KEYS.categories, categories);
  write(DB_KEYS.products, products);
  write(DB_KEYS.orders, []);
  write(DB_KEYS.settings, settings);
  write(DB_KEYS.admin, admin);
  write(DB_KEYS.orderSeq, 1000);
}

seedIfEmpty();

/* ---------------------------------------------------------------- */
/* Public Store API                                                  */
/* ---------------------------------------------------------------- */

const Store = {
  /* ---------- Categories ---------- */

  async getCategories() {
    await delay(50);
    return read(DB_KEYS.categories, []);
  },

  async addCategory(name) {
    await delay(50);
    const categories = read(DB_KEYS.categories, []);
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Category name can't be empty.");
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("That category already exists.");
    }
    const category = { id: uid("cat"), name: trimmed };
    categories.push(category);
    write(DB_KEYS.categories, categories);
    return category;
  },

  async deleteCategory(categoryId) {
    await delay(50);
    const categories = read(DB_KEYS.categories, []).filter((c) => c.id !== categoryId);
    const products = read(DB_KEYS.products, []);
    if (products.some((p) => p.categoryId === categoryId)) {
      throw new Error("Move or remove the products in this category first.");
    }
    write(DB_KEYS.categories, categories);
  },

  /* ---------- Products ---------- */

  async getProducts() {
    await delay(50);
    return read(DB_KEYS.products, []);
  },

  async addProduct(product) {
    await delay(50);
    const products = read(DB_KEYS.products, []);
    const price = Number(product.price);
    const stock = Number(product.stock);
    if (!product.name || !product.name.trim()) throw new Error("Item name is required.");
    if (!product.categoryId) throw new Error("Please choose a category.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a valid, non-negative number.");
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      throw new Error("Stock must be a whole number, 0 or more.");
    }
    const categories = read(DB_KEYS.categories, []);
    const [bg, fg] = ["#E7E1D4", "#4A4438"];
    const newProduct = {
      id: uid("prod"),
      name: product.name.trim(),
      categoryId: product.categoryId,
      price,
      stock,
      image: product.image || makePlaceholderImage(product.name, bg, fg),
      description: (product.description || "").trim(),
    };
    products.push(newProduct);
    write(DB_KEYS.products, products);
    return newProduct;
  },

  async updateProduct(productId, changes) {
    await delay(50);
    const products = read(DB_KEYS.products, []);
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Product not found.");

    if (changes.price !== undefined) {
      const price = Number(changes.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("Price must be a valid, non-negative number.");
      changes.price = price;
    }
    if (changes.stock !== undefined) {
      const stock = Number(changes.stock);
      if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
        throw new Error("Stock must be a whole number, 0 or more.");
      }
      changes.stock = stock;
    }
    if (changes.name !== undefined && !changes.name.trim()) {
      throw new Error("Item name can't be empty.");
    }

    products[idx] = { ...products[idx], ...changes };
    write(DB_KEYS.products, products);
    return products[idx];
  },

  async adjustStock(productId, delta) {
    await delay(50);
    const products = read(DB_KEYS.products, []);
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Product not found.");
    const newStock = products[idx].stock + delta;
    if (newStock < 0) throw new Error("Stock can't go below zero.");
    products[idx].stock = newStock;
    write(DB_KEYS.products, products);
    return products[idx];
  },

  async deleteProduct(productId) {
    await delay(50);
    const products = read(DB_KEYS.products, []).filter((p) => p.id !== productId);
    write(DB_KEYS.products, products);
  },

  /* ---------- Settings ---------- */

  async getSettings() {
    await delay(30);
    return read(DB_KEYS.settings, {});
  },

  async updateSettings(changes) {
    await delay(30);
    const settings = { ...read(DB_KEYS.settings, {}), ...changes };
    write(DB_KEYS.settings, settings);
    return settings;
  },

  /* ---------- Admin auth (DEMO ONLY, see warning) ---------- */

  async verifyAdmin(username, password) {
    await delay(200);
    const admin = read(DB_KEYS.admin, {});
    // WARNING: this check happens entirely in the customer's browser,
    // using a password stored in plain text in localStorage. That is
    // fine for trying the app out, but it is NOT secure — anyone who
    // opens dev tools can read the password. Before going live, this
    // must be replaced with a real server-side login endpoint
    // (e.g. POST /api/login returning a session token).
    return admin.username === username && admin.password === password;
  },

  async changeAdminPassword(currentPassword, newPassword) {
    await delay(150);
    const admin = read(DB_KEYS.admin, {});
    if (admin.password !== currentPassword) throw new Error("Current password is incorrect.");
    if (!newPassword || newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
    admin.password = newPassword;
    write(DB_KEYS.admin, admin);
  },

  /* ---------- Orders ---------- */

  async getOrders() {
    await delay(50);
    return read(DB_KEYS.orders, []).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * cartItems: [{ productId, quantity }]
   * Validates stock, decrements it, stores the order, and returns
   * both the created order and a ready-to-use WhatsApp notify link
   * (built from the owner's number in settings).
   */
  async placeOrder(cartItems) {
    await delay(150);
    if (!cartItems || cartItems.length === 0) throw new Error("Your cart is empty.");

    const products = read(DB_KEYS.products, []);
    const lines = [];
    let total = 0;

    // Validate everything first, so an order never partially applies.
    for (const item of cartItems) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error("One of the items in your cart no longer exists.");
      if (item.quantity < 1) throw new Error(`Quantity for ${product.name} must be at least 1.`);
      if (item.quantity > product.stock) {
        throw new Error(`Only ${product.stock} left of ${product.name}. Please update your cart.`);
      }
    }

    for (const item of cartItems) {
      const product = products.find((p) => p.id === item.productId);
      const subtotal = product.price * item.quantity;
      total += subtotal;
      lines.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal,
      });
      product.stock -= item.quantity;
    }

    write(DB_KEYS.products, products);

    const seq = read(DB_KEYS.orderSeq, 1000) + 1;
    write(DB_KEYS.orderSeq, seq);

    const order = {
      id: uid("order"),
      orderNumber: "ORD-" + seq,
      items: lines,
      total,
      status: "new", // 'new' | 'processed'
      createdAt: Date.now(),
    };

    const orders = read(DB_KEYS.orders, []);
    orders.push(order);
    write(DB_KEYS.orders, orders);

    return { order, notifyUrl: buildOwnerNotifyUrl(order) };
  },

  async markOrderProcessed(orderId) {
    await delay(50);
    const orders = read(DB_KEYS.orders, []);
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error("Order not found.");
    orders[idx].status = "processed";
    write(DB_KEYS.orders, orders);
    return orders[idx];
  },
};

/* ---------------------------------------------------------------- */
/* Owner notification                                                */
/* ---------------------------------------------------------------- */

/**
 * Builds a WhatsApp "click to chat" link pre-filled with the order
 * details, using the owner's number from Settings. No account, API
 * key, or backend is required for this to work — opening the link
 * opens WhatsApp with the message ready to send.
 *
 * If you'd rather send this automatically via SMS/email/a backend
 * instead of relying on the customer's WhatsApp, swap this function
 * out for a fetch() call to your own notification endpoint — the
 * rest of the app doesn't need to change.
 */
function buildOwnerNotifyUrl(order) {
  const settings = read(DB_KEYS.settings, {});
  const when = new Date(order.createdAt).toLocaleString();
  const itemLines = order.items
    .map((i) => `- ${i.name} x${i.quantity} = ₹${i.subtotal.toFixed(2)}`)
    .join("\n");

  const message =
    `New order ${order.orderNumber}\n` +
    `Date: ${when}\n\n` +
    `${itemLines}\n\n` +
    `Total: ₹${order.total.toFixed(2)}\n\n` +
    `(Customer will pay & collect in-store)`;

  const phone = (settings.ownerWhatsApp || "").replace(/\D/g, "");
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

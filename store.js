/**
 * store.js — customer-facing storefront behaviour.
 * Talks to the data layer only through the `Store` object (data.js).
 */

let categories = [];
let products = [];
// cart: { [productId]: quantity }
let cart = {};

const el = (id) => document.getElementById(id);

function money(n) {
  return "₹" + Number(n).toFixed(2);
}

function showToast(message, isError) {
  const toast = el("toast");
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.className = "toast"), 2600);
}

/* ---------------------------------------------------------------- */
/* Boot                                                               */
/* ---------------------------------------------------------------- */

async function init() {
  const savedCart = sessionStorage.getItem("shop_cart");
  if (savedCart) {
    try { cart = JSON.parse(savedCart); } catch (e) { cart = {}; }
  }

  const [cats, prods, settings] = await Promise.all([
    Store.getCategories(),
    Store.getProducts(),
    Store.getSettings(),
  ]);
  categories = cats;
  products = prods;
  applySettings(settings);
  renderCatalog();
  renderCartDrawer();

  el("openCartBtn").addEventListener("click", openCart);
  el("closeCartBtn").addEventListener("click", closeCart);
  el("overlay").addEventListener("click", closeCart);
  el("billBtn").addEventListener("click", openBill);
  el("closeBillBtn").addEventListener("click", closeBill);
  el("billBackdrop").addEventListener("click", closeBill);
  el("orderBtn").addEventListener("click", placeOrder);
  el("confirmCloseBtn").addEventListener("click", closeConfirm);
  el("confirmBackdrop").addEventListener("click", closeConfirm);
}

function applySettings(settings) {
  if (!settings) return;
  el("brandName").textContent = settings.storeName || "Our Store";
  el("footerStoreName").textContent = settings.storeName || "";
  el("footerAddress").textContent = settings.storeAddress || "";
  el("footerContact").textContent = settings.contactNumber || "";
  document.title = settings.storeName || "Online Store";
}

function saveCart() {
  sessionStorage.setItem("shop_cart", JSON.stringify(cart));
}

/* ---------------------------------------------------------------- */
/* Catalog rendering                                                  */
/* ---------------------------------------------------------------- */

function renderCatalog() {
  const catalog = el("catalog");
  const jump = el("categoryJump");
  catalog.innerHTML = "";
  jump.innerHTML = "";

  categories.forEach((cat) => {
    const catProducts = products.filter((p) => p.categoryId === cat.id);
    if (catProducts.length === 0) return;

    const jumpLink = document.createElement("a");
    jumpLink.href = "#cat-" + cat.id;
    jumpLink.textContent = cat.name;
    jump.appendChild(jumpLink);

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = "cat-" + cat.id;

    section.innerHTML = `
      <h2>${escapeHtml(cat.name)}</h2>
      <span class="category-count">${catProducts.length} item${catProducts.length === 1 ? "" : "s"}</span>
      <div class="product-grid"></div>
    `;

    const grid = section.querySelector(".product-grid");
    catProducts.forEach((product) => grid.appendChild(renderProductCard(product)));
    catalog.appendChild(section);
  });

  if (categories.every((cat) => products.filter((p) => p.categoryId === cat.id).length === 0)) {
    catalog.innerHTML = `<p style="color:var(--ink-muted);">No products available right now — please check back soon.</p>`;
  }
}

function renderProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const outOfStock = product.stock <= 0;
  const qtyInCart = cart[product.id] || 0;

  card.innerHTML = `
    <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" />
    <div class="product-body">
      <div class="product-name">${escapeHtml(product.name)}</div>
      <div class="product-price">${money(product.price)}</div>
      <div class="stock-line ${outOfStock ? "out" : ""}">
        ${outOfStock ? "Out of Stock" : product.stock + " in stock"}
      </div>
    </div>
    <div class="product-footer">
      <div class="qty-row">
        <div class="qty-control">
          <button type="button" data-action="dec" ${outOfStock ? "disabled" : ""}>−</button>
          <input type="number" min="1" max="${product.stock}" value="1" data-qty-input ${outOfStock ? "disabled" : ""} />
          <button type="button" data-action="inc" ${outOfStock ? "disabled" : ""}>+</button>
        </div>
      </div>
      <div class="add-cart-wrap">
        <button class="glass-btn" data-action="add" ${outOfStock ? "disabled" : ""}>
          ${outOfStock ? "Out of Stock" : qtyInCart > 0 ? `In Cart (${qtyInCart}) · Add More` : "Add to Cart"}
        </button>
      </div>
    </div>
  `;

  const qtyInput = card.querySelector("[data-qty-input]");

  card.querySelector('[data-action="dec"]')?.addEventListener("click", () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
  });
  card.querySelector('[data-action="inc"]')?.addEventListener("click", () => {
    qtyInput.value = Math.min(product.stock, Number(qtyInput.value) + 1);
  });
  qtyInput?.addEventListener("change", () => {
    let v = Math.floor(Number(qtyInput.value)) || 1;
    v = Math.max(1, Math.min(product.stock, v));
    qtyInput.value = v;
  });

  card.querySelector('[data-action="add"]')?.addEventListener("click", () => {
    const qty = Math.max(1, Math.min(product.stock, Number(qtyInput.value) || 1));
    addToCart(product.id, qty);
  });

  return card;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

/* ---------------------------------------------------------------- */
/* Cart                                                                */
/* ---------------------------------------------------------------- */

function addToCart(productId, qty) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const current = cart[productId] || 0;
  const next = current + qty;
  if (next > product.stock) {
    showToast(`Only ${product.stock} of ${product.name} available.`, true);
    return;
  }
  cart[productId] = next;
  saveCart();
  renderCartDrawer();
  renderCatalog();
  showToast(`${product.name} added to cart.`);
}

function updateCartQty(productId, qty) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  if (qty <= 0) {
    delete cart[productId];
  } else if (qty > product.stock) {
    showToast(`Only ${product.stock} of ${product.name} available.`, true);
    cart[productId] = product.stock;
  } else {
    cart[productId] = qty;
  }
  saveCart();
  renderCartDrawer();
  renderCatalog();
}

function removeFromCart(productId) {
  delete cart[productId];
  saveCart();
  renderCartDrawer();
  renderCatalog();
}

function cartEntries() {
  return Object.entries(cart)
    .map(([productId, quantity]) => ({ product: products.find((p) => p.id === productId), quantity }))
    .filter((e) => e.product);
}

function cartTotals() {
  const entries = cartEntries();
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);
  const totalCost = entries.reduce((sum, e) => sum + e.quantity * e.product.price, 0);
  return { totalItems, totalCost, entries };
}

function renderCartDrawer() {
  const { entries, totalItems, totalCost } = cartTotals();
  el("cartCount").textContent = totalItems;
  el("cartItemCount").textContent = totalItems;
  el("cartTotal").textContent = money(totalCost);
  el("billBtn").disabled = entries.length === 0;

  const body = el("cartBody");
  if (entries.length === 0) {
    body.innerHTML = `<div class="empty-note">Your cart is empty. Add a few items from the store!</div>`;
    return;
  }

  body.innerHTML = "";
  entries.forEach(({ product, quantity }) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${product.image}" alt="${escapeHtml(product.name)}" />
      <div class="cart-item-info">
        <div class="cart-item-top">
          <span class="cart-item-name">${escapeHtml(product.name)}</span>
          <button class="cart-item-remove" data-remove>Remove</button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-control">
            <button type="button" data-dec>−</button>
            <input type="number" min="1" max="${product.stock}" value="${quantity}" data-qty />
            <button type="button" data-inc>+</button>
          </div>
          <span class="cart-item-subtotal">${money(product.price * quantity)}</span>
        </div>
      </div>
    `;
    row.querySelector("[data-remove]").addEventListener("click", () => removeFromCart(product.id));
    row.querySelector("[data-dec]").addEventListener("click", () => updateCartQty(product.id, quantity - 1));
    row.querySelector("[data-inc]").addEventListener("click", () => updateCartQty(product.id, quantity + 1));
    row.querySelector("[data-qty]").addEventListener("change", (e) => {
      const v = Math.floor(Number(e.target.value)) || 1;
      updateCartQty(product.id, v);
    });
    body.appendChild(row);
  });
}

function openCart() {
  el("cartDrawer").classList.add("open");
  el("overlay").classList.add("open");
}
function closeCart() {
  el("cartDrawer").classList.remove("open");
  el("overlay").classList.remove("open");
}

/* ---------------------------------------------------------------- */
/* Billing                                                            */
/* ---------------------------------------------------------------- */

function openBill() {
  const { entries, totalItems, totalCost } = cartTotals();
  if (entries.length === 0) return;

  const tbody = el("billTableBody");
  tbody.innerHTML = entries
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.product.name)}</td>
        <td>${money(e.product.price)}</td>
        <td>${e.quantity}</td>
        <td>${money(e.product.price * e.quantity)}</td>
      </tr>`
    )
    .join("");

  el("billItemCount").textContent = totalItems;
  el("billTotal").textContent = money(totalCost);

  closeCart();
  el("billModal").classList.add("open");
}

function closeBill() {
  el("billModal").classList.remove("open");
}

async function placeOrder() {
  const { entries } = cartTotals();
  if (entries.length === 0) return;

  const orderBtn = el("orderBtn");
  orderBtn.disabled = true;
  orderBtn.textContent = "Placing order…";

  try {
    const cartItems = entries.map((e) => ({ productId: e.product.id, quantity: e.quantity }));
    const { order, notifyUrl } = await Store.placeOrder(cartItems);

    // Refresh local product list so stock numbers reflect the order immediately.
    products = await Store.getProducts();
    cart = {};
    saveCart();
    renderCatalog();
    renderCartDrawer();

    closeBill();
    el("confirmOrderNumber").textContent = order.orderNumber;
    const link = el("whatsappLink");
    if (notifyUrl) {
      link.href = notifyUrl;
      link.style.display = "inline-block";
    } else {
      link.style.display = "none";
    }
    el("confirmModal").classList.add("open");
  } catch (err) {
    showToast(err.message || "Could not place order.", true);
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = "Order";
  }
}

function closeConfirm() {
  el("confirmModal").classList.remove("open");
}

init();

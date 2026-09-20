/**
 * admin.js — Store Admin Dashboard behaviour.
 * Session state (is the owner logged in) lives in sessionStorage only,
 * so it clears when the browser tab closes. This matches the demo-only
 * auth in data.js — see the warning there before deploying for real.
 */

const el = (id) => document.getElementById(id);

let categories = [];
let products = [];
let orders = [];

function money(n) {
  return "₹" + Number(n).toFixed(2);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function showToast(message, isError) {
  const toast = el("toast");
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.className = "toast"), 2600);
}

function showFormError(id, message) {
  const box = el(id);
  if (!message) {
    box.className = "form-error";
    box.textContent = "";
    return;
  }
  box.textContent = message;
  box.className = "form-error show";
}

/* ---------------------------------------------------------------- */
/* Auth / session                                                     */
/* ---------------------------------------------------------------- */

function isLoggedIn() {
  return sessionStorage.getItem("shop_admin_session") === "true";
}

function setLoggedIn(value) {
  if (value) sessionStorage.setItem("shop_admin_session", "true");
  else sessionStorage.removeItem("shop_admin_session");
}

async function handleLogin(e) {
  e.preventDefault();
  showFormError("loginError", "");
  const username = el("loginUsername").value.trim();
  const password = el("loginPassword").value;
  const ok = await Store.verifyAdmin(username, password);
  if (!ok) {
    showFormError("loginError", "Incorrect username or password.");
    return;
  }
  setLoggedIn(true);
  await enterDashboard();
}

function handleLogout() {
  setLoggedIn(false);
  el("dashScreen").style.display = "none";
  el("loginScreen").style.display = "flex";
  el("logoutBtn").style.display = "none";
  el("loginForm").reset();
}

/* ---------------------------------------------------------------- */
/* Boot                                                                */
/* ---------------------------------------------------------------- */

async function init() {
  el("loginForm").addEventListener("submit", handleLogin);
  el("logoutBtn").addEventListener("click", handleLogout);

  document.querySelectorAll(".dash-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  el("addProductForm").addEventListener("submit", handleAddProduct);
  el("addCatBtn").addEventListener("click", handleAddCategory);
  el("settingsForm").addEventListener("submit", handleSaveSettings);
  el("passwordForm").addEventListener("submit", handleChangePassword);

  if (isLoggedIn()) {
    await enterDashboard();
  }
}

async function enterDashboard() {
  el("loginScreen").style.display = "none";
  el("dashScreen").style.display = "flex";
  el("logoutBtn").style.display = "inline-block";
  await refreshAll();
}

async function refreshAll() {
  [categories, products, orders] = await Promise.all([
    Store.getCategories(),
    Store.getProducts(),
    Store.getOrders(),
  ]);
  renderCategoryOptions();
  renderProductsTable();
  renderCategoriesTable();
  renderStockTable();
  renderOrders();
  await loadSettingsForm();
}

function switchTab(tabId) {
  document.querySelectorAll(".dash-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));
  document.querySelectorAll(".dash-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tabId));
}

/* ---------------------------------------------------------------- */
/* Products                                                            */
/* ---------------------------------------------------------------- */

function renderCategoryOptions() {
  const select = el("newProdCategory");
  select.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

async function handleAddProduct(e) {
  e.preventDefault();
  showFormError("addProductError", "");
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const imageFile = el("newProdImage").files[0];
    const image = await readImageFile(imageFile);

    await Store.addProduct({
      name: el("newProdName").value,
      categoryId: el("newProdCategory").value,
      price: el("newProdPrice").value,
      stock: el("newProdStock").value,
      image,
      description: el("newProdDesc").value,
    });

    e.target.reset();
    await refreshAll();
    showToast("Item added to the store.");
  } catch (err) {
    showFormError("addProductError", err.message || "Could not add item.");
  } finally {
    submitBtn.disabled = false;
  }
}

function renderProductsTable() {
  const tbody = document.querySelector("#productsTable tbody");
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--ink-muted);">No products yet — add your first item above.</td></tr>`;
    return;
  }

  tbody.innerHTML = products
    .map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      const out = p.stock <= 0;
      return `
      <tr data-id="${p.id}">
        <td><img src="${p.image}" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover;" /></td>
        <td><input type="text" data-field="name" value="${escapeHtml(p.name)}" /></td>
        <td>${escapeHtml(cat ? cat.name : "—")}</td>
        <td><input type="number" min="0" step="0.01" data-field="price" value="${p.price}" style="width:80px;" /></td>
        <td><input type="number" min="0" step="1" data-field="stock" value="${p.stock}" style="width:70px;" /></td>
        <td><span class="pill ${out ? "out" : "ok"}">${out ? "Out of Stock" : "In Stock"}</span></td>
        <td class="row-actions">
          <button class="glass-btn small" data-action="save" style="background:rgba(31,61,43,0.85);">Save</button>
          <button class="glass-btn small danger" data-action="delete">Remove</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const name = row.querySelector('[data-field="name"]').value;
      const price = row.querySelector('[data-field="price"]').value;
      const stock = row.querySelector('[data-field="stock"]').value;
      try {
        await Store.updateProduct(id, { name, price, stock });
        await refreshAll();
        showToast("Product updated.");
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const product = products.find((p) => p.id === id);
      if (!confirm(`Remove "${product.name}" from the store?`)) return;
      await Store.deleteProduct(id);
      await refreshAll();
      showToast("Product removed.");
    });
  });
}

/* ---------------------------------------------------------------- */
/* Categories                                                          */
/* ---------------------------------------------------------------- */

async function handleAddCategory() {
  showFormError("addCategoryError", "");
  const input = el("newCatName");
  try {
    await Store.addCategory(input.value);
    input.value = "";
    await refreshAll();
    showToast("Category added.");
  } catch (err) {
    showFormError("addCategoryError", err.message);
  }
}

function renderCategoriesTable() {
  const tbody = document.querySelector("#categoriesTable tbody");
  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--ink-muted);">No categories yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = categories
    .map((c) => {
      const count = products.filter((p) => p.categoryId === c.id).length;
      return `
      <tr data-id="${c.id}">
        <td>${escapeHtml(c.name)}</td>
        <td>${count}</td>
        <td><button class="glass-btn small danger" data-action="delete">Remove</button></td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      try {
        await Store.deleteCategory(id);
        await refreshAll();
        showToast("Category removed.");
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

/* ---------------------------------------------------------------- */
/* Stock                                                                */
/* ---------------------------------------------------------------- */

function renderStockTable() {
  const tbody = document.querySelector("#stockTable tbody");
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--ink-muted);">No products yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = products
    .map((p) => {
      const out = p.stock <= 0;
      return `
      <tr data-id="${p.id}">
        <td>${escapeHtml(p.name)}</td>
        <td><strong data-current-stock>${p.stock}</strong></td>
        <td class="row-actions">
          <button class="glass-btn small" data-action="minus" style="background:rgba(31,61,43,0.85);">−1</button>
          <input type="number" min="1" step="1" value="1" data-adjust-qty style="width:60px;" />
          <button class="glass-btn small" data-action="plus" style="background:rgba(31,61,43,0.85);">+1</button>
        </td>
        <td class="row-actions">
          <input type="number" min="0" step="1" data-set-exact placeholder="Set to…" style="width:80px;" />
          <button class="glass-btn small" data-action="set" style="background:rgba(31,61,43,0.85);">Set</button>
        </td>
        <td><span class="pill ${out ? "out" : "ok"}">${out ? "Out of Stock" : "In Stock"}</span></td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.id;
    const qtyInput = row.querySelector("[data-adjust-qty]");

    row.querySelector('[data-action="plus"]').addEventListener("click", async () => {
      await adjustStock(id, Math.max(1, Number(qtyInput.value) || 1));
    });
    row.querySelector('[data-action="minus"]').addEventListener("click", async () => {
      await adjustStock(id, -Math.max(1, Number(qtyInput.value) || 1));
    });
    row.querySelector('[data-action="set"]').addEventListener("click", async () => {
      const exactInput = row.querySelector("[data-set-exact]");
      const target = Number(exactInput.value);
      if (!Number.isFinite(target) || target < 0) {
        showToast("Enter a valid stock quantity.", true);
        return;
      }
      try {
        await Store.updateProduct(id, { stock: target });
        await refreshAll();
        showToast("Stock updated.");
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

async function adjustStock(productId, delta) {
  try {
    await Store.adjustStock(productId, delta);
    await refreshAll();
    showToast(delta > 0 ? "Stock added." : "Stock removed.");
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ---------------------------------------------------------------- */
/* Orders                                                               */
/* ---------------------------------------------------------------- */

function renderOrders() {
  const list = el("ordersList");
  if (orders.length === 0) {
    list.innerHTML = `<p style="color:var(--ink-muted);">No orders yet.</p>`;
    return;
  }

  list.innerHTML = orders
    .map((order) => {
      const when = new Date(order.createdAt).toLocaleString();
      const itemsHtml = order.items
        .map((i) => `<li>${escapeHtml(i.name)} × ${i.quantity} — ${money(i.subtotal)}</li>`)
        .join("");
      return `
      <div class="order-card" data-id="${order.id}">
        <div class="order-card-head">
          <strong>${order.orderNumber}</strong>
          <span class="order-meta">${when}</span>
        </div>
        <ul class="order-items-list">${itemsHtml}</ul>
        <div class="order-card-foot">
          <div><strong>Total: ${money(order.total)}</strong></div>
          <div class="row-actions">
            <span class="pill ${order.status === "processed" ? "processed" : "new"}">
              ${order.status === "processed" ? "Processed" : "New"}
            </span>
            ${order.status !== "processed" ? `<button class="glass-btn small" data-action="process" style="background:rgba(31,61,43,0.85);">Mark Processed</button>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll('[data-action="process"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".order-card").dataset.id;
      await Store.markOrderProcessed(id);
      await refreshAll();
      showToast("Order marked as processed.");
    });
  });
}

/* ---------------------------------------------------------------- */
/* Settings                                                             */
/* ---------------------------------------------------------------- */

async function loadSettingsForm() {
  const settings = await Store.getSettings();
  el("setStoreName").value = settings.storeName || "";
  el("setStoreAddress").value = settings.storeAddress || "";
  el("setContact").value = settings.contactNumber || "";
  el("setWhatsApp").value = settings.ownerWhatsApp || "";
}

async function handleSaveSettings(e) {
  e.preventDefault();
  showFormError("settingsError", "");
  try {
    await Store.updateSettings({
      storeName: el("setStoreName").value.trim(),
      storeAddress: el("setStoreAddress").value.trim(),
      contactNumber: el("setContact").value.trim(),
      ownerWhatsApp: el("setWhatsApp").value.trim(),
    });
    showToast("Settings saved.");
  } catch (err) {
    showFormError("settingsError", err.message || "Could not save settings.");
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  showFormError("passwordError", "");
  try {
    await Store.changeAdminPassword(el("currentPass").value, el("newPass").value);
    e.target.reset();
    showToast("Password updated.");
  } catch (err) {
    showFormError("passwordError", err.message);
  }
}

init();

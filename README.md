# Local Shop — Online Store

A simple, responsive storefront + store-admin dashboard for a local shop.
No build tools required — plain HTML/CSS/JS.

## Files

```
store/
├── index.html        Customer storefront (browse, cart, bill, order)
├── admin.html         Store Login + Store Admin Dashboard
├── css/
│   └── style.css       All styling, incl. the glassmorphism buttons
└── js/
    ├── data.js          Data layer (see below) — the only file that
    │                    talks to storage. Everything else calls it.
    ├── store.js         Customer-side behaviour
    └── admin.js         Admin dashboard behaviour
```

## Running it

Just open `index.html` in a browser. For the "Add product image"
upload and some browsers' stricter file rules, it's more reliable to
serve it locally instead of opening the file directly, e.g.:

```
cd store
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

**Demo admin login:** username `owner`, password `store123`
(shown on the login screen too). Change it from Settings once logged in.

## How data currently persists

Right now `js/data.js` stores everything in the browser's
`localStorage`: products, categories, stock, orders, settings, and the
admin password. That's enough to try out the whole flow end-to-end,
but it means:

- Data lives only on one device/browser — a customer's browser can't
  see stock changes the owner made on their own phone.
- The admin password check happens in the browser, which is not secure.

This is intentional for a first version, and the code is already
structured so you can swap it for a real backend without touching the
UI files. **Every function customer/admin code calls goes through the
`Store` object in `data.js`** (`Store.getProducts()`,
`Store.placeOrder()`, `Store.addProduct()`, etc.), and each one already
returns a `Promise`. To connect a real backend:

1. Stand up an API (Node/Express, Django, Firebase, Supabase — anything).
2. In `data.js`, replace the body of each `Store.xxx` function with a
   `fetch()` call to your API instead of a `localStorage` read/write.
3. Replace `verifyAdmin` with a real login endpoint that returns a
   session token, and store that token instead of the plain
   `sessionStorage` flag used now.

Nothing in `store.js` or `admin.js` needs to change for this, since
they only ever call `await Store.something(...)`.

## Order notifications

There's no payment gateway anywhere in this app, by design. When a
customer places an order:

- The order (items, quantities, total, date/time, order number) is
  saved so the owner can see it on the **Orders** tab of the dashboard.
- Stock is reduced immediately, and items are marked **Out of Stock**
  automatically once stock hits zero.
- The customer sees a confirmation screen with a **"Notify store on
  WhatsApp"** link, pre-filled with the order details, built from the
  owner's WhatsApp number in **Settings**. No WhatsApp Business API or
  server is needed for this — it's a plain `wa.me` link.

If you'd rather send the notification automatically by SMS, email, or
a backend push instead of relying on a customer tapping a link, swap
out `buildOwnerNotifyUrl()` in `data.js` for a `fetch()` call to your
own notification endpoint.

## Notes

- Product images default to a generated placeholder if none is
  uploaded, so the store never shows broken image icons.
- All forms validate price/stock/quantity/login input before saving.
- The customer can never order more than the current stock — the
  quantity selectors are capped, and `Store.placeOrder` re-checks
  stock before confirming, in case stock changed after the page loaded.

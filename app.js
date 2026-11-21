/* Deko Arts Gallery — storefront + admin UI. All data goes through /api (server.js). No secrets here. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');
  const view = $('#view');
  const rid = () => Math.random().toString(36).slice(2, 7);

  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  function getSid() {
    let s = null;
    try { s = localStorage.getItem('dag_sid'); } catch { /* ignore */ }
    if (!s) { s = 'S' + rid() + Date.now().toString(36); try { localStorage.setItem('dag_sid', s); } catch { /* ignore */ } }
    return s;
  }

  const S = { products: [], cart: load('dag_cart', []), sid: getSid(), coupon: '', adm: { tab: 'overview', data: null, orderEdits: {}, bookEdits: {}, edit: null } };

  const SAMPLES = [
    ['Golden Hour over Mara', 'Landscape', 'Acrylic on canvas', '60 x 90 cm', 45000, 2, 'Warm savanna light across the Mara plains.', 'mara'],
    ['Portrait of Mama Wanjiru', 'Portrait', 'Oil on canvas', '50 x 70 cm', 62000, 1, 'A tender portrait in rich earth tones.', 'wanjiru'],
    ['Nairobi Rhythm', 'Abstract', 'Mixed media', '80 x 80 cm', 38000, 3, 'City energy in layered colour and texture.', 'nairobi'],
    ['Maasai Morning', 'Cultural', 'Acrylic on canvas', '70 x 100 cm', 55000, 2, 'Morning ritual at the edge of the village.', 'maasai'],
    ['Lamu Dhow', 'Seascape', 'Watercolour', '40 x 60 cm', 18500, 4, 'Sails against a Lamu dawn.', 'lamu'],
    ['Baobab Stillness', 'Landscape', 'Oil on board', '45 x 60 cm', 27000, 3, 'The old baobab at dusk.', 'baobab'],
    ['Woman in Kitenge', 'Portrait', 'Acrylic on canvas', '60 x 80 cm', 48000, 1, 'Pattern and pride in vivid colour.', 'kitenge'],
    ['Limited Print: Savanna Wind', 'Prints', 'Giclee print', '50 x 70 cm', 9500, 20, 'Signed limited edition print.', 'savanna']
  ];

  /* ---------- helpers ---------- */
  function toast(msg, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
  const prod = (id) => S.products.find((p) => p.id === id);
  const avail = (p) => p && p.status === 'published' && (p.stock || 0) > 0;
  function totals() {
    const lines = S.cart.map((i) => ({ p: prod(i.id), q: i.q })).filter((l) => l.p);
    const sub = lines.reduce((t, l) => t + l.p.price * l.q, 0);
    const ship = sub >= 20000 ? 0 : 500;
    const d = S.coupon.toUpperCase() === 'DEKO10' ? 0.1 : 0;
    return { lines, sub, ship: sub ? ship : 0, disc: Math.round(sub * d), total: sub ? Math.round(sub * (1 - d) + ship) : 0 };
  }
  function img(p) { return p.image ? esc(p.image) : 'https://picsum.photos/seed/' + encodeURIComponent(p.id) + '/600/750'; }

  /* ---------- cart ---------- */
  function syncCart(type, p, status) {
    save('dag_cart', S.cart);
    $('#cartN').textContent = S.cart.reduce((t, i) => t + i.q, 0);
    const t = totals();
    API.log('carts', S.sid, { sid: S.sid, status: status || 'open', updated: Date.now(), total: t.total, items: t.lines.map((l) => ({ id: l.p.id, name: l.p.name, price: l.p.price, q: l.q })) });
    if (type) API.log('cart_events', S.sid + '-' + Date.now().toString(36) + rid(), { sid: S.sid, type, productId: p ? p.id : '', name: p ? p.name : '', price: p ? p.price : 0, at: Date.now() });
    drawCart();
  }
  function addToCart(id, q = 1) {
    const p = prod(id);
    if (!avail(p)) return toast('Sorry, this artwork is no longer available', true);
    const it = S.cart.find((i) => i.id === id);
    const want = Math.min((it ? it.q : 0) + q, p.stock);
    if (it) it.q = want; else S.cart.push({ id, q: want });
    syncCart('add_to_cart', p);
    toast('Added to cart');
  }
  function setQty(id, q) {
    const p = prod(id), it = S.cart.find((i) => i.id === id);
    if (!it || !p) return;
    if (q < 1) { S.cart = S.cart.filter((i) => i.id !== id); syncCart('remove_from_cart', p); return; }
    it.q = Math.min(q, p.stock);
    syncCart('update_qty', p);
  }
  function drawCart() {
    const t = totals();
    $('#dlines').innerHTML = t.lines.length ? t.lines.map((l) => `
      <div class="line"><img src="${img(l.p)}" alt="">
        <div class="t">${esc(l.p.name)}<div class="muted">${money(l.p.price)}</div>
          <div class="qty" style="margin-top:6px"><button data-act="dec" data-id="${esc(l.p.id)}">−</button><span>${l.q}</span><button data-act="inc" data-id="${esc(l.p.id)}">+</button></div></div>
        <button class="btn ghost sm" data-act="rm" data-id="${esc(l.p.id)}">Remove</button></div>`).join('')
      : '<p class="muted" style="padding:20px 0">Your cart is empty.</p>';
    $('#dfoot').innerHTML = t.lines.length ? `
      <div class="sum"><span>Subtotal</span><span>${money(t.sub)}</span></div>
      <div class="sum"><span>Delivery</span><span>${t.ship ? money(t.ship) : 'Free'}</span></div>
      ${t.disc ? `<div class="sum"><span>Discount</span><span>− ${money(t.disc)}</span></div>` : ''}
      <div class="sum total"><span>Total</span><span>${money(t.total)}</span></div>
      <p class="muted" style="font-size:13px;margin:6px 0 12px">Free delivery on orders from KES 20,000.</p>
      <a class="btn" style="display:block;text-align:center" href="#/checkout">Checkout</a>` : '';
  }
  function openDrawer() { drawCart(); $('#drawer').classList.add('open'); $('#shade').classList.add('on'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#shade').classList.remove('on'); }

  /* ---------- views ---------- */
  function shopView() {
    const cats = [...new Set(S.products.map((p) => p.category).filter(Boolean))].sort();
    view.innerHTML = `
      <section class="hero"><h1>Original art from Kenya</h1>
        <p>Paintings, portraits and limited prints from Deko Arts Gallery. Pay securely with M-Pesa or PayPal. Commissions open.</p>
        <a class="btn" href="#/commission">Commission an artwork</a></section>
      <div class="wrap">
        <div class="tools"><input id="q" placeholder="Search artworks…" aria-label="Search">
          <select id="cat"><option value="">All categories</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
          <select id="sort"><option value="new">Newest</option><option value="lo">Price: low to high</option><option value="hi">Price: high to low</option></select></div>
        <div class="grid" id="grid"></div></div>`;
    const draw = () => {
      const q = $('#q').value.trim().toLowerCase(), c = $('#cat').value, s = $('#sort').value;
      let list = S.products.filter((p) => (!c || p.category === c) && (!q || (p.name + ' ' + (p.artist || '') + ' ' + (p.desc || '')).toLowerCase().includes(q)));
      if (s === 'lo') list.sort((a, b) => a.price - b.price); else if (s === 'hi') list.sort((a, b) => b.price - a.price); else list.sort((a, b) => (b.created || 0) - (a.created || 0));
      $('#grid').innerHTML = list.length ? list.map((p) => `
        <a class="card" href="#/product/${encodeURIComponent(p.id)}"><div class="img"><img loading="lazy" src="${img(p)}" alt="${esc(p.name)}">${avail(p) ? '' : '<span class="badge">SOLD</span>'}</div>
          <div class="info"><h3>${esc(p.name)}</h3><div class="muted">${esc(p.category || '')}${p.size ? ' · ' + esc(p.size) : ''}</div><div class="price">${money(p.price)}</div></div></a>`).join('')
        : `<p class="muted">${S.products.length ? 'No artworks match your search.' : 'New artworks coming soon.'}</p>`;
    };
    ['q', 'cat', 'sort'].forEach((id) => $('#' + id).addEventListener('input', draw));
    draw();
  }

  function productView(id) {
    const p = prod(id);
    if (!p) { view.innerHTML = '<div class="wrap"><p>Artwork not found. <a href="#/" style="color:var(--gold2)">Back to shop</a></p></div>'; return; }
    view.innerHTML = `<div class="wrap"><p><a class="muted" href="#/">← All artworks</a></p>
      <div class="two"><img class="big" src="${img(p)}" alt="${esc(p.name)}">
        <div><h1>${esc(p.name)}</h1><p class="muted">${esc(p.category || '')}${p.artist ? ' · ' + esc(p.artist) : ''}</p>
          <div class="price" style="font-size:26px;margin:8px 0">${money(p.price)}</div>
          <p>${esc(p.desc || '')}</p>
          <p class="muted">${p.medium ? 'Medium: ' + esc(p.medium) + '<br>' : ''}${p.size ? 'Size: ' + esc(p.size) + '<br>' : ''}${avail(p) ? (p.stock <= 3 ? 'Only ' + p.stock + ' left' : 'In stock') : 'Sold'}</p>
          ${avail(p) ? `<button class="btn" id="add">Add to cart</button> <a class="btn ghost" href="#/checkout" id="buy">Buy now</a>` : '<span class="badge" style="position:static">SOLD</span>'}
          <p class="muted" style="margin-top:18px;font-size:14px">Delivery KES 500, free over KES 20,000. Pay by M-Pesa or PayPal.</p></div></div></div>`;
    const add = $('#add');
    if (add) { add.onclick = () => { addToCart(p.id); openDrawer(); }; $('#buy').onclick = () => addToCart(p.id); }
  }

  function checkoutView() {
    const t = totals();
    if (!t.lines.length) { view.innerHTML = '<div class="wrap"><h1>Checkout</h1><p class="muted">Your cart is empty. <a style="color:var(--gold2)" href="#/">Browse artworks</a></p></div>'; return; }
    const known = load('dag_customer', {});
    view.innerHTML = `<div class="wrap"><h1>Checkout</h1><div class="two">
      <form class="panel stack" id="co">
        <div><label>Full name</label><input name="name" required maxlength="120" value="${esc(known.name || '')}"></div>
        <div class="row"><div><label>Phone (Safaricom for M-Pesa)</label><input name="phone" required placeholder="07XXXXXXXX" value="${esc(known.phone || '')}"></div>
          <div><label>Email</label><input name="email" type="email" value="${esc(known.email || '')}"></div></div>
        <div><label>Delivery address</label><textarea name="addr" required rows="3" maxlength="400">${esc(known.addr || '')}</textarea></div>
        <div><label>Payment method</label>
          <select name="method"><option value="mpesa">M-Pesa (STK push to your phone)</option><option value="paypal">PayPal / card (charged in USD)</option></select></div>
        <div><label>Discount code</label><input name="code" id="code" value="${esc(S.coupon)}" placeholder="Optional"></div>
        <button class="btn" id="pay">Place order</button><div id="msg"></div></form>
      <div class="panel" id="sumbox"></div></div></div>`;
    const sum = () => {
      S.coupon = $('#code').value.trim();
      const x = totals();
      $('#sumbox').innerHTML = `<h3>Order summary</h3>${x.lines.map((l) => `<div class="sum"><span>${esc(l.p.name)} × ${l.q}</span><span>${money(l.p.price * l.q)}</span></div>`).join('')}
        <div class="sum"><span>Subtotal</span><span>${money(x.sub)}</span></div><div class="sum"><span>Delivery</span><span>${x.ship ? money(x.ship) : 'Free'}</span></div>
        ${x.disc ? `<div class="sum"><span>Discount</span><span>− ${money(x.disc)}</span></div>` : ''}<div class="sum total"><span>Total</span><span>${money(x.total)}</span></div>
        <p class="muted" style="font-size:13px">The final amount is confirmed by our server when you place the order.</p>`;
    };
    $('#code').addEventListener('input', sum); sum();
    API.log('cart_events', S.sid + '-' + Date.now().toString(36) + rid(), { sid: S.sid, type: 'checkout_started', at: Date.now() });
    $('#co').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      save('dag_customer', { name: f.name, phone: f.phone, email: f.email, addr: f.addr });
      const btn = $('#pay'); btn.disabled = true; btn.textContent = 'Processing…'; $('#msg').innerHTML = '';
      try {
        const r = await API.checkout({ customer: { name: f.name, phone: f.phone, email: f.email, addr: f.addr }, method: f.method, items: S.cart.map((i) => ({ id: i.id, q: i.q })), code: S.coupon });
        if (r.approveUrl) { save('dag_pending', r.orderId); location.href = r.approveUrl; return; }
        waitForPayment(r.orderId);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Place order';
        $('#msg').innerHTML = `<div class="note err">${esc(err.message)}</div>`;
      }
    };
  }

  async function waitForPayment(orderId) {
    view.innerHTML = `<div class="wrap" style="max-width:640px"><div class="panel"><h2><span class="spin"></span>Check your phone</h2>
      <p>An M-Pesa prompt has been sent. Enter your PIN to pay. This page updates automatically.</p><p class="muted">Order <b>${esc(orderId)}</b></p>
      <a class="btn ghost sm" href="#/track/${encodeURIComponent(orderId)}">Track this order instead</a></div></div>`;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      if (!$('.spin')) return; // user navigated away
      try {
        const o = await API.order(orderId);
        if (['Paid', 'Processing', 'Shipped', 'Delivered'].includes(o.status)) return paid(o);
        if (o.status === 'Failed') return failed(o);
      } catch { /* keep polling */ }
    }
    view.innerHTML = `<div class="wrap" style="max-width:640px"><div class="panel"><h2>Still waiting…</h2><p>We have not received M-Pesa confirmation yet. If you paid, it will show on your order shortly.</p>
      <a class="btn" href="#/track/${encodeURIComponent(orderId)}">Track order ${esc(orderId)}</a></div></div>`;
  }
  function paid(o) {
    S.cart = []; S.coupon = ''; syncCart('purchase', null, 'converted');
    view.innerHTML = `<div class="wrap" style="max-width:640px"><div class="panel"><h2 style="color:var(--ok)">Payment received. Thank you!</h2>
      <p>Order <b>${esc(o.id)}</b>${o.ref ? ' · Receipt <b>' + esc(o.ref) + '</b>' : ''}</p>
      <p class="muted">We will contact you about delivery. Keep your order number to track it.</p>
      <a class="btn" href="#/track/${encodeURIComponent(o.id)}">Track order</a> <a class="btn ghost" href="#/">Keep browsing</a></div></div>`;
  }
  function failed(o) {
    view.innerHTML = `<div class="wrap" style="max-width:640px"><div class="panel"><h2 style="color:var(--bad)">Payment not completed</h2><p>${esc(o.failReason || 'The payment did not go through.')}</p>
      <a class="btn" href="#/checkout">Try again</a></div></div>`;
  }

  function trackView(id) {
    view.innerHTML = `<div class="wrap" style="max-width:720px"><h1>Track an order or booking</h1>
      <form class="panel" id="tf" style="display:flex;gap:10px"><input id="tid" placeholder="Order DAG-XXXXXXXXXX or booking BK-XXXXXX" value="${esc(id || '')}" required><button class="btn">Track</button></form><div id="tres"></div></div>`;
    const go = async (v) => {
      v = v.trim().toUpperCase(); if (!v) return;
      $('#tres').innerHTML = '<p class="muted"><span class="spin"></span>Looking up…</p>';
      try {
        if (v.startsWith('BK-')) {
          const b = await API.bookingStatus(v);
          $('#tres').innerHTML = `<div class="panel" style="margin-top:16px"><h3>Booking ${esc(b.ref)}</h3><p>${esc(b.service)}</p>${steps(['Pending', 'Confirmed', 'In progress', 'Completed'], b.status)}</div>`;
        } else {
          const o = await API.order(v);
          $('#tres').innerHTML = `<div class="panel" style="margin-top:16px"><h3>Order ${esc(o.id)}</h3>${steps(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered'], o.status)}
            ${o.status === 'Failed' ? `<div class="note err">${esc(o.failReason || 'Payment failed')}</div>` : ''}
            ${(o.items || []).map((i) => `<div class="sum"><span>${esc(i.name)} × ${i.q}</span><span>${money(i.price * i.q)}</span></div>`).join('')}
            <div class="sum total"><span>Total</span><span>${money(o.total)}</span></div></div>`;
        }
      } catch (e) { $('#tres').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
    };
    $('#tf').onsubmit = (e) => { e.preventDefault(); go($('#tid').value); };
    if (id) go(id);
  }
  const steps = (list, cur) => `<div class="steps">${list.map((s) => `<span class="${s === cur ? 'on' : ''}">${esc(s)}</span>`).join('')}${list.includes(cur) ? '' : `<span class="on">${esc(cur)}</span>`}</div>`;

  function commissionView() {
    view.innerHTML = `<div class="wrap" style="max-width:760px"><h1>Commissions &amp; services</h1>
      <p class="muted">Tell us what you have in mind: a portrait, a mural, a custom painting or framing. We will confirm availability and pricing.</p>
      <form class="panel stack" id="bf">
        <div class="row"><div><label>Full name</label><input name="name" required></div><div><label>Phone</label><input name="phone" required></div></div>
        <div class="row"><div><label>Email</label><input name="email" type="email"></div><div><label>Service</label><select name="service">
          <option>Custom portrait</option><option>Commissioned painting</option><option>Mural / wall art</option><option>Framing &amp; installation</option><option>Art consultation</option></select></div></div>
        <div class="row"><div><label>Preferred date</label><input name="date" type="date"></div><div><label>Size (e.g. 60 x 90 cm)</label><input name="size"></div></div>
        <div class="row"><div><label>Budget (KES)</label><input name="budget" inputmode="numeric"></div><div><label>Reference photos (optional)</label><input type="file" id="files" accept="image/*" multiple></div></div>
        <div><label>Describe your idea</label><textarea name="note" rows="4"></textarea></div>
        <button class="btn">Send request</button><div id="bmsg"></div></form></div>`;
    $('#bf').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      f.files = ($('#files').files || []).length; // only the count is stored for now
      try {
        const r = await API.booking(f);
        $('#bmsg').innerHTML = `<div class="note ok">Request received. Your booking reference is <b>${esc(r.ref)}</b>. We will call you soon. <a style="color:var(--gold2)" href="#/track/${encodeURIComponent(r.ref)}">Track it</a>.</div>`;
        e.target.reset();
      } catch (err) { $('#bmsg').innerHTML = `<div class="note err">${esc(err.message)}</div>`; }
    };
  }

  function contactView() {
    view.innerHTML = `<div class="wrap" style="max-width:640px"><h1>Contact us</h1><p class="muted">Questions about an artwork, shipping or prints? Send us a message.</p>
      <form class="panel stack" id="cf"><div class="row"><div><label>Name</label><input name="name" required></div><div><label>Phone or email</label><input name="contact" required></div></div>
        <div><label>Message</label><textarea name="message" rows="5" required></textarea></div><button class="btn">Send</button><div id="cmsg"></div></form></div>`;
    $('#cf').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      await API.log('service_requests', 'SR-' + Date.now().toString(36) + rid(), { ...f, at: Date.now(), sid: S.sid });
      $('#cmsg').innerHTML = '<div class="note ok">Thank you. We will get back to you shortly.</div>'; e.target.reset();
    };
  }

  /* ---------- admin ---------- */
  function adminView() {
    if (!API.adminKey()) {
      view.innerHTML = `<div class="wrap" style="max-width:420px"><h1>Staff sign-in</h1><form class="panel stack" id="lf"><div><label>Admin password</label><input type="password" id="pw" required autocomplete="current-password"></div>
        <button class="btn">Sign in</button><div id="lmsg"></div></form></div>`;
      $('#lf').onsubmit = async (e) => {
        e.preventDefault();
        try { sessionStorage.setItem('dag_admin', $('#pw').value); } catch { /* ignore */ }
        try { S.adm.data = await API.admin.data(); adminView(); }
        catch (err) { try { sessionStorage.removeItem('dag_admin'); } catch { /* ignore */ } $('#lmsg').innerHTML = `<div class="note err">${esc(err.message)}</div>`; }
      };
      return;
    }
    if (!S.adm.data) {
      view.innerHTML = '<div class="wrap"><p><span class="spin"></span>Loading dashboard…</p></div>';
      API.admin.data().then((d) => { S.adm.data = d; adminView(); }).catch((e) => { try { sessionStorage.removeItem('dag_admin'); } catch { /* ignore */ } toast(e.message, true); adminView(); });
      return;
    }
    const d = S.adm.data, tabs = ['overview', 'products', 'orders', 'bookings', 'carts', 'social'];
    view.innerHTML = `<div class="wrap"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h1>Admin</h1>
      <div><button class="btn ghost sm" id="refresh">Refresh</button> <button class="btn ghost sm" id="logout">Sign out</button></div></div>
      <div class="tabs">${tabs.map((t) => `<button data-tab="${t}" class="${S.adm.tab === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><div id="tab"></div></div>`;
    $$('[data-tab]').forEach((b) => b.onclick = () => { S.adm.tab = b.dataset.tab; S.adm.edit = null; adminView(); });
    $('#refresh').onclick = () => { S.adm.data = null; adminView(); };
    $('#logout').onclick = () => { try { sessionStorage.removeItem('dag_admin'); } catch { /* ignore */ } S.adm.data = null; adminView(); };
    ({ overview: aOverview, products: aProducts, orders: aOrders, bookings: aBookings, carts: aCarts, social: aSocial })[S.adm.tab](d, $('#tab'));
  }
  const dt = (n) => n ? new Date(n).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const OS = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Failed', 'Cancelled'], BS = ['Pending', 'Confirmed', 'In progress', 'Completed', 'Cancelled'];

  function aOverview(d, el) {
    const paidSt = ['Paid', 'Processing', 'Shipped', 'Delivered'];
    const paidOrders = d.orders.filter((o) => paidSt.includes(o.status));
    const rev = paidOrders.reduce((t, o) => t + (o.total || 0), 0);
    const day = Date.now() - 864e5;
    const openCarts = d.carts.filter((c) => c.status === 'open' && (c.items || []).length && c.updated > day).length;
    const ev = (t) => d.events.filter((e) => e.type === t).length;
    const best = {}; d.orders.filter((o) => paidSt.includes(o.status)).forEach((o) => o.items.forEach((i) => best[i.name] = (best[i.name] || 0) + i.q));
    const top = Object.entries(best).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = `<div class="stats">
      <div class="stat">Revenue (paid)<b>${money(rev)}</b></div><div class="stat">Orders<b>${d.orders.length}</b></div><div class="stat">Awaiting payment<b>${d.orders.filter((o) => o.status === 'Pending').length}</b></div>
      <div class="stat">Pending bookings<b>${d.bookings.filter((b) => b.status === 'Pending').length}</b></div><div class="stat">Published artworks<b>${d.products.filter((p) => p.status === 'published').length}</b></div>
      <div class="stat">Open carts (24h)<b>${openCarts}</b></div><div class="stat">Add-to-cart events<b>${ev('add_to_cart')}</b></div><div class="stat">Checkouts started<b>${ev('checkout_started')}</b></div></div>
      <div class="panel"><h3>Best sellers</h3>${top.length ? top.map(([n, q]) => `<div class="sum"><span>${esc(n)}</span><span>${q} sold</span></div>`).join('') : '<p class="muted">No paid orders yet.</p>'}</div>
      <p class="muted" style="font-size:13px">Cart analytics use the latest 1,000 events.</p>`;
  }

  function aProducts(d, el) {
    const e = S.adm.edit;
    el.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"><button class="btn" id="newp">+ New artwork</button><button class="btn ghost" id="samples">Load sample artworks</button></div>
      ${e ? productForm(e) : ''}
      <div class="panel scroll"><table><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>
        ${d.products.map((p) => `<tr><td><img class="thumb" src="${img(p)}" alt=""></td><td>${esc(p.name)}</td><td>${esc(p.category || '')}</td><td>${money(p.price)}</td><td>${p.stock ?? 0}</td><td>${esc(p.status)}</td>
          <td><button class="btn ghost sm" data-edit="${esc(p.id)}">Edit</button> <button class="btn danger sm" data-del="${esc(p.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No products yet. Add one or load the samples.</td></tr>'}</table></div>`;
    $('#newp').onclick = () => { S.adm.edit = { id: 'P-' + Date.now().toString(36) + rid(), status: 'published', stock: 1, category: 'Painting', created: Date.now(), isNew: true }; adminView(); };
    $('#samples').onclick = async () => {
      if (!confirm('Add 8 sample artworks? Existing samples will be overwritten.')) return;
      for (let i = 0; i < SAMPLES.length; i++) {
        const [name, category, medium, size, price, stock, desc, seed] = SAMPLES[i];
        await API.admin.saveProduct({ id: 'P-SAMPLE-' + (i + 1), name, category, medium, size, price, stock, desc, artist: 'Deko Arts', status: 'published', image: 'https://picsum.photos/seed/' + seed + '/600/750', created: Date.now() - i });
      }
      toast('Sample artworks loaded'); S.adm.data = null; await refreshProducts(); adminView();
    };
    $$('[data-edit]').forEach((b) => b.onclick = () => { S.adm.edit = { ...prod2(b.dataset.edit) }; adminView(); });
    $$('[data-del]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this artwork permanently?')) return;
      try { await API.admin.deleteProduct(b.dataset.del); toast('Deleted'); S.adm.data = null; await refreshProducts(); adminView(); } catch (err) { toast(err.message, true); }
    });
    const f = $('#pf');
    if (f) {
      $('#pimg').onchange = async (ev) => { const file = ev.target.files[0]; if (!file) return; try { $('#pimgdata').value = await compress(file); $('#ppreview').src = $('#pimgdata').value; } catch { toast('Could not read that image', true); } };
      $('#pcancel').onclick = () => { S.adm.edit = null; adminView(); };
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        const p = { ...S.adm.edit, name: v.name.trim(), category: v.category.trim(), artist: v.artist.trim(), medium: v.medium.trim(), size: v.size.trim(), desc: v.desc.trim(), price: Math.max(0, Math.round(+v.price || 0)), stock: Math.max(0, Math.floor(+v.stock || 0)), status: v.status, image: v.image || '' };
        delete p.isNew;
        try { await API.admin.saveProduct(p); toast('Saved'); S.adm.edit = null; S.adm.data = null; await refreshProducts(); adminView(); } catch (err) { toast(err.message, true); }
      };
    }
  }
  const prod2 = (id) => S.adm.data.products.find((p) => p.id === id);
  function productForm(p) {
    return `<form class="panel stack" id="pf" style="margin-bottom:16px"><h3>${p.isNew ? 'New artwork' : 'Edit artwork'}</h3>
      <div class="row"><div><label>Name</label><input name="name" required value="${esc(p.name)}"></div><div><label>Category</label><input name="category" value="${esc(p.category)}"></div></div>
      <div class="row"><div><label>Artist</label><input name="artist" value="${esc(p.artist)}"></div><div><label>Medium</label><input name="medium" value="${esc(p.medium)}"></div></div>
      <div class="row"><div><label>Size</label><input name="size" value="${esc(p.size)}"></div><div><label>Price (KES)</label><input name="price" type="number" min="0" required value="${esc(p.price)}"></div></div>
      <div class="row"><div><label>Stock</label><input name="stock" type="number" min="0" value="${esc(p.stock)}"></div><div><label>Status</label><select name="status">${['published', 'draft', 'sold'].map((s) => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div><label>Description</label><textarea name="desc" rows="3">${esc(p.desc)}</textarea></div>
      <div><label>Image (uploaded images are compressed)</label><input type="file" id="pimg" accept="image/*"><input type="hidden" name="image" id="pimgdata" value="${esc(p.image)}">
        <img id="ppreview" class="thumb" style="width:90px;height:110px;margin-top:8px" src="${p.image ? esc(p.image) : ''}" alt=""></div>
      <div><button class="btn">Save artwork</button> <button type="button" class="btn ghost" id="pcancel">Cancel</button></div></form>`;
  }
  function compress(file, max = 900) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = rej; im.src = r.result; };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  async function refreshProducts() { try { S.products = await API.products(); } catch { /* keep old */ } }

  function aOrders(d, el) {
    const list = [...d.orders].sort((a, b) => b.date - a.date);
    el.innerHTML = `<div class="panel scroll"><table><tr><th>Order</th><th>Date</th><th>Customer</th><th>Method</th><th>Total</th><th>Receipt</th><th>Status</th></tr>
      ${list.map((o) => `<tr><td>${esc(o.id)}</td><td>${dt(o.date)}</td><td>${esc(o.name)}<div class="muted">${esc(o.phone)} ${esc(o.email)}<br>${esc(o.addr)}</div></td><td>${esc(o.method)}</td><td>${money(o.total)}<div class="muted">${(o.items || []).map((i) => esc(i.name) + '×' + i.q).join(', ')}</div></td><td>${esc(o.ref || '')}</td>
        <td><select data-oid="${esc(o.id)}">${OS.map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No orders yet.</td></tr>'}</table></div>
      <p><button class="btn" id="saveO">Save status changes</button></p>`;
    $$('[data-oid]').forEach((s) => s.onchange = () => { S.adm.orderEdits[s.dataset.oid] = s.value; });
    $('#saveO').onclick = () => saveStatuses();
  }
  function aBookings(d, el) {
    const list = [...d.bookings].sort((a, b) => b.created - a.created);
    el.innerHTML = `<div class="panel scroll"><table><tr><th>Ref</th><th>Date</th><th>Customer</th><th>Service</th><th>Details</th><th>Status</th></tr>
      ${list.map((b) => `<tr><td>${esc(b.ref)}</td><td>${dt(b.created)}</td><td>${esc(b.name)}<div class="muted">${esc(b.phone)} ${esc(b.email)}</div></td><td>${esc(b.service)}</td>
        <td class="muted">${esc(b.date)} ${esc(b.size)} ${b.budget ? 'KES ' + esc(b.budget) : ''}<br>${esc(b.note)}${b.files ? '<br>' + esc(b.files) + ' photo(s) mentioned' : ''}</td>
        <td><select data-bref="${esc(b.ref)}">${BS.map((s) => `<option ${b.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No bookings yet.</td></tr>'}</table></div>
      <p><button class="btn" id="saveB">Save status changes</button></p>`;
    $$('[data-bref]').forEach((s) => s.onchange = () => { S.adm.bookEdits[s.dataset.bref] = s.value; });
    $('#saveB').onclick = () => saveStatuses();
  }
  async function saveStatuses() {
    const orders = Object.entries(S.adm.orderEdits).map(([id, status]) => ({ id, status }));
    const bookings = Object.entries(S.adm.bookEdits).map(([ref, status]) => ({ ref, status }));
    if (!orders.length && !bookings.length) return toast('No changes to save');
    try { await API.admin.statuses(orders, bookings); S.adm.orderEdits = {}; S.adm.bookEdits = {}; toast('Statuses saved'); S.adm.data = null; adminView(); } catch (e) { toast(e.message, true); }
  }
  function aCarts(d, el) {
    const list = [...d.carts].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 100);
    el.innerHTML = `<div class="panel scroll"><table><tr><th>Session</th><th>Updated</th><th>Items</th><th>Value</th><th>Status</th></tr>
      ${list.map((c) => `<tr><td>${esc(c.sid)}</td><td>${dt(c.updated)}</td><td>${(c.items || []).map((i) => esc(i.name) + '×' + i.q).join(', ')}</td><td>${money(c.total)}</td><td>${esc(c.status)}${c.status === 'open' && (c.items || []).length && Date.now() - c.updated > 36e5 ? ' (abandoned?)' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No cart activity yet.</td></tr>'}</table></div>`;
  }

  function aSocial(d, el) {
    const posts = load('dag_social', []);
    el.innerHTML = `<div class="panel stack"><h3>Social Studio</h3><p class="muted" style="font-size:14px">Plan posts for Instagram, TikTok, Facebook and WhatsApp. Posts are saved in this browser only for now.</p>
      <div class="row"><div><label>Platform</label><select id="sp">${['Instagram', 'TikTok', 'Facebook', 'WhatsApp Status'].map((x) => `<option>${x}</option>`).join('')}</select></div>
        <div><label>Artwork (optional)</label><select id="sa"><option value="">—</option>${d.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div></div>
      <div><label>Caption</label><textarea id="sc" rows="3"></textarea></div><div class="row"><div><label>Planned date</label><input type="date" id="sd"></div><div style="align-self:end"><button class="btn ghost" id="sg">Suggest caption</button> <button class="btn" id="ss">Save post</button></div></div></div>
      <div class="panel scroll" style="margin-top:16px"><table><tr><th>Date</th><th>Platform</th><th>Caption</th><th></th></tr>
      ${posts.map((p, i) => `<tr><td>${esc(p.date)}</td><td>${esc(p.platform)}</td><td>${esc(p.caption)}</td><td><button class="btn danger sm" data-sdel="${i}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No planned posts.</td></tr>'}</table></div>`;
    $('#sg').onclick = () => { const p = d.products.find((x) => x.id === $('#sa').value); $('#sc').value = p ? `New in the gallery: "${p.name}" — ${p.medium || p.category || 'original art'}, ${money(p.price)}. DM or order on our website. #DekoArtsGallery #KenyanArt` : 'Behind the scenes at Deko Arts Gallery. Commissions are open! #DekoArtsGallery #KenyanArt'; };
    $('#ss').onclick = () => { if (!$('#sc').value.trim()) return toast('Write a caption first', true); posts.unshift({ platform: $('#sp').value, caption: $('#sc').value.trim(), date: $('#sd').value || 'unscheduled' }); save('dag_social', posts); aSocial(d, el); };
    $$('[data-sdel]').forEach((b) => b.onclick = () => { posts.splice(+b.dataset.sdel, 1); save('dag_social', posts); aSocial(d, el); });
  }

  /* ---------- router & boot ---------- */
  function router() {
    const h = location.hash || '#/';
    closeDrawer();
    $$('[data-nav]').forEach((a) => a.classList.remove('on'));
    window.scrollTo(0, 0);
    if (/^#\/?admin/.test(h)) return adminView();
    let m;
    if ((m = h.match(/^#\/product\/(.+)$/))) return productView(decodeURIComponent(m[1]));
    if (h.startsWith('#/commission')) { $('[data-nav=commission]').classList.add('on'); return commissionView(); }
    if (h.startsWith('#/track')) { $('[data-nav=track]').classList.add('on'); return trackView(decodeURIComponent(h.split('/')[2] || '')); }
    if (h.startsWith('#/contact')) { $('[data-nav=contact]').classList.add('on'); return contactView(); }
    if (h.startsWith('#/checkout')) return checkoutView();
    $('[data-nav=shop]').classList.add('on');
    return shopView();
  }

  async function handlePaypalReturn() {
    const q = new URLSearchParams(location.search);
    if (q.get('paypal_cancel')) { history.replaceState(null, '', location.pathname + '#/checkout'); toast('PayPal payment cancelled', true); return true; }
    if (!q.get('paypal_return')) return false;
    const order = q.get('order'), token = q.get('token');
    history.replaceState(null, '', location.pathname + '#/track/' + encodeURIComponent(order || ''));
    view.innerHTML = '<div class="wrap" style="max-width:640px"><div class="panel"><h2><span class="spin"></span>Confirming your PayPal payment…</h2></div></div>';
    try { const o = await API.paypalCapture(order, token); paid(o); } catch (e) { view.innerHTML = `<div class="wrap" style="max-width:640px"><div class="panel"><h2 style="color:var(--bad)">Payment not confirmed</h2><p>${esc(e.message)}</p><a class="btn" href="#/checkout">Back to checkout</a></div></div>`; }
    return true;
  }

  async function boot() {
    $('#yr').textContent = new Date().getFullYear();
    $('#cartBtn').onclick = openDrawer;
    $('#closeDrawer').onclick = closeDrawer;
    $('#shade').onclick = closeDrawer;
    $('#drawer').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const it = S.cart.find((i) => i.id === b.dataset.id);
      if (b.dataset.act === 'inc') setQty(b.dataset.id, (it ? it.q : 0) + 1);
      if (b.dataset.act === 'dec') setQty(b.dataset.id, (it ? it.q : 1) - 1);
      if (b.dataset.act === 'rm') setQty(b.dataset.id, 0);
    });
    try { S.products = await API.products(); } catch (e) { toast('Could not load artworks: ' + e.message, true); }
    S.cart = S.cart.filter((i) => prod(i.id));
    save('dag_cart', S.cart);
    $('#cartN').textContent = S.cart.reduce((t, i) => t + i.q, 0);
    window.addEventListener('hashchange', router);
    if (await handlePaypalReturn()) return;
    router();
  }
  boot();
})();

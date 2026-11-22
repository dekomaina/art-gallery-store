/* Deko Arts Gallery - storefront + admin. All data goes through /api (server.js). No secrets here. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
const SV = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
const kes = n => 'KES ' + Math.round(+n || 0).toLocaleString();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PAL = [['#c9a24b', '#2a1a0f', '#e8d9b0', '#7a2e1d'], ['#1d3b4f', '#e9c46a', '#f4a261', '#0b1c26'], ['#3a0ca3', '#f72585', '#4cc9f0', '#10002b'], ['#2d6a4f', '#d8f3dc', '#b7e4c7', '#081c15'], ['#9d0208', '#ffba08', '#370617', '#faa307'], ['#264653', '#e76f51', '#f4f1de', '#2a9d8f']];
const SAMPLE = [['Golden Savannah', 'Original painting', 45000, 0], ['Echoes of Nairobi', 'Abstract', 32000, 2], ['Mama Africa', 'African contemporary', 58000, 4], ['Ocean Memory', 'Canvas print', 12000, 1], ['Midnight Bloom', 'Digital artwork', 6500, 2], ['Elder’s Gaze', 'Portrait', 38000, 5], ['Rift Valley Dawn', 'Wall art', 15000, 3], ['Kente Rhythm', 'African contemporary', 27000, 4]];

let products = [], cart = LS('dk_cart', []), wish = LS('dk_wish', []), cid = LS('dk_cid', null), disc = 0, wlOnly = false, loaded = false, loadErr = '';
let cartMeta = LS('dk_cartmeta', {});
const rid = () => Math.random().toString(36).slice(2, 8);

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2800) }

/* ---------- artwork ---------- */
function art(p) {
  if (p.img) return `<img src="${esc(p.img)}" alt="${esc(p.name)}">`;
  const pid = String(p.id).replace(/\W/g, '');
  let s = (p.seed || 3) * 9301, r = () => (s = (s * 49297 + 233280) % 233280) / 233280, c = PAL[(p.pal || 0) % PAL.length];
  let o = `<svg viewBox="0 0 300 380" role="img" aria-label="${esc(p.name)}"><defs><linearGradient id="g${pid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient></defs><rect width="300" height="380" fill="url(#g${pid})"/>`;
  for (let i = 0; i < 9; i++) { const col = c[i % 4]; o += i % 3 ? `<circle cx="${r() * 300}" cy="${r() * 380}" r="${20 + r() * 80}" fill="${col}" opacity="${.25 + r() * .5}"/>` : `<path d="M${r() * 300} ${r() * 380} Q${r() * 300} ${r() * 380} ${r() * 300} ${r() * 380} T${r() * 300} ${r() * 380}" stroke="${col}" stroke-width="${6 + r() * 14}" fill="none" opacity=".8" stroke-linecap="round"/>` }
  return o + '</svg>';
}
const sold = p => p.stock < 1 || p.status === 'sold';
function card(p) {
  const w = wish.includes(p.id);
  return `<div class="card">${sold(p) ? '<span class="tag">Sold</span>' : ''}<button class="heart ${w ? 'on' : ''}" onclick="fav('${esc(p.id)}')" aria-label="Wishlist">♥</button>${art(p)}<div class="b"><h3>${esc(p.name)}</h3><div class="mu">${esc(p.cat)}</div>${p.desc ? `<div class="mu" style="margin-top:.3rem">${esc(String(p.desc).slice(0, 90))}</div>` : ''}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.6rem"><span class="price">${kes(p.price)}</span><button class="btn sm" ${sold(p) ? 'disabled' : ''} onclick="add('${esc(p.id)}')">Add to cart</button></div></div></div>`;
}
const live = () => products.filter(p => p.status !== 'draft');
function fav(id) { wish = wish.includes(id) ? wish.filter(x => x != id) : [...wish, id]; SV('dk_wish', wish); shop(); home() }
function emptyMsg() { return loadErr ? `<div class="empty err">${esc(loadErr)}</div>` : loaded ? '<div class="empty">New artwork is coming soon. Check back shortly or <a href="#book" style="color:var(--gold)">commission a piece</a>.</div>' : '<div class="empty">Loading artwork…</div>' }
function home() {
  let f = live().filter(p => p.featured).slice(0, 4); if (!f.length) f = live().slice(0, 4);
  $('#featured').innerHTML = f.map(card).join('') || emptyMsg();
  $('#heroArt').innerHTML = f[0] ? art(f[0]) : '';
}
function shop() {
  let l = live(), q = $('#q').value.toLowerCase(), c = $('#cat').value, s = $('#sort').value;
  if (q) l = l.filter(p => p.name.toLowerCase().includes(q)); if (c) l = l.filter(p => p.cat == c); if (wlOnly) l = l.filter(p => wish.includes(p.id));
  if (s) l = [...l].sort((a, b) => s == 'a' ? a.price - b.price : b.price - a.price);
  $('#shopGrid').innerHTML = l.map(card).join('') || emptyMsg();
}
async function loadProducts() {
  try { products = await API.products(); loadErr = '' } catch (e) { loadErr = 'The shop could not load right now. Please refresh in a moment.' }
  loaded = true;
  cart = cart.filter(i => products.find(p => p.id == i.id)); SV('dk_cart', cart);
  home(); shop(); upCart();
}

/* ---------- cart (saved in the browser, logged to the server for analytics) ---------- */
const find = id => products.find(x => x.id == id);
const sub = () => cart.reduce((s, i) => { const p = find(i.id); return s + (p ? p.price * i.q : 0) }, 0), ship = () => !cart.length || sub() >= 20000 ? 0 : 500, cartTotal = () => Math.round(sub() * (1 - disc) + ship());
function trackCart(status) {
  if (!cart.length && !cid) return;
  if (!cid) { cid = 'C' + Date.now().toString(36) + rid(); cartMeta = { start: Date.now(), adds: 0 }; SV('dk_cid', cid) }
  const items = cart.map(i => { const p = find(i.id) || {}; return { id: i.id, q: i.q, name: p.name || i.id, price: p.price || 0 } });
  cartMeta.status = status || cartMeta.status || 'open'; SV('dk_cartmeta', cartMeta);
  API.log('carts', cid, { id: cid, start: cartMeta.start, upd: Date.now(), adds: cartMeta.adds || 0, items, value: cartTotal(), status: cartMeta.status });
}
function evt(type, p, q) { API.log('cart_events', 'E' + Date.now().toString(36) + rid(), { t: Date.now(), cart: cid, type, pid: p.id, name: p.name, price: p.price, q: q || 1 }) }
function add(id) {
  const p = find(id); if (!p || sold(p)) return toast('Sorry, this piece is sold');
  const i = cart.find(x => x.id == id);
  if (i) { if (i.q >= p.stock) return toast('Only ' + p.stock + ' in stock'); i.q++ } else cart.push({ id, q: 1 });
  if (!cid) { cid = 'C' + Date.now().toString(36) + rid(); cartMeta = { start: Date.now(), adds: 0 }; SV('dk_cid', cid) }
  cartMeta.adds = (cartMeta.adds || 0) + 1; cartMeta.status = 'open';
  SV('dk_cart', cart); trackCart('open'); evt('add', p); upCart(); toast(p.name + ' added to cart');
}
function qty(id, d) {
  const i = cart.find(x => x.id == id), p = find(id); if (!i || !p) return; i.q += d; if (i.q > p.stock) i.q = p.stock;
  if (i.q < 1) { cart = cart.filter(x => x.id != id); evt('remove', p) }
  SV('dk_cart', cart); trackCart(); upCart();
}
function applyDc() { if ($('#dc').value.trim().toUpperCase() == 'DEKO10') { disc = .1; toast('10% discount applied') } else toast('Invalid code'); upCart() }
function upCart() {
  $('#cc').textContent = cart.reduce((s, i) => s + i.q, 0);
  $('#items').innerHTML = cart.map(i => { const p = find(i.id); if (!p) return ''; return `<div class="it"><div class="th">${art(p)}</div><div style="flex:1"><b>${esc(p.name)}</b><div class="mu">${kes(p.price)}</div></div><button class="btn o sm" onclick="qty('${esc(i.id)}',-1)">−</button>${i.q}<button class="btn o sm" onclick="qty('${esc(i.id)}',1)">+</button></div>` }).join('') || '<p class="mu">Your cart is empty.</p>';
  $('#sum').innerHTML = cart.length ? `<p class="mu">Subtotal ${kes(sub())}<br>Shipping ${ship() ? kes(ship()) : 'Free'}${disc ? '<br>Discount −' + disc * 100 + '%' : ''}</p><div style="display:flex;gap:.5rem"><input id="dc" placeholder="Code (DEKO10)"><button class="btn o sm" onclick="applyDc()">Apply</button></div><h3 style="margin-top:1rem">${kes(cartTotal())}</h3><button class="btn" style="width:100%" onclick="startCk()">Checkout</button>` : '';
}
const openCart = () => { $('#drawer').classList.add('on'); upCart() }, closeCart = () => $('#drawer').classList.remove('on');
function startCk() { trackCart('checkout'); $('#ckTot').textContent = 'Total: ' + kes(cartTotal()); $('#ck').classList.add('on') }

/* ---------- payments ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms));
function finishPaid(o) {
  cartMeta.status = 'paid'; trackCart('paid'); cart = []; cid = null; cartMeta = {}; disc = 0; SV('dk_cart', cart); SV('dk_cid', null); SV('dk_cartmeta', cartMeta);
  $('#ck').classList.remove('on'); closeCart(); upCart(); receipt(o); loadProducts();
}
$('#ckForm').onsubmit = async e => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), b = $('#payBtn');
  if (!cart.length) return toast('Your cart is empty');
  b.disabled = true;
  try {
    const r = await API.checkout({ customer: { name: f.name, phone: f.phone, email: f.email, addr: f.addr }, method: f.pay, items: cart.map(i => ({ id: i.id, q: i.q })), code: disc ? 'DEKO10' : '' });
    if (f.pay == 'paypal') { b.textContent = 'Opening PayPal…'; location.href = r.approveUrl; return }
    b.textContent = 'Check your phone for the M-Pesa prompt…';
    let o = null;
    for (let n = 0; n < 40; n++) { await wait(3000); try { o = await API.order(r.orderId) } catch (x) { continue } if (o.status != 'Pending') break }
    if (o && o.status == 'Paid') finishPaid(o);
    else toast(o && o.status == 'Failed' ? 'Payment not completed: ' + (o.failReason || 'cancelled') : 'We did not receive payment confirmation. If money was deducted, contact us with ref ' + r.orderId);
  } catch (err) { toast(err.message) }
  b.disabled = false; b.textContent = 'Pay now';
};
function receipt(o) {
  $('#rcBox').innerHTML = `<h3>Order confirmed ✓</h3><p class="mu">Order ${esc(o.id)}<br>${o.method == 'mpesa' ? 'M-Pesa' : 'PayPal'} ref: ${esc(o.ref || '')}<br>${new Date(o.date).toLocaleString()}</p>${(o.items || []).map(i => `<div style="display:flex;justify-content:space-between"><span>${esc(i.name)} × ${i.q}</span><span>${kes(i.price * i.q)}</span></div>`).join('')}<h3 style="margin-top:1rem">Total ${kes(o.total)}</h3><p class="mu">Keep your order number to follow up with us.</p><button class="btn" onclick="print()">Print receipt</button> <button class="btn o" onclick="rc.classList.remove('on')">Close</button>`;
  $('#rc').classList.add('on');
}
async function paypalReturn() {
  const q = new URLSearchParams(location.search);
  if (q.get('paypal_cancel')) { toast('PayPal payment cancelled'); history.replaceState(null, '', location.pathname + location.hash) }
  if (q.get('paypal_return')) {
    const order = q.get('order'), token = q.get('token'); history.replaceState(null, '', location.pathname + location.hash);
    try { const o = await API.paypalCapture(order, token); finishPaid(o) } catch (e) { toast(e.message) }
  }
}

/* ---------- forms ---------- */
$('#bkForm').onsubmit = async e => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); f.files = e.target.elements.ref.files.length; delete f.ref;
  try { const r = await API.booking(f); e.target.reset(); toast('Request sent. Your reference: ' + r.ref); $('#trOut').textContent = 'Your reference: ' + r.ref + ' (Pending)' } catch (err) { toast(err.message) }
};
$('#trForm').onsubmit = async e => {
  e.preventDefault(); const ref = e.target.elements.ref.value.trim().toUpperCase(); if (!ref) return;
  try { const b = await API.bookingStatus(ref); $('#trOut').textContent = `${b.ref}: ${b.service} — ${b.status}` } catch (err) { $('#trOut').textContent = 'Booking not found. Check the reference.' }
};
$('#ctForm').onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); API.log('service_requests', 'M' + Date.now().toString(36) + rid(), { ...f, t: Date.now() }); e.target.reset(); toast('Message sent. We will reply soon.') };
$('#wa').href = 'https://wa.me/254743524067';
const info = (a, c) => `<div class="box"><h3>${a}</h3><p class="mu">${c}</p></div>`;
$('#motionCards').innerHTML = [['3D animation', 'Cinematic product and character animation.'], ['3D product visualization', 'Photoreal renders for brands.'], ['Motion graphics', 'Logo stings, explainers, social reels.'], ['2D animation & character design', 'Hand-crafted characters and stories.'], ['Branding & graphic design', 'Identity systems that feel premium.'], ['Video production', 'Shoot, edit, grade and deliver.'], ['Portfolio showcase', 'Painting-process films and project reels.']].map(x => info(esc(x[0]), x[1])).join('');
$('#svcCards').innerHTML = [['Interior art consultation', 'Choose pieces that fit your space.'], ['Wall painting & murals', 'Large-scale murals for homes and offices.'], ['Home & office decoration', 'Curated decor and finishing.'], ['Wall art installation', 'Safe, professional hanging.'], ['Branding services', 'Logos, signage and collateral.'], ['On-site creative services', 'Live painting and installations.']].map(x => info(esc(x[0]), x[1])).join('');

/* ---------- admin ---------- */
const TABS = ['Overview', 'Products', 'Cart Analytics', 'Orders', 'Commissions', 'Messages'];
let tab = 'Overview', D = { products: [], orders: [], bookings: [], carts: [], events: [] };
const PAID = ['Paid', 'Processing', 'Shipped', 'Delivered'];
async function adminLoad() { D = await API.admin.data() }
async function adminShow() { $('#gate').style.display = 'none'; $('#panel').style.display = 'block'; await adminRender() }
async function adminRender() {
  try { await adminLoad() } catch (e) { if (e.status == 401) return adminOut('Session expired. Sign in again.'); toast(e.message) }
  $('#side').innerHTML = TABS.map(t => `<button class="${t == tab ? 'on' : ''}" onclick="tab='${t}';adminRender()">${t}</button>`).join('') + '<button onclick="adminOut()">Sign out</button>';
  ({ Overview: ov, Products: pr, 'Cart Analytics': ca, Orders: od, Commissions: bk, Messages: ms })[tab]($('#aMain'));
}
function adminOut(msg) { try { sessionStorage.removeItem('dag_admin') } catch (e) { } $('#panel').style.display = 'none'; $('#gate').style.display = 'block'; $('#pw').value = ''; $('#gErr').textContent = msg || ''; }
$('#gForm').onsubmit = async e => {
  e.preventDefault(); const pw = $('#pw').value; if (!pw) return; $('#gErr').textContent = '';
  try { sessionStorage.setItem('dag_admin', pw); await API.admin.data(); await adminShow() } catch (err) { try { sessionStorage.removeItem('dag_admin') } catch (x) { } $('#gErr').textContent = err.status == 401 ? 'Wrong password' : err.message }
};
const tbl = (h, rows) => `<div class="tw"><table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${h.length}" class="mu">No data yet.</td></tr>`}</table></div>`;
const fmt = t => t ? new Date(t).toLocaleString() : '—';
function ov(m) {
  const paid = D.orders.filter(o => PAID.includes(o.status)), rev = paid.reduce((s, o) => s + o.total, 0), adds = D.events.filter(e => e.type == 'add').length;
  const ab = D.carts.filter(c => c.status != 'paid' && (c.items || []).length), conv = D.carts.length ? Math.round(D.carts.filter(c => c.status == 'paid').length / D.carts.length * 100) : 0;
  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5).toDateString(); return [d.slice(0, 3), paid.filter(o => new Date(o.paidAt || o.date).toDateString() == d).reduce((s, o) => s + o.total, 0)] }), mx = Math.max(1, ...days.map(d => d[1]));
  const byM = ['mpesa', 'paypal'].map(k => [k == 'mpesa' ? 'M-Pesa' : 'PayPal', paid.filter(o => o.method == k).length, kes(paid.filter(o => o.method == k).reduce((s, o) => s + o.total, 0))]);
  m.innerHTML = `<div class="kpi"><div class="box"><span class="mu">Total sales</span><b>${kes(rev)}</b></div><div class="box"><span class="mu">Paid orders</span><b>${paid.length}</b></div><div class="box"><span class="mu">Added to carts</span><b>${adds}</b></div><div class="box"><span class="mu">Commissions</span><b>${D.bookings.length}</b></div><div class="box"><span class="mu">Abandoned carts</span><b>${ab.length}</b></div><div class="box"><span class="mu">Conversion</span><b>${conv}%</b></div></div><div class="box"><h3>Sales — last 7 days</h3><svg viewBox="0 0 350 140" width="100%">${days.map((d, i) => `<rect x="${i * 50 + 10}" y="${110 - d[1] / mx * 100}" width="30" height="${d[1] / mx * 100}" fill="var(--gold)" rx="3"/><text x="${i * 50 + 25}" y="130" text-anchor="middle" font-size="10" fill="var(--mu)">${d[0]}</text>`).join('')}</svg></div><br><div class="box"><h3>Sales by method</h3>${tbl(['Method', 'Orders', 'Revenue'], byM)}</div>`;
}
function thumb(p) { return `<div class="thumb">${art(p)}</div>` }
function pr(m) {
  m.innerHTML = `<div class="box"><h3 id="pfT">Add new painting</h3><form id="pf"><input type="hidden" name="id"><input name="name" placeholder="Painting name" required><select name="cat">${$$('#cat option').slice(1).map(o => `<option>${o.textContent}</option>`).join('')}</select><input name="price" type="number" min="1" placeholder="Price (KES)" required><input name="stock" type="number" min="0" placeholder="Stock" value="1"><select name="status"><option value="published">Published (visible in shop)</option><option value="draft">Draft (hidden)</option></select><label>Painting image (from your computer)</label><input type="file" name="img" accept="image/*"><label><input type="checkbox" name="feat" style="width:auto"> Feature on homepage</label><textarea name="desc" placeholder="Story / description"></textarea><div class="row"><button class="btn">Save painting</button><button type="button" class="btn o" onclick="pr($('#aMain'))">Clear</button></div></form></div><br><div class="row"><button class="btn o sm" onclick="seed()">Load sample artworks</button></div><br>` +
    tbl(['', 'SKU', 'Name', 'Category', 'Price', 'Stock', 'Status', 'Actions'], D.products.map(p => [thumb(p), esc(p.sku || ''), esc(p.name), esc(p.cat), kes(p.price), p.stock, `<span class="st ${p.status == 'published' ? 'g' : ''}">${esc(p.status)}</span>${p.featured ? ' ★' : ''}`, `<button class="btn o sm" onclick="pEdit('${esc(p.id)}')">Edit</button> <button class="btn o sm" onclick="pAct('${esc(p.id)}','feat')">★</button> <button class="btn o sm" onclick="pAct('${esc(p.id)}','sold')">${sold(p) ? 'Restock' : 'Sold'}</button> <button class="btn o sm" onclick="pAct('${esc(p.id)}','del')">Delete</button>`]));
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, old = D.products.find(x => x.id == f.elements.id.value) || {}, n = D.products.length + 1;
    const go = async img => {
      const p = { ...old, id: old.id || 'P' + Date.now().toString(36) + rid(), name: f.elements.name.value.trim(), cat: f.elements.cat.value, price: Math.round(+f.elements.price.value), stock: Math.max(0, Math.floor(+f.elements.stock.value || 0)), sku: old.sku || 'DAG-' + (100 + n), status: f.elements.status.value, featured: f.elements.feat.checked, desc: f.elements.desc.value.trim(), pal: old.pal != null ? old.pal : n % 6, seed: old.seed || n + 7 };
      if (img) p.img = img;
      if (p.status == 'sold' && p.stock > 0) p.status = 'published';
      try { await API.admin.saveProduct(p); toast('Painting saved'); adminRender() } catch (err) { toast(err.message) }
    };
    const file = f.elements.img.files[0]; if (file) compress(file).then(go).catch(() => toast('Could not read that image')); else go(null);
  };
}
function compress(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)) }; im.src = r.result }; r.readAsDataURL(file) });
}
function pEdit(id) {
  const p = D.products.find(x => x.id == id), f = $('#pf'); if (!p) return;
  f.elements.id.value = p.id; f.elements.name.value = p.name; f.elements.cat.value = p.cat; f.elements.price.value = p.price; f.elements.stock.value = p.stock; f.elements.status.value = p.status == 'draft' ? 'draft' : 'published'; f.elements.feat.checked = !!p.featured; f.elements.desc.value = p.desc || '';
  $('#pfT').textContent = 'Edit painting (choose a new image only to replace it)'; f.scrollIntoView({ behavior: 'smooth' });
}
async function pAct(id, a) {
  const p = D.products.find(x => x.id == id); if (!p) return;
  try {
    if (a == 'del') { if (!confirm('Delete "' + p.name + '" permanently?')) return; await API.admin.deleteProduct(id) }
    else { if (a == 'sold') { if (sold(p)) { p.stock = 1; p.status = 'published' } else { p.status = 'sold'; p.stock = 0 } } if (a == 'feat') p.featured = !p.featured; await API.admin.saveProduct(p) }
    adminRender();
  } catch (e) { toast(e.message) }
}
async function seed() {
  if (!confirm('Add 8 sample paintings? You can delete them later.')) return;
  try { for (let i = 0; i < SAMPLE.length; i++) { const a = SAMPLE[i]; await API.admin.saveProduct({ id: 'P-SAMPLE-' + (i + 1), name: a[0], cat: a[1], price: a[2], pal: a[3], seed: i + 3, stock: i % 4 == 3 ? 1 : 5, sku: 'DAG-' + (100 + i), status: 'published', featured: i < 4 }) } toast('Sample artworks added'); adminRender() } catch (e) { toast(e.message) }
}
function ca(m) {
  const cnt = {}; D.events.filter(e => e.type == 'add').forEach(e => { const k = e.pid; cnt[k] = cnt[k] || { name: e.name, n: 0 }; cnt[k].n++ });
  const top = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n), ab = D.carts.filter(c => c.status != 'paid' && (c.items || []).length);
  m.innerHTML = `<h3>Most added to cart</h3>` + tbl(['Painting', 'Times added', 'Stock'], top.map(([id, x]) => { const p = D.products.find(q => q.id == id); return [esc(x.name), x.n, p ? p.stock : '—'] })) +
    `<h3 style="margin-top:1.5rem">Carts (what customers added)</h3>` + tbl(['Cart', 'Started', 'Last activity', 'Items', 'Value', 'Status'], D.carts.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0)).map(c => [esc(c.id), fmt(c.start), fmt(c.upd), (c.items || []).map(i => esc(i.name) + ' ×' + i.q).join(', ') || '—', kes(c.value), `<span class="st ${c.status == 'paid' ? 'g' : 'r'}">${c.status == 'paid' ? 'purchased' : c.status == 'checkout' ? 'abandoned at checkout' : 'in cart / abandoned'}</span>`])) +
    `<p class="mu">${ab.length} carts not yet purchased.</p>`;
}
function od(m) {
  m.innerHTML = tbl(['Order', 'Date', 'Customer', 'Phone', 'Address', 'Items', 'Total', 'Method', 'Reference', 'Status'], D.orders.slice().sort((a, b) => b.date - a.date).map(o => [esc(o.id), fmt(o.date), esc(o.name), esc(o.phone), esc(o.addr), (o.items || []).map(x => esc(x.name) + '×' + x.q).join(', '), kes(o.total), esc(o.method), esc(o.ref || ''), sel(o.status, ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded', 'Failed'], `setSt('o','${esc(o.id)}',this.value)`)]));
}
function bk(m) {
  m.innerHTML = `<h3>Commissions &amp; event bookings</h3>` + tbl(['Ref', 'Received', 'Client', 'Phone', 'Email', 'Service', 'Event date', 'Size', 'Budget', 'Idea', 'Status'], D.bookings.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).map(b => [esc(b.ref), fmt(b.created), esc(b.name), esc(b.phone), esc(b.email), esc(b.service), esc(b.date || '—'), esc(b.size), esc(b.budget || '—'), esc(String(b.note || '').slice(0, 80)), sel(b.status, ['Pending', 'Quoted', 'Deposit paid', 'In progress', 'Completed', 'Cancelled'], `setSt('b','${esc(b.ref)}',this.value)`)]));
}
function ms(m) { m.innerHTML = '<p class="mu">Contact-form messages are stored in the database table service_requests (Supabase).</p>' }
const sel = (cur, opts, on) => `<select onchange="${on}" style="width:auto;padding:.2rem">${opts.map(s => `<option ${s == cur ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
async function setSt(k, id, v) { try { await API.admin.statuses(k == 'o' ? [{ id, status: v }] : [], k == 'b' ? [{ ref: id, status: v }] : []); toast('Status updated') } catch (e) { toast(e.message) } }

/* ---------- theme + router ---------- */
function toggleTheme() { const r = document.documentElement, d = r.dataset.theme ? r.dataset.theme == 'dark' : !matchMedia('(prefers-color-scheme:light)').matches; r.dataset.theme = d ? 'light' : 'dark' }
function route() { let h = (location.hash || (location.pathname.replace(/\/+$/, '') == '/admin' ? '#admin' : '#home')).slice(1); if (h == '/admin') h = 'admin'; if (!$('#' + h)) h = 'home'; $$('section.v').forEach(s => s.classList.toggle('on', s.id == h)); $$('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') == '#' + h)); scrollTo(0, 0) }
addEventListener('hashchange', route);
route(); home(); shop(); upCart(); loadProducts(); paypalReturn();
try { if (sessionStorage.getItem('dag_admin')) { API.admin.data().then(() => adminShow()).catch(() => adminOut()) } } catch (e) { }

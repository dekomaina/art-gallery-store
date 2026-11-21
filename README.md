# Deko Arts Gallery – full stack (storefront + admin + M-Pesa + PayPal + Supabase)

## Where everything goes
| File | What it is | Where your keys go |
|---|---|---|
| `public/index.html` | Storefront + admin UI | **No secrets here, ever** |
| `public/js/api-mode.js` | Connects the UI to the backend | none |
| `server.js` | Backend: checkout, Daraja STK Push, PayPal, admin API | reads `.env` |
| `.env` (copy of `.env.example`) | **All secrets** | Daraja, PayPal, Supabase service key, admin password |
| `supabase/schema.sql` | Database tables + security | run once in Supabase |

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Project Settings → API: copy **Project URL** and the **service_role** key into `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Never put the service_role key in HTML/JS.

## 2. M-Pesa (Daraja)
1. Sign up at developer.safaricom.co.ke → My Apps → create an app with *Lipa na M-Pesa Sandbox*.
2. Copy Consumer Key/Secret into `.env`. Sandbox shortcode `174379` and the sandbox passkey are pre-filled.
3. Set `MPESA_CALLBACK_SECRET` to any long random string. The callback URL becomes `PUBLIC_URL/api/mpesa/callback/<secret>` and must be public HTTPS (use ngrok locally: `ngrok http 3000`, then set `PUBLIC_URL` to the ngrok URL).
4. Go live: apply for Go-Live on the portal with your Paybill/Till, then set `MPESA_ENV=production`, your real shortcode and passkey.

## 3. PayPal
1. developer.paypal.com → Apps & Credentials → create a Sandbox app → copy Client ID/Secret into `.env`.
2. PayPal does not support KES, so customers are charged in USD at `KES_PER_USD`. Update the rate as needed.
3. Go live: switch to the Live app credentials and set `PAYPAL_ENV=live`.

## 4. Run
```
cp .env.example .env     # fill it in
npm install
npm start                # http://localhost:3000
```
Open `/#admin`, sign in with `ADMIN_PASSWORD`, click **Products → Load sample artworks** (or upload your own), then test a purchase.

## 5. Deploy
Any Node host works (Render, Railway, Fly.io, a VPS). Set the same variables in the host's dashboard, set `PUBLIC_URL` to the live https URL, then point your domain (e.g. dekoartsgallery.com) at it. The admin area is `/#admin`.

## How payments are secured
- Prices are recomputed on the server from the database; the browser total is ignored.
- Orders become **Paid** only after Safaricom's callback (amount checked) or a completed PayPal capture (USD amount checked).
- Duplicate callbacks are ignored; receipts are stored in `payments` by unique reference; stock is reduced once.
- Row Level Security blocks all direct browser access to the tables.

## Known limits (next steps)
- Admin login is a single shared password. Move to Supabase Auth with roles when you add staff.
- Product images are stored (compressed) inside the product record. Move to Supabase Storage for large catalogues.
- Booking reference photos: only the file count is saved so far.
- Social Studio posts/analytics are still browser-local; connect Meta/TikTok official APIs to make them real.
- Email/WhatsApp notifications and abandoned-cart messages are not included.
- Admin cart analytics read the latest 1,000 events.

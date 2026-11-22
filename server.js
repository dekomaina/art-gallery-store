require('dotenv').config();
const express=require('express'),cors=require('cors'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),path=require('path'),crypto=require('crypto'),fs=require('fs');
const {createClient}=require('@supabase/supabase-js');
const E=process.env;
const isProduction = String(E.NODE_ENV || '').toLowerCase() === 'production';
const hasServiceRole = Boolean(E.SUPABASE_URL && E.SUPABASE_SERVICE_ROLE_KEY && !String(E.SUPABASE_SERVICE_ROLE_KEY).includes('sb_publishable_'));
const sb = hasServiceRole ? createClient(E.SUPABASE_URL,E.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}) : null;
const shouldUseLocalFallback = !hasServiceRole && !isProduction;
if (!hasServiceRole && isProduction) {
  console.error('Production requires SUPABASE_SERVICE_ROLE_KEY. Set it in the environment before starting the app.');
  process.exit(1);
}
const DATA_PATH = path.join(__dirname,'data','store.json');
const TABLES=['products','orders','payments','carts','cart_events','bookings','service_requests'];
const ensureStore = () => {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    const seed = Object.fromEntries(TABLES.map(t => [t, []]));
    fs.writeFileSync(DATA_PATH, JSON.stringify(seed, null, 2));
  }
};
const readStore = () => {
  try { ensureStore(); return JSON.parse(fs.readFileSync(DATA_PATH,'utf8')); }
  catch { ensureStore(); return Object.fromEntries(TABLES.map(t => [t, []])); }
};
const writeStore = (store) => {
  ensureStore();
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
};
const localGet = async (t, id) => {
  const store = readStore();
  const rows = store[t] || [];
  const row = rows.find(r => r.id === String(id));
  return row ? row.data : undefined;
};
const localPut = async (t, id, d) => {
  const store = readStore();
  const rows = store[t] || [];
  const entry = { id: String(id), data: d, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const idx = rows.findIndex(r => r.id === String(id));
  if (idx >= 0) rows[idx] = entry; else rows.push(entry);
  store[t] = rows;
  writeStore(store);
};
const localList = async (t, n = 1000) => {
  const rows = (readStore()[t] || []).slice(0, n);
  return rows.map(r => r.data);
};
const localDelete = async (t, id) => {
  const store = readStore();
  store[t] = (store[t] || []).filter(r => r.id !== String(id));
  writeStore(store);
};
const app=express();app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));app.use(cors({origin:E.ALLOWED_ORIGIN||true}));app.use(express.json({limit:'15mb'}));
app.use('/api',rateLimit({windowMs:60000,max:180}));
const h=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({error:e.message||'Server error'})});
const get=async(t,id)=>{if(!hasServiceRole && !shouldUseLocalFallback)return undefined; if(!hasServiceRole){return localGet(t,id)};const {data,error}=await sb.from(t).select('data').eq('id',id).maybeSingle();if(error)throw error;return data&&data.data};
const put=async(t,id,d)=>{if(!hasServiceRole){await localPut(t,id,d);return;}const {error}=await sb.from(t).upsert({id,data:d,updated_at:new Date().toISOString()});if(error)throw error};
const list=async(t,n=1000)=>{if(!hasServiceRole)return localList(t,n);const {data,error}=await sb.from(t).select('data').order('created_at',{ascending:false}).limit(n);if(error)throw error;return data.map(r=>r.data)};
const del=async(t,id)=>{if(!hasServiceRole){await localDelete(t,id);return;}const {error}=await sb.from(t).delete().eq('id',id);if(error)throw error};
const admin=(q,s,n)=>{const k=Buffer.from(q.get('x-admin-key')||''),a=Buffer.from(E.ADMIN_PASSWORD||'');if(a.length&&k.length===a.length&&crypto.timingSafeEqual(k,a))return n();s.status(401).json({error:'Wrong admin password'})};
const pub=o=>{const {checkoutId,ppOrderId,...r}=o;return r};

/* ---------- Public: catalogue, logging, bookings ---------- */
app.get('/api/products',h(async(q,s)=>s.json((await list('products')).filter(p=>p.status!=='draft'))));
app.post('/api/log/:table',h(async(q,s)=>{if(!['carts','cart_events','service_requests'].includes(q.params.table))return s.status(404).json({error:'Unknown table'});const {id,data}=q.body;if(!id||!data)return s.status(400).json({error:'Bad request'});await put(q.params.table,String(id).slice(0,60),data);s.json({ok:1})}));
app.post('/api/booking',h(async(q,s)=>{const k=['name','phone','email','service','date','size','budget','note','files'],b={};k.forEach(x=>b[x]=q.body[x]??'');if(!b.name||!b.phone)return s.status(400).json({error:'Name and phone required'});b.ref='BK-'+crypto.randomBytes(3).toString('hex').toUpperCase();b.status='Pending';b.created=Date.now();await put('bookings',b.ref,b);s.json({ref:b.ref})}));
app.get('/api/booking/:ref',h(async(q,s)=>{const b=await get('bookings',q.params.ref);if(!b)return s.status(404).json({error:'Not found'});s.json({ref:b.ref,service:b.service,status:b.status})}));

/* ---------- Checkout (server computes the price; the browser is never trusted) ---------- */
const norm=p=>{p=String(p||'').replace(/\D/g,'');if(/^0[17]\d{8}$/.test(p))p='254'+p.slice(1);return /^254[17]\d{8}$/.test(p)?p:null};
app.post('/api/checkout',h(async(q,s)=>{
  const {customer:c={},method,items=[],code}=q.body;
  if(!['mpesa','paypal'].includes(method)||!items.length||!c.name||!c.addr)return s.status(400).json({error:'Missing checkout details'});
  const prods=await list('products'),lines=[];
  for(const i of items){const p=prods.find(x=>x.id===i.id),n=Math.floor(+i.q);if(!p||p.status!=='published'||!(n>=1)||n>p.stock)return s.status(400).json({error:(p?p.name:'An item')+' is no longer available'});lines.push({id:p.id,name:p.name,price:p.price,q:n})}
  const sub=lines.reduce((t,l)=>t+l.price*l.q,0),ship=sub>=20000?0:500,d=String(code||'').toUpperCase()==='DEKO10'?0.1:0,total=Math.round(sub*(1-d)+ship);
  const id='DAG-'+crypto.randomBytes(5).toString('hex').toUpperCase();
  const o={id,date:Date.now(),name:c.name,phone:c.phone||'',email:c.email||'',addr:c.addr,method,total,status:'Pending',items:lines};
  if(method==='mpesa'){const ph=norm(c.phone);if(!ph)return s.status(400).json({error:'Enter a valid Safaricom number'});const r=await stkPush(ph,total,id);o.checkoutId=r.CheckoutRequestID;await put('orders',id,o);return s.json({orderId:id})}
  const r=await ppCreate(o);o.ppOrderId=r.id;o.usd=r.usd;await put('orders',id,o);s.json({orderId:id,approveUrl:r.approveUrl});
}));
app.get('/api/order/:id',h(async(q,s)=>{const o=await get('orders',q.params.id);if(!o)return s.status(404).json({error:'Order not found'});s.json(pub(o))}));

async function markPaid(o,ref){
  if(['Paid','Processing','Shipped','Delivered'].includes(o.status))return;   // prevents duplicate processing
  o.status='Paid';o.ref=ref;o.paidAt=Date.now();await put('orders',o.id,o);
  await put('payments',ref,{ref,orderId:o.id,method:o.method,amount:o.total,at:Date.now()});
  for(const i of o.items){const p=await get('products',i.id);if(p){p.stock=Math.max(0,(p.stock||0)-i.q);if(p.stock<1)p.status='sold';await put('products',p.id,p)}}
}

/* ---------- M-Pesa Daraja ---------- */
const DJ=E.MPESA_ENV==='production'?'https://api.safaricom.co.ke':'https://sandbox.safaricom.co.ke';
async function mpesaToken(){const r=await fetch(DJ+'/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+Buffer.from(E.MPESA_CONSUMER_KEY+':'+E.MPESA_CONSUMER_SECRET).toString('base64')}});const j=await r.json().catch(()=>({}));if(!j.access_token)throw new Error('M-Pesa authentication failed');return j.access_token}
async function stkPush(phone,amount,ref){
  const ts=new Date().toISOString().replace(/\D/g,'').slice(0,14),pw=Buffer.from(E.MPESA_SHORTCODE+E.MPESA_PASSKEY+ts).toString('base64');
  const r=await fetch(DJ+'/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:'Bearer '+await mpesaToken(),'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:E.MPESA_SHORTCODE,Password:pw,Timestamp:ts,TransactionType:E.MPESA_TXN_TYPE||'CustomerPayBillOnline',Amount:amount,PartyA:phone,PartyB:E.MPESA_SHORTCODE,PhoneNumber:phone,CallBackURL:E.PUBLIC_URL+'/api/mpesa/callback/'+E.MPESA_CALLBACK_SECRET,AccountReference:ref,TransactionDesc:'Deko Arts '+ref})});
  const j=await r.json().catch(()=>({}));if(j.ResponseCode!=='0')throw new Error(j.errorMessage||j.ResponseDescription||'Could not start M-Pesa payment');return j}
app.post('/api/mpesa/callback/:secret',h(async(q,s)=>{
  if(q.params.secret!==E.MPESA_CALLBACK_SECRET)return s.status(403).end();
  const cb=q.body&&q.body.Body&&q.body.Body.stkCallback;if(!cb)return s.json({ResultCode:0,ResultDesc:'ok'});
  const {data}=await sb.from('orders').select('data').eq('data->>checkoutId',cb.CheckoutRequestID).maybeSingle();const o=data&&data.data;
  if(o){
    if(cb.ResultCode===0){const m=Object.fromEntries((cb.CallbackMetadata?.Item||[]).map(i=>[i.Name,i.Value]));
      if(+m.Amount>=o.total)await markPaid(o,String(m.MpesaReceiptNumber));else{o.status='Failed';o.failReason='Amount paid was less than the order total';await put('orders',o.id,o)}}
    else if(o.status==='Pending'){o.status='Failed';o.failReason=cb.ResultDesc;await put('orders',o.id,o)}
  }
  s.json({ResultCode:0,ResultDesc:'Accepted'});
}));

/* ---------- PayPal Orders API (charged in USD) ---------- */
const PP=E.PAYPAL_ENV==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
async function ppToken(){const r=await fetch(PP+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(E.PAYPAL_CLIENT_ID+':'+E.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});const j=await r.json().catch(()=>({}));if(!j.access_token)throw new Error('PayPal authentication failed');return j.access_token}
async function ppCreate(o){
  const usd=(o.total/(+E.KES_PER_USD||129)).toFixed(2);
  const r=await fetch(PP+'/v2/checkout/orders',{method:'POST',headers:{Authorization:'Bearer '+await ppToken(),'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:o.id,custom_id:o.id,description:'Deko Arts order '+o.id,amount:{currency_code:'USD',value:usd}}],payment_source:{paypal:{experience_context:{return_url:E.PUBLIC_URL+'/?paypal_return=1&order='+o.id,cancel_url:E.PUBLIC_URL+'/?paypal_cancel=1',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING'}}}})});
  const j=await r.json().catch(()=>({})),l=(j.links||[]).find(x=>['payer-action','approve'].includes(x.rel));if(!l)throw new Error(j.message||'Could not start PayPal payment');return {id:j.id,usd,approveUrl:l.href}}
app.post('/api/paypal/capture',h(async(q,s)=>{
  const o=await get('orders',String(q.body.orderId||''));if(!o||o.method!=='paypal'||o.ppOrderId!==q.body.token)return s.status(400).json({error:'Invalid PayPal return'});
  if(o.status==='Paid')return s.json(pub(o));
  const r=await fetch(PP+'/v2/checkout/orders/'+o.ppOrderId+'/capture',{method:'POST',headers:{Authorization:'Bearer '+await ppToken(),'Content-Type':'application/json'}});const j=await r.json().catch(()=>({}));
  const cap=j.purchase_units?.[0]?.payments?.captures?.[0];
  if(j.status!=='COMPLETED'||!cap||cap.amount.value!==o.usd||cap.status!=='COMPLETED')return s.status(402).json({error:'PayPal payment was not completed'});
  await markPaid(o,cap.id);s.json(pub(o));
}));

/* ---------- Admin (x-admin-key header) ---------- */
app.get('/api/admin/data',admin,h(async(q,s)=>{const [products,orders,bookings,carts,events]=await Promise.all(['products','orders','bookings','carts','cart_events'].map(t=>list(t)));s.json({products,orders,bookings,carts,events})}));
app.put('/api/admin/products/:id',admin,h(async(q,s)=>{const p={...q.body,id:q.params.id};await put('products',p.id,p);s.json({ok:1})}));
app.delete('/api/admin/products/:id',admin,h(async(q,s)=>{await del('products',q.params.id);s.json({ok:1})}));
app.post('/api/admin/statuses',admin,h(async(q,s)=>{
  for(const x of q.body.orders||[]){const o=await get('orders',x.id);if(o){o.status=x.status;await put('orders',o.id,o)}}
  for(const x of q.body.bookings||[]){const b=await get('bookings',x.ref);if(b){b.status=x.status;await put('bookings',b.ref,b)}}
  s.json({ok:1})}));

app.use('/api',(q,s)=>s.status(404).json({error:'Not found'}));
app.get('/admin',(q,s)=>s.sendFile(path.join(__dirname,'public','index.html')));
app.use(express.static(path.join(__dirname,'public')));
if (require.main === module) {
  const PORT = Number(E.PORT || 3001);
  app.listen(PORT,()=>console.log('Deko Arts Gallery running on port '+PORT));
}
module.exports = app;

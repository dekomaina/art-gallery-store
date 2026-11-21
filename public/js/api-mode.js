/* Connects the UI to the backend (server.js). No secrets live here. */
(function () {
  'use strict';
  const API = {
    adminKey: () => { try { return sessionStorage.getItem('dag_admin') || ''; } catch { return ''; } },
    async req(method, url, body, admin) {
      const headers = { 'Content-Type': 'application/json' };
      if (admin) headers['x-admin-key'] = API.adminKey();
      const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = new Error(j.error || 'Request failed (' + r.status + ')');
        e.status = r.status;
        throw e;
      }
      return j;
    },
    products: () => API.req('GET', '/api/products'),
    log: (table, id, data) => API.req('POST', '/api/log/' + table, { id, data }).catch(() => {}),
    booking: (b) => API.req('POST', '/api/booking', b),
    bookingStatus: (ref) => API.req('GET', '/api/booking/' + encodeURIComponent(ref)),
    checkout: (p) => API.req('POST', '/api/checkout', p),
    order: (id) => API.req('GET', '/api/order/' + encodeURIComponent(id)),
    paypalCapture: (orderId, token) => API.req('POST', '/api/paypal/capture', { orderId, token }),
    admin: {
      data: () => API.req('GET', '/api/admin/data', null, true),
      saveProduct: (p) => API.req('PUT', '/api/admin/products/' + encodeURIComponent(p.id), p, true),
      deleteProduct: (id) => API.req('DELETE', '/api/admin/products/' + encodeURIComponent(id), null, true),
      statuses: (orders, bookings) => API.req('POST', '/api/admin/statuses', { orders, bookings }, true)
    }
  };
  window.API = API;
})();

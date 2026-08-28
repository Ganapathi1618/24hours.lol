/**
 * Stand-in for PostgREST + Dodo, just faithful enough to run the real app
 * against: filters, Prefer headers, unique violations and payment links.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const db = {
  hours: [
    { id: 'h-9', hour_number: 9, current_bid: '50.00', bid_count: 0, brand_name: null, brand_tagline: null, brand_url: null, brand_logo_url: null, winner_email: null, status: 'open', auction_end_time: null, campaign_days: 30, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
    { id: 'h-12', hour_number: 12, current_bid: '40.00', bid_count: 0, brand_name: null, brand_tagline: null, brand_url: null, brand_logo_url: null, winner_email: null, status: 'open', auction_end_time: null, campaign_days: 30, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
    { id: 'h-0', hour_number: 0, current_bid: '10.00', bid_count: 0, brand_name: null, brand_tagline: null, brand_url: null, brand_logo_url: null, winner_email: null, status: 'open', auction_end_time: null, campaign_days: 30, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
  ],
  bids: [],
};

let seq = 0;
const nextId = (prefix) => `${prefix}-${++seq}`;

function looseEqual(a, b) {
  if (a === null || a === undefined) return b === 'null';
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && String(b).trim() !== '') return na === nb;
  return String(a) === String(b);
}

function applyFilters(rows, params) {
  return rows.filter((row) =>
    [...params.entries()].every(([key, raw]) => {
      if (['select', 'order', 'limit', 'offset'].includes(key)) return true;
      const [op, ...rest] = raw.split('.');
      const value = rest.join('.');
      switch (op) {
        case 'eq': return looseEqual(row[key], value);
        case 'neq': return !looseEqual(row[key], value);
        case 'in': return value.replace(/^\(|\)$/g, '').split(',').some((v) => looseEqual(row[key], v.replace(/^"|"$/g, '')));
        case 'lt': return Number(row[key]) < Number(value);
        case 'gt': return Number(row[key]) > Number(value);
        default: return true;
      }
    }),
  );
}

function send(res, status, body, headers = {}) {
  const payload = body === null ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;

    // ---- Dodo ----
    if (url.pathname === '/payments' && req.method === 'POST') {
      const paymentId = nextId('pay');
      server.emit('dodo:payment', { paymentId, body });
      return send(res, 200, { payment_id: paymentId, payment_link: `https://checkout.test/${paymentId}` });
    }
    if (url.pathname === '/refunds' && req.method === 'POST') {
      server.emit('dodo:refund', body);
      return send(res, 200, { refund_id: nextId('ref'), status: 'succeeded' });
    }

    // ---- Datafast ----
    if (url.pathname === '/analytics/realtime') {
      return send(res, 200, { live: 12 });
    }
    if (url.pathname === '/analytics/overview') {
      return send(res, 200, {
        visitors: 48210,
        pageviews: 91500,
        countries: [
          { name: 'United States', visitors: 21000 },
          { name: 'India', visitors: 9400 },
          { name: 'Germany', visitors: 4100 },
        ],
        hourly: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          pageviews: 2000 + Math.round(Math.sin(hour / 3) * 1500 + hour * 40),
        })),
      });
    }

    // ---- PostgREST ----
    const match = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!match) return send(res, 404, { message: 'not found' });

    const table = match[1];
    const rows = db[table];
    if (!rows) return send(res, 404, { message: 'no such table' });

    const prefer = req.headers.prefer ?? '';
    const wantsObject = String(req.headers.accept ?? '').includes('vnd.pgrst.object+json');
    const wantsRepresentation = prefer.includes('return=representation');

    if (req.method === 'GET') {
      let result = applyFilters(rows, url.searchParams).map((row) => ({ ...row }));
      const order = url.searchParams.get('order');
      if (order) {
        const [column, direction] = order.split('.');
        result.sort((a, b) => (Number(a[column]) - Number(b[column])) * (direction === 'desc' ? -1 : 1));
      }
      const limit = url.searchParams.get('limit');
      if (limit) result = result.slice(0, Number(limit));

      if (wantsObject) {
        if (result.length === 0) {
          return send(res, 406, { code: 'PGRST116', message: 'no rows', details: '0 rows' });
        }
        return send(res, 200, result[0]);
      }
      return send(res, 200, result);
    }

    if (req.method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body];
      const created = [];
      for (const item of incoming) {
        if (table === 'hours' && rows.some((row) => Number(row.hour_number) === Number(item.hour_number))) {
          return send(res, 409, {
            code: '23505',
            message: 'duplicate key value violates unique constraint "hours_hour_number_key"',
          });
        }
        const row = {
          id: nextId(table),
          current_bid: 0, bid_count: 0, status: 'open',
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          ...item,
        };
        rows.push(row);
        created.push({ ...row });
      }
      return wantsRepresentation ? send(res, 201, created) : send(res, 201, null);
    }

    if (req.method === 'PATCH') {
      const hit = applyFilters(rows, url.searchParams);
      for (const row of hit) Object.assign(row, body);
      const updated = hit.map((row) => ({ ...row }));
      return wantsRepresentation ? send(res, 200, updated) : send(res, 204, null);
    }

    return send(res, 405, { message: 'method not allowed' });
  });
});

// Minimal WebSocket handshake so the realtime client connects instead of
// spraying connection errors into the browser console during screenshots.
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
});

server.db = db;
export default server;

if (process.argv[1]?.endsWith('mock-server.mjs')) {
  server.listen(54321, () => console.log('mock listening on 54321'));
}

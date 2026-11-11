const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config();

const mock = process.argv.includes('--mock');

function createMockPrisma() {
  const { Decimal } = require('@prisma/client/runtime/client');
  const tables = Object.fromEntries(['user', 'client', 'invoice', 'invoiceItem'].map(name => [name, new Map()]));
  const matches = (row, where = {}) => Object.entries(where).every(([field, value]) =>
    value && typeof value === 'object' && Array.isArray(value.in) ? value.in.includes(row[field]) : row[field] === value);
  const find = (name, where) => [...tables[name].values()].find(row => matches(row, where));
  const missing = () => Object.assign(new Error('Missing record'), { code: 'P2025' });

  function result(name, row, { include, select } = {}) {
    if (select) return Object.fromEntries(Object.keys(select).filter(field => select[field]).map(field => [field, row[field]]));
    const output = { ...row };
    if (name === 'invoice' && include?.items) {
      output.items = [...tables.invoiceItem.values()].filter(item => item.invoiceId === row.id)
        .map(item => ({ ...item, quantity: new Decimal(item.quantity), unitPrice: new Decimal(item.unitPrice) }));
    }
    return output;
  }

  function remove(name, row) {
    if (name === 'invoice') {
      for (const item of tables.invoiceItem.values()) if (item.invoiceId === row.id) tables.invoiceItem.delete(item.id);
    }
    if (name === 'user') {
      for (const invoice of tables.invoice.values()) if (invoice.userId === row.id) remove('invoice', invoice);
      for (const client of tables.client.values()) if (client.userId === row.id) remove('client', client);
    }
    tables[name].delete(row.id);
  }

  function checkNumber(data, excludeId) {
    if ([...tables.invoice.values()].some(row => row.id !== excludeId && row.userId === data.userId && row.invoiceNumber === data.invoiceNumber)) {
      throw Object.assign(new Error('Duplicate invoice number'), { code: 'P2002' });
    }
  }

  function storeItems(invoiceId, items) {
    for (const data of items) {
      const item = { id: randomUUID(), invoiceId, quantity: '1', ...data };
      tables.invoiceItem.set(item.id, item);
    }
  }

  const prisma = Object.fromEntries(Object.keys(tables).map(name => [name, {
    create: async ({ data, ...options }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...data };
      tables[name].set(row.id, row);
      return result(name, row, options);
    },
    findFirst: async ({ where, ...options }) => {
      const row = find(name, where);
      return row ? result(name, row, options) : null;
    },
    findMany: async ({ where, orderBy = [], ...options } = {}) => [...tables[name].values()].filter(row => matches(row, where))
      .sort((a, b) => {
        for (const order of orderBy) {
          const [field, direction] = Object.entries(order)[0];
          if (a[field] < b[field]) return direction === 'desc' ? 1 : -1;
          if (a[field] > b[field]) return direction === 'desc' ? -1 : 1;
        }
        return 0;
      }).map(row => result(name, row, options)),
    count: async ({ where } = {}) => [...tables[name].values()].filter(row => matches(row, where)).length,
    deleteMany: async ({ where } = {}) => {
      const rows = [...tables[name].values()].filter(row => matches(row, where));
      rows.forEach(row => remove(name, row));
      return { count: rows.length };
    },
  }]));

  prisma.invoice.create = async ({ data, ...options }) => {
    const { items, ...fields } = data;
    checkNumber(fields);
    const row = { id: randomUUID(), createdAt: new Date(), status: 'DRAFT', issueDate: new Date(new Date().setUTCHours(0, 0, 0, 0)), dueDate: null, ...fields };
    tables.invoice.set(row.id, row);
    storeItems(row.id, items.create);
    return result('invoice', row, options);
  };
  prisma.invoice.update = async ({ where, data, ...options }) => {
    const row = find('invoice', where);
    if (!row) throw missing();
    const { items, ...fields } = data;
    checkNumber({ ...row, ...fields }, row.id);
    if (items) {
      for (const item of tables.invoiceItem.values()) if (item.invoiceId === row.id) tables.invoiceItem.delete(item.id);
      storeItems(row.id, items.create);
    }
    Object.assign(row, fields);
    return result('invoice', row, options);
  };
  prisma.invoice.delete = async ({ where }) => {
    const row = find('invoice', where);
    if (!row) throw missing();
    remove('invoice', row);
    return { ...row };
  };
  prisma.$disconnect = async () => {};
  return prisma;
}

if (mock) {
  // Vetem ruajtja simulohet; perdoret aplikacioni i plote Express dhe JWT reale.
  require.cache[require.resolve('../src/config/database')] = { exports: createMockPrisma() };
  process.env.JWT_SECRET = randomUUID();
}

async function main() {
  assert(mock || process.env.DATABASE_URL, 'Konfiguro DATABASE_URL ne backend/.env per databaze reale');
  assert(process.env.JWT_SECRET, 'Konfiguro JWT_SECRET ne backend/.env');
  const jwt = require('jsonwebtoken');
  const prisma = require('../src/config/database');
  const app = require('../src/app');
  const userIds = [];
  const invoiceIds = new Set();
  let server;
  let checks = 0;
  try {
    const users = [];
    const clients = [];
    for (const name of ['A', 'B']) {
      const id = randomUUID();
      userIds.push(id);
      users.push(await prisma.user.create({ data: {
        id, name: `Invoice API ${name}`, email: `invoice-${randomUUID()}@example.test`, passwordHash: 'unused-test-hash',
      } }));
      clients.push(await prisma.client.create({ data: { userId: id, name: `Invoice client ${name}` } }));
    }
    const [a, b] = users.map(user => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/invoices`;
    async function request(method, path, token, body, status, field) {
      const response = await fetch(base + path, {
        method, signal: AbortSignal.timeout(15000),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      // Gjithmone ndiq rekordin e krijuar, edhe nese nje assert pasues deshton.
      if (method === 'POST' && result.data?.invoice?.id) invoiceIds.add(result.data.invoice.id);
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
      assert.equal(result.success, status < 400);
      if (field) assert(result.errors?.some(error => error.field === field && error.message), JSON.stringify(result));
      checks++;
      return result;
    }
    const payload = {
      clientId: clients[0].id, invoiceNumber: `S12-${randomUUID()}`, issueDate: '2026-11-10', dueDate: '2026-11-30',
      items: [{ description: 'Sherbim A', quantity: '2.500', unitPrice: '12.34' }, { description: 'Sherbim B', quantity: 3, unitPrice: '0.10' }],
    };
    const first = (await request('POST', '/', a, { ...payload, userId: users[1].id, total: '999.99' }, 201)).data.invoice;
    const second = (await request('POST', '/', a, {
      ...payload, invoiceNumber: `S12-${randomUUID()}`, issueDate: '2026-11-11', items: [{ description: 'Sasi e parazgjedhur', unitPrice: '0.10' }],
    }, 201)).data.invoice;
    const foreign = (await request('POST', '/', b, { ...payload, clientId: clients[1].id }, 201)).data.invoice;
    assert.equal(first.userId, users[0].id);
    assert.equal(first.total, '31.15');
    assert.equal(first.status, 'DRAFT');
    assert.equal(first.items.length, 2);
    assert(first.items.every(item => item.invoiceId === first.id));
    assert.equal(second.total, '0.10');
    assert.equal(Number(second.items[0].quantity), 1);
    assert.equal(foreign.userId, users[1].id);
    if (process.argv.includes('--fail-after-setup')) throw new Error('Deshtim i qellimshem per te verifikuar pastrimin');

    async function list(token, expected, query = '/') {
      const result = await request('GET', query, token, undefined, 200);
      assert.deepEqual(result.data.map(invoice => invoice.id), expected);
      assert(result.data.every(invoice => typeof invoice.total === 'string'));
      return result.data;
    }
    const listed = await list(a, [second.id, first.id]);
    assert.equal(listed[1].total, '31.15');
    await list(b, [foreign.id]);
    await list(a, [second.id, first.id], `/?userId=${users[1].id}`);
    assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice.total, '31.15');
    console.log('PASS Krijimi me artikuj, totali ne server, lista e izoluar dhe GET sipas ID-se');

    for (const [token, id] of [[a, foreign.id], [b, first.id], [a, randomUUID()]]) {
      await request('GET', `/${id}`, token, undefined, 404);
      await request('PUT', `/${id}`, token, { status: 'CANCELLED' }, 404);
      await request('DELETE', `/${id}`, token, undefined, 404);
    }
    const before = (await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice;
    await request('POST', '/', a, { ...payload, invoiceNumber: `S12-${randomUUID()}`, clientId: clients[1].id }, 400);
    await request('PUT', `/${first.id}`, a, { clientId: clients[1].id, items: [{ description: 'Blocked', quantity: 9, unitPrice: 9 }] }, 400);
    const unchanged = (await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice;
    assert.equal(unchanged.clientId, before.clientId);
    assert.equal(unchanged.total, before.total);
    assert.deepEqual(unchanged.items.map(item => item.id).sort(), before.items.map(item => item.id).sort());
    await request('POST', '/', a, payload, 409);
    assert.equal(await prisma.invoice.count({ where: { userId: users[0].id } }), 2);
    console.log('PASS GET/PUT/DELETE te huaja: 404; klient i huaj: 400; numer i dyfishte per perdorues: 409');

    const oldItemIds = first.items.map(item => item.id);
    const updated = (await request('PUT', `/${first.id}`, a, {
      invoiceNumber: `S12-${randomUUID()}`, userId: users[1].id, total: '999.99',
      items: [{ description: 'Artikull i ri', quantity: '1.125', unitPrice: '1.20' }],
    }, 200)).data.invoice;
    assert.equal(updated.userId, users[0].id);
    assert.equal(updated.total, '1.35');
    assert.equal(updated.items.length, 1);
    assert.equal(updated.items[0].description, 'Artikull i ri');
    assert.equal(await prisma.invoiceItem.count({ where: { id: { in: oldItemIds } } }), 0);
    assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice.total, '1.35');
    for (const status of ['SENT', 'PAID']) {
      assert.equal((await request('PUT', `/${first.id}`, a, { status }, 200)).data.invoice.status, status);
      assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice.status, status);
    }
    for (const status of ['DRAFT', 'CANCELLED']) {
      const rejected = await request('PUT', `/${first.id}`, a, { status, items: payload.items }, 400, 'status');
      assert(rejected.message.includes('PAID') && rejected.message.includes(status));
    }
    const stillPaid = (await request('GET', `/${first.id}`, a, undefined, 200)).data.invoice;
    assert.equal(stillPaid.status, 'PAID');
    assert.equal(stillPaid.total, '1.35');
    assert.equal(stillPaid.items[0].id, updated.items[0].id);
    for (const status of ['SENT', 'OVERDUE', 'CANCELLED']) {
      assert.equal((await request('PUT', `/${second.id}`, a, { status }, 200)).data.invoice.status, status);
    }
    await request('PUT', `/${second.id}`, a, { status: 'SENT' }, 400, 'status');
    console.log('PASS Zevendesimi i artikujve, totali i rillogaritur dhe kalimet e lejuara/palejuara te statusit');

    for (const [field, value, errorField] of [
      ['items', [], 'items'], ['dueDate', '2026-11-09', 'dueDate'], ['clientId', null, 'clientId'], ['invoiceNumber', ' ', 'invoiceNumber'],
      ['items', [{ description: 'Zero quantity', quantity: 0, unitPrice: 1 }], 'items[0].quantity'],
      ['items', [{ description: 'Zero price', quantity: 1, unitPrice: 0 }], 'items[0].unitPrice'],
    ]) {
      for (const method of ['POST', 'PUT']) await request(method, method === 'POST' ? '/' : `/${first.id}`, a, { ...payload, [field]: value }, 400, errorField);
    }
    for (const [method, path] of [['GET', '/'], ['POST', '/'], ['GET', `/${first.id}`], ['PUT', `/${first.id}`], ['DELETE', `/${first.id}`]]) {
      await request(method, path, undefined, undefined, 401);
    }
    await request('GET', '/', 'invalid-token', undefined, 401);
    await request('DELETE', `/${first.id}`, a, undefined, 200);
    assert.equal(await prisma.invoice.count({ where: { id: first.id } }), 0);
    assert.equal(await prisma.invoiceItem.count({ where: { invoiceId: first.id } }), 0);
    for (const method of ['GET', 'PUT', 'DELETE']) await request(method, `/${first.id}`, a, method === 'PUT' ? { status: 'PAID' } : undefined, 404);
    await list(a, [second.id]);
    console.log(`PASS Validimi, JWT, fshirja me cascade dhe 404 pas fshirjes (${checks} kerkesa HTTP)`);
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
    } finally {
      try {
        // Kufizo cdo operacion vetem te UUID-te e krijuara nga ky ekzekutim.
        const owned = { userId: { in: userIds } };
        for (const invoice of await prisma.invoice.findMany({ where: owned, select: { id: true } })) invoiceIds.add(invoice.id);
        await prisma.invoice.deleteMany({ where: owned });
        await prisma.client.deleteMany({ where: owned });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        assert.equal(await prisma.invoiceItem.count({ where: { invoiceId: { in: [...invoiceIds] } } }), 0, 'Cleanup invoice items');
        assert.equal(await prisma.invoice.count({ where: owned }), 0, 'Cleanup invoices');
        assert.equal(await prisma.client.count({ where: owned }), 0, 'Cleanup clients');
        assert.equal(await prisma.user.count({ where: { id: { in: userIds } } }), 0, 'Cleanup users');
        console.log('PASS Pastrimi: asnje perdorues, klient, fature ose artikull i perkohshem nuk mbeti');
      } finally { await prisma.$disconnect(); }
    }
  }
  console.log(mock ? 'MODE: --mock; databaza reale NUK eshte verifikuar' : 'MODE: databaze reale; te gjitha kontrollet kaluan');
}

main().catch(error => { console.error('VERIFIKIMI DESHTOI:', error.message); process.exitCode = 1; });

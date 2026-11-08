const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config();

const mock = process.argv.includes('--mock');
if (mock) {
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (value.in) return value.in.includes(row[key]);
      return (!value.gte || row[key] >= value.gte) && (!value.lt || row[key] < value.lt);
    }
    return row[key] === value;
  });
  const model = () => {
    const rows = new Map();
    const find = where => [...rows.values()].find(row => matches(row, where));
    return {
      create: async ({ data }) => {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        rows.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }) => find(where) || null,
      findMany: async ({ where, orderBy = [] }) => [...rows.values()].filter(row => matches(row, where))
        .sort((a, b) => {
          for (const order of orderBy) {
            const [field, direction] = Object.entries(order)[0];
            if (a[field] < b[field]) return direction === 'desc' ? 1 : -1;
            if (a[field] > b[field]) return direction === 'desc' ? -1 : 1;
          }
          return 0;
        }),
      update: async ({ where, data }) => {
        const row = find(where);
        if (!row) throw Object.assign(new Error('Missing'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }) => {
        const row = find(where);
        if (!row) throw Object.assign(new Error('Missing'), { code: 'P2025' });
        rows.delete(row.id);
        return row;
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [id, row] of rows) if (matches(row, where)) { rows.delete(id); count++; }
        return { count };
      },
      count: async ({ where }) => [...rows.values()].filter(row => matches(row, where)).length,
    };
  };
  const prisma = Object.fromEntries(['user', 'category', 'client', 'supplier', 'transaction'].map(name => [name, model()]));
  prisma.$disconnect = async () => {};
  require.cache[require.resolve('../src/config/database')] = { exports: prisma };
  process.env.JWT_SECRET = randomUUID();
}

async function main() {
  assert(mock || process.env.DATABASE_URL, 'Konfiguro DATABASE_URL ne backend/.env per databaze reale');
  assert(process.env.JWT_SECRET, 'Konfiguro JWT_SECRET ne backend/.env');
  const jwt = require('jsonwebtoken');
  const prisma = require('../src/config/database');
  const app = require('../src/app');
  const users = [];
  let server;
  let checks = 0;
  try {
    for (const name of ['A', 'B']) {
      users.push(await prisma.user.create({ data: {
        name: `Transaction API ${name}`, email: `transaction-${randomUUID()}@example.test`, passwordHash: 'unused-test-hash',
      } }));
    }
    const [a, b] = users.map(user => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }));
    const categories = [];
    for (const user of users) {
      categories.push(await prisma.category.create({ data: { userId: user.id, name: 'Income', type: 'INCOME' } }));
    }
    const expense = await prisma.category.create({ data: { userId: users[0].id, name: 'Expense', type: 'EXPENSE' } });
    const client = await prisma.client.create({ data: { userId: users[0].id, name: 'Test client' } });
    const supplier = await prisma.supplier.create({ data: { userId: users[0].id, name: 'Test supplier' } });
    if (process.argv.includes('--fail-after-setup')) throw new Error('Intentional failure to verify cleanup');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/transactions`;
    async function request(method, path, token, body, status, field) {
      const response = await fetch(base + path, {
        method, signal: AbortSignal.timeout(15000),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
      assert.equal(result.success, status < 400);
      if (field) assert(result.errors.some(error => error.field === field && error.message));
      checks++;
      return result;
    }
    const payload = { amount: '12.50', type: 'INCOME', categoryId: categories[0].id, occurredAt: '2026-11-02T00:00:00Z', clientId: client.id };
    const first = (await request('POST', '/', a, { ...payload, userId: users[1].id }, 201)).data.transaction;
    const second = (await request('POST', '/', a, { amount: 25, type: 'EXPENSE', categoryId: expense.id, supplierId: supplier.id, occurredAt: '2026-11-04T23:59:59.999Z' }, 201)).data.transaction;
    const foreign = (await request('POST', '/', b, { ...payload, categoryId: categories[1].id, clientId: null }, 201)).data.transaction;
    assert.equal(first.userId, users[0].id);
    assert.equal(Number(first.amount), 12.5);
    assert.equal(first.clientId, client.id);
    assert.equal(second.supplierId, supplier.id);
    async function list(query, token, expected) {
      const result = await request('GET', query, token, undefined, 200);
      assert.deepEqual(result.data.map(row => row.id), expected);
    }
    await list('/', a, [second.id, first.id]);
    await list('/', b, [foreign.id]);
    await list('/?type=INCOME', a, [first.id]);
    await list('/?type=EXPENSE', a, [second.id]);
    await list(`/?categoryId=${expense.id}`, a, [second.id]);
    await list('/?dateFrom=2026-11-02&dateTo=2026-11-04', a, [second.id, first.id]);
    await list('/?dateFrom=2026-11-04&dateTo=2026-11-04', a, [second.id]);
    await list('/?dateFrom=2026-11-05', a, []);
    await list('/?dateTo=2026-11-02', a, [first.id]);
    await list(`/?type=INCOME&categoryId=${categories[0].id}&dateFrom=2026-11-02&dateTo=2026-11-02`, a, [first.id]);
    await list(`/?userId=${users[1].id}`, a, [second.id, first.id]);
    assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.transaction.id, first.id);
    console.log('PASS Krijimi, leximi, lista, filtrat dhe renditja');

    for (const [token, id] of [[a, foreign.id], [b, first.id], [a, randomUUID()]]) {
      await request('GET', `/${id}`, token, undefined, 404);
      await request('PUT', `/${id}`, token, { amount: 99 }, 404);
      await request('DELETE', `/${id}`, token, undefined, 404);
    }
    await request('POST', '/', a, { ...payload, categoryId: categories[1].id }, 400);
    await request('POST', '/', b, { ...payload, categoryId: categories[1].id }, 400);
    await request('POST', '/', b, { ...payload, categoryId: categories[1].id, clientId: null, supplierId: supplier.id }, 400);
    await request('PUT', `/${first.id}`, a, { categoryId: categories[1].id }, 400);
    assert.equal(Number((await request('GET', `/${first.id}`, a, undefined, 200)).data.transaction.amount), 12.5);
    console.log('PASS Izolimi mes perdoruesve dhe referencat e huaja');

    for (const [query, field] of [['/?type=OTHER', 'type'], ['/?dateFrom=2026-02-30', 'dateFrom'], ['/?dateTo=invalid', 'dateTo'], ['/?dateFrom=2026-11-05&dateTo=2026-11-01', 'dateTo'], ['/?categoryId=bad', 'categoryId']]) {
      await request('GET', query, a, undefined, 400, field);
    }
    for (const [field, value] of [['amount', 0], ['amount', -1], ['type', 'OTHER'], ['occurredAt', '2026-02-30'], ['categoryId', null]]) {
      for (const method of ['POST', 'PUT']) await request(method, method === 'POST' ? '/' : `/${first.id}`, a, { ...payload, [field]: value }, 400, field);
    }
    for (const [method, path] of [['GET', '/'], ['POST', '/'], ['GET', `/${first.id}`], ['PUT', `/${first.id}`], ['DELETE', `/${first.id}`]]) {
      await request(method, path, undefined, undefined, 401);
    }
    await request('GET', '/', 'invalid-token', undefined, 401);
    const updated = (await request('PUT', `/${first.id}`, a, { amount: '30.25', description: 'Updated', userId: users[1].id }, 200)).data.transaction;
    assert.equal(Number(updated.amount), 30.25);
    assert.equal(updated.description, 'Updated');
    assert.equal(updated.userId, users[0].id);
    assert.equal(updated.categoryId, categories[0].id);
    assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.transaction.description, 'Updated');
    await request('DELETE', `/${first.id}`, a, undefined, 200);
    for (const method of ['GET', 'PUT', 'DELETE']) await request(method, `/${first.id}`, a, method === 'PUT' ? { amount: 10 } : undefined, 404);
    await list('/', a, [second.id]);
    console.log(`PASS Ndryshimi, fshirja, validimi dhe autentikimi (${checks} kerkesa HTTP)`);
  } finally {
    // Cleanup runs even if an assertion or fixture creation fails. Only tracked users are affected.
    try {
      if (server) await new Promise(resolve => server.close(resolve));
    } finally {
      try {
        const ids = users.map(user => user.id);
        const where = { userId: { in: ids } };
        for (const name of ['transaction', 'client', 'supplier', 'category']) await prisma[name].deleteMany({ where });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        for (const name of ['transaction', 'client', 'supplier', 'category']) assert.equal(await prisma[name].count({ where }), 0, `Cleanup ${name}`);
        assert.equal(await prisma.user.count({ where: { id: { in: ids } } }), 0, 'Cleanup users');
        console.log('PASS Pastrimi: asnje perdorues ose rekord i perkohshem nuk mbeti');
      } finally { await prisma.$disconnect(); }
    }
  }
  console.log(mock ? 'MODE: --mock; databaza reale NUK eshte verifikuar' : 'MODE: databaze reale; te gjitha kontrollet kaluan');
}

main().catch(error => { console.error('VERIFIKIMI DESHTOI:', error.message); process.exitCode = 1; });

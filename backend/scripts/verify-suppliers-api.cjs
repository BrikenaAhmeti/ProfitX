const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config();

const mock = process.argv.includes('--mock');
if (mock) {
  // Only storage is replaced; HTTP, JWT, middleware, controller and service are real.
  const rows = new Map();
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const find = where => [...rows.values()].find(row => matches(row, where));
  const prisma = { supplier: {
    create: async ({ data }) => {
      const row = { id: randomUUID(), ...data };
      rows.set(row.id, row);
      return row;
    },
    findMany: async ({ where }) => [...rows.values()].filter(row => matches(row, where)),
    findFirst: async ({ where }) => find(where) || null,
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
  } };
  require.cache[require.resolve('../src/config/database')] = { exports: prisma };
  process.env.JWT_SECRET = randomUUID();
}

async function main() {
  assert(mock || process.env.DATABASE_URL, 'Konfiguro DATABASE_URL ne backend/.env');
  assert(process.env.JWT_SECRET, 'Konfiguro JWT_SECRET ne backend/.env');
  const jwt = require('jsonwebtoken');
  const app = require('../src/app');
  const prisma = require('../src/config/database');
  const users = [];
  let server;
  try {
    for (const name of ['A', 'B']) {
      users.push(mock ? { id: randomUUID() } : await prisma.user.create({ data: {
        name: `Supplier API ${name}`, email: `${randomUUID()}@example.test`, passwordHash: 'unused-test-hash',
      } }));
    }
    const [a, b] = users.map(user => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/suppliers`;
    async function request(method, path, token, body, status) {
      const response = await fetch(base + path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
      assert.equal(result.success, status < 400);
      return result;
    }
    const first = (await request('POST', '/', a, { name: 'Supplier A', userId: users[1].id }, 201)).data.supplier;
    const second = (await request('POST', '/', b, { name: 'Supplier B' }, 201)).data.supplier;
    assert.equal(first.name, 'Supplier A');
    assert.equal(first.userId, users[0].id);
    assert.deepEqual((await request('GET', '/', a, undefined, 200)).data.map(row => row.id), [first.id]);
    assert.deepEqual((await request('GET', '/', b, undefined, 200)).data.map(row => row.id), [second.id]);
    assert.equal((await request('GET', `/${first.id}`, a, undefined, 200)).data.supplier.id, first.id);
    console.log('PASS POST 201 dhe GET vetem per perdoruesin e kycur');

    for (const [token, id] of [[a, second.id], [b, first.id], [a, randomUUID()]]) {
      await request('GET', `/${id}`, token, undefined, 404);
      await request('PUT', `/${id}`, token, { name: 'Blocked' }, 404);
      await request('DELETE', `/${id}`, token, undefined, 404);
    }
    const updated = await request('PUT', `/${first.id}`, a, { name: 'Updated', userId: users[1].id }, 200);
    assert.equal(updated.data.supplier.name, 'Updated');
    assert.equal(updated.data.supplier.userId, users[0].id);
    await request('DELETE', `/${first.id}`, a, undefined, 200);
    await request('GET', `/${first.id}`, a, undefined, 404);
    console.log('PASS PUT, DELETE dhe 404 per rekord te munguar ose te perdoruesit tjeter');

    for (const [method, path] of [['POST', '/'], ['GET', '/'], ['GET', `/${second.id}`], ['PUT', `/${second.id}`], ['DELETE', `/${second.id}`]]) {
      await request(method, path, undefined, undefined, 401);
    }
    await request('GET', '/', 'invalid-token', undefined, 401);
    for (const [method, path, token] of [['POST', '/', a], ['PUT', `/${second.id}`, b]]) {
      for (const name of ['', '   ']) {
        const result = await request(method, path, token, { name }, 400);
        assert(result.errors.some(error => error.field === 'name' && error.message === 'Emri eshte i detyrueshem.'));
      }
      const invalidEmail = await request(method, path, token, { name: 'Valid', email: 'invalid-email' }, 400);
      assert(invalidEmail.errors.some(error => error.field === 'email' && error.message === 'Email-i nuk eshte ne format te vlefshem.'));
      for (const phone of [undefined, null, '', '+383 44 123 456']) {
        const result = await request(method, path, token, {
          name: 'Valid supplier', email: `${randomUUID()}@example.test`,
          ...(phone === undefined ? {} : { phone }),
        }, method === 'POST' ? 201 : 200);
        assert.equal(result.data.supplier.name, 'Valid supplier');
        assert.equal(result.data.supplier.phone ?? null, phone || null);
      }
    }
    console.log('PASS POST/PUT: emri bosh 400 me mesazh te qarte; email i pasakte 400; te dhena te sakta dhe telefon opsional kalojne');
    for (const body of [{}, { name: '' }, { name: 12 }, { name: 'x', email: 'bad' }, { name: 'x', phone: {} }, { name: 'x', address: 5 }, { name: 'x'.repeat(151) }, null, []]) {
      await request('POST', '/', a, body, 400);
      await request('PUT', `/${second.id}`, b, body, 400);
    }
    await request('GET', '/invalid-id', a, undefined, 400);
    console.log('PASS 401 pa token dhe 400 per te dhena te pavlefshme');
    console.log(mock ? 'MODE: mocked storage; database acceptance NOT verified' : 'MODE: real database; all acceptance checks passed');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (!mock) {
      try { await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } }); }
      finally { await prisma.$disconnect(); }
    }
  }
}

main().catch(error => { console.error('VERIFIKIMI DESHTOI:', error.message); process.exitCode = 1; });

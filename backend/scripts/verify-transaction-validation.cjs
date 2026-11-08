const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const userId = randomUUID();
const categoryId = randomUUID();
const id = randomUUID();
let writes = 0;
const record = { id, userId, categoryId, amount: '10.00', type: 'INCOME' };
const prisma = {
  category: { findFirst: async ({ where }) => where.id === categoryId && where.userId === userId ? { id: categoryId } : null },
  transaction: {
    findFirst: async ({ where }) => where.id === id && where.userId === userId ? record : null,
    create: async ({ data }) => { writes++; return { id, ...data }; },
    update: async ({ data }) => { writes++; return { ...record, ...data }; },
  },
};
require.cache[require.resolve('../src/config/database')] = { exports: prisma };
process.env.JWT_SECRET = randomUUID();
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
const app = express();
app.use(express.json());
app.use('/api/transactions', require('../src/routes/transaction.routes'));
app.use(require('../src/middleware/error.middleware').errorHandler);

async function main() {
  const server = app.listen(0, '127.0.0.1');
  let checks = 0;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    async function request(method, body, status, field) {
      const before = writes;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/transactions${method === 'PUT' ? `/${id}` : ''}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify({ method, body, result }));
      if (field) {
        assert(result.errors.some(error => error.field === field && typeof error.message === 'string' && error.message.length > 0));
        assert.equal(writes, before, 'Invalid input must not reach database writes');
      } else if (status < 400) {
        assert.equal(result.success, true);
        assert.equal(result.data.transaction.userId, userId);
        assert.equal(writes, before + 1);
      }
      checks++;
    }
    const valid = { amount: '12.50', type: 'INCOME', categoryId, occurredAt: '2026-11-08T12:30:00Z' };
    for (const method of ['POST', 'PUT']) {
      for (const amount of [0, -1, '0', '-0.01', null, true, {}, 'NaN', 'Infinity', '1.234', '10000000000']) {
        await request(method, { ...valid, amount }, 400, 'amount');
      }
      for (const type of ['OTHER', '', null, 2]) await request(method, { ...valid, type }, 400, 'type');
      for (const occurredAt of ['invalid', '2026-02-30', '2025-02-29', '2026-13-01', '2026-11-08T24:00:00Z', '', null, 123, {}]) {
        await request(method, { ...valid, occurredAt }, 400, 'occurredAt');
      }
      for (const value of ['', null, 'bad-id']) await request(method, { ...valid, categoryId: value }, 400, 'categoryId');
      await request(method, { ...valid, clientId: 'bad-id' }, 400, 'clientId');
      await request(method, { ...valid, supplierId: 12 }, 400, 'supplierId');
      await request(method, { ...valid, description: 'x'.repeat(501) }, 400, 'description');
      for (const body of [null, [], 'text']) await request(method, body, 400);
      for (const occurredAt of ['2024-02-29', '2026-11-08T12:30:00+02:00']) {
        await request(method, { ...valid, occurredAt }, method === 'POST' ? 201 : 200);
      }
      await request(method, { amount: 0.01, categoryId, type: 'shpenzim' }, method === 'POST' ? 201 : 200);
      await request(method, { ...valid, amount: '9999999999.99', description: null, clientId: null, supplierId: '' }, method === 'POST' ? 201 : 200);
    }
    await request('POST', {}, 400, 'categoryId');
    await request('PUT', { amount: '20.00' }, 200);
    console.log(`PASS ${checks} HTTP checks: POST/PUT, errors[], positive amount, type, calendar dates, category and partial update.`);
    console.log('Real routes, JWT, middleware, controller and service; only Prisma storage is mocked.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

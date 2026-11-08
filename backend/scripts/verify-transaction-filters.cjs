const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const userId = randomUUID();
const otherUser = randomUUID();
const categoryId = randomUUID();
const otherCategory = randomUUID();
const row = (id, type, date, owner = userId, category = categoryId) => ({
  id, type, occurredAt: new Date(date), createdAt: new Date(date), userId: owner, categoryId: category,
});
const rows = [
  row('before', 'INCOME', '2026-11-01T23:59:59Z'),
  row('start', 'INCOME', '2026-11-02T00:00:00Z'),
  row('middle', 'EXPENSE', '2026-11-03T12:00:00Z', userId, otherCategory),
  row('end', 'INCOME', '2026-11-04T23:59:59.999Z'),
  row('after', 'EXPENSE', '2026-11-05T00:00:00Z'),
  row('foreign', 'INCOME', '2026-11-03T12:00:00Z', otherUser),
];
let queries = 0;
require.cache[require.resolve('../src/config/database')] = { exports: { transaction: {
  findMany: async ({ where, orderBy }) => {
    queries++;
    assert.equal(where.userId, userId, 'Every query must be scoped to authenticated user');
    assert.deepEqual(orderBy, [{ occurredAt: 'desc' }, { createdAt: 'desc' }]);
    return rows.filter(row => row.userId === where.userId
      && (!where.type || row.type === where.type)
      && (!where.categoryId || row.categoryId === where.categoryId)
      && (!where.occurredAt?.gte || row.occurredAt >= where.occurredAt.gte)
      && (!where.occurredAt?.lt || row.occurredAt < where.occurredAt.lt))
      .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
  },
} } };
process.env.JWT_SECRET = randomUUID();
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
const app = express();
app.use('/api/transactions', require('../src/routes/transaction.routes'));
app.use(require('../src/middleware/error.middleware').errorHandler);

async function main() {
  const server = app.listen(0, '127.0.0.1');
  let checks = 0;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    async function check(query, expected, field) {
      const before = queries;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/transactions${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      assert.equal(response.status, field ? 400 : 200, JSON.stringify({ query, body }));
      if (field) {
        assert(body.errors.some(error => error.field === field && error.message.length > 0));
        assert.equal(queries, before, 'Invalid filters must not reach database');
      } else assert.deepEqual(body.data.map(row => row.id), expected);
      checks++;
    }
    await check('', ['after', 'end', 'middle', 'start', 'before']);
    await check('?type=INCOME', ['end', 'start', 'before']);
    await check('?type=EXPENSE', ['after', 'middle']);
    await check('?type=te%20ardhura', ['end', 'start', 'before']);
    await check(`?categoryId=${otherCategory}`, ['middle']);
    await check(`?categoryId=${randomUUID()}`, []);
    await check('?dateFrom=2026-11-02&dateTo=2026-11-04', ['end', 'middle', 'start']);
    await check('?dateFrom=2026-11-04&dateTo=2026-11-04', ['end']);
    await check('?dateFrom=2026-11-04', ['after', 'end']);
    await check('?dateTo=2026-11-02', ['start', 'before']);
    await check(`?type=INCOME&categoryId=${categoryId}&dateFrom=2026-11-02&dateTo=2026-11-04`, ['end', 'start']);
    await check(`?userId=${otherUser}`, ['after', 'end', 'middle', 'start', 'before']);
    for (const field of ['dateFrom', 'dateTo']) {
      for (const value of ['', 'bad', '2026-02-30', '2025-02-29', '2026-13-01', '08-11-2026']) {
        await check(`?${field}=${value}`, null, field);
      }
      await check(`?${field}=2026-11-01&${field}=2026-11-02`, null, field);
    }
    await check('?dateFrom=2026-11-05&dateTo=2026-11-01', null, 'dateTo');
    for (const query of ['?type=OTHER', '?type=', '?type=INCOME&type=EXPENSE']) await check(query, null, 'type');
    for (const query of ['?categoryId=bad', '?categoryId=', `?categoryId=${categoryId}&categoryId=${otherCategory}`]) await check(query, null, 'categoryId');
    console.log(`PASS ${checks} HTTP checks: type, category, UTC date boundaries, ordering, isolation, invalid filters and no filters.`);
    console.log('Real JWT, route, controller and service; Prisma storage mocked.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

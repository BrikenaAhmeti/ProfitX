const { randomUUID } = require('node:crypto');
require('dotenv').config();
const mock = process.argv.includes('--mock');

if (mock) {
  const model = () => {
    const rows = new Map();
    const matchesValue = (actual, expected) => {
      if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
      if (expected && typeof expected === 'object') {
        if (expected.in) return expected.in.includes(actual);
        if (expected.gte !== undefined && actual < expected.gte) return false;
        if (expected.lt !== undefined && actual >= expected.lt) return false;
        return true;
      }
      return actual === expected;
    };
    const match = (row, where = {}) => Object.entries(where).every(([key, value]) => matchesValue(row[key], value));
    const find = where => [...rows.values()].find(row => match(row, where));
    return {
      findUnique: async ({ where }) => find(where) || null,
      findFirst: async ({ where }) => find(where) || null,
      findMany: async ({ where, orderBy = [] }) => [...rows.values()].filter(row => match(row, where))
        .sort((a, b) => {
          for (const order of orderBy) {
            const [field, direction] = Object.entries(order)[0];
            if (a[field] < b[field]) return direction === 'desc' ? 1 : -1;
            if (a[field] > b[field]) return direction === 'desc' ? -1 : 1;
          }
          return 0;
        }),
      create: async ({ data }) => {
        const row = { id: randomUUID(), createdAt: new Date(), occurredAt: new Date(), ...data };
        rows.set(row.id, row);
        return row;
      },
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
        for (const [id, row] of rows) if (match(row, where)) { rows.delete(id); count++; }
        return { count };
      },
    };
  };
  const prisma = { user: model(), client: model(), supplier: model(), category: model(), transaction: model(), $queryRaw: async () => [{ value: 1 }] };
  require.cache[require.resolve('../../src/config/database')] = { exports: prisma };
  process.env.JWT_SECRET = randomUUID();
}

async function main() {
  if (!mock && (!process.env.DATABASE_URL || !process.env.JWT_SECRET)) {
    throw new Error('Konfiguro DATABASE_URL dhe JWT_SECRET ne backend/.env');
  }
  const newman = require('newman');
  const prisma = require('../../src/config/database');
  const app = require('../../src/app');
  const server = app.listen(0, '127.0.0.1');
  let summary;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    summary = await new Promise((resolve, reject) => newman.run({
      collection: require('./ProfitX-API.postman_collection.json'),
      envVar: [{ key: 'baseUrl', value: `http://127.0.0.1:${server.address().port}` }],
      reporters: ['cli'],
      timeoutRequest: 15000,
    }, (error, result) => error ? reject(error) : resolve(result)));
    if (summary.run.failures.length) throw new Error(`${summary.run.failures.length} deshtime ne koleksion`);
    console.log(mock ? 'PASS Newman me databaze te simuluar; databaza reale NUK eshte verifikuar.' : 'PASS Newman me databaze reale.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (!mock) {
      try {
        const emails = ['testEmail', 'isolationEmail']
          .map(key => summary?.collection.variables.get(key))
          .filter(email => /^postman-[0-9a-f-]+@example\.test$/.test(email || ''));
        if (emails.length) {
          await prisma.user.deleteMany({ where: { email: { in: emails } } });
        }
      } finally { await prisma.$disconnect(); }
    }
  }
}

main().catch(error => { console.error('VERIFIKIMI DESHTOI:', error.message); process.exitCode = 1; });

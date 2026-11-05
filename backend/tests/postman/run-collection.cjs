const { randomUUID } = require('node:crypto');
require('dotenv').config();
const mock = process.argv.includes('--mock');

if (mock) {
  const model = () => {
    const rows = new Map();
    const match = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
    const find = where => [...rows.values()].find(row => match(row, where));
    return {
      findUnique: async ({ where }) => find(where) || null,
      findFirst: async ({ where }) => find(where) || null,
      findMany: async ({ where }) => [...rows.values()].filter(row => match(row, where)),
      create: async ({ data }) => {
        const row = { id: randomUUID(), ...data };
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
    };
  };
  const prisma = { user: model(), client: model(), supplier: model(), category: model(), $queryRaw: async () => [{ value: 1 }] };
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
        const email = summary?.collection.variables.get('testEmail');
        if (email && /^postman-[0-9a-f-]+@example\.test$/.test(email)) {
          await prisma.user.deleteMany({ where: { email } });
        }
      } finally { await prisma.$disconnect(); }
    }
  }
}

main().catch(error => { console.error('VERIFIKIMI DESHTOI:', error.message); process.exitCode = 1; });

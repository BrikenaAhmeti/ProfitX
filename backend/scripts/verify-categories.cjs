require('dotenv').config();

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const app = require('../src/app');
const prisma = require('../src/config/database');

const baseName = `M4-M5-${randomUUID()}`;
const emailA = `m4-m5-a-${randomUUID()}@example.test`;
const emailB = `m4-m5-b-${randomUUID()}@example.test`;
const password = 'M4M5-TestPass-123';
const createdUserIds = [];

async function request(baseUrl, method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload };
}

function expectStatus(result, expected, label) {
  assert.equal(result.status, expected, `${label}: pritej ${expected}, erdhi ${result.status}`);
  console.log(`PASS ${label} (${expected})`);
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const registerA = await request(baseUrl, 'POST', '/api/auth/register', {
      body: { name: `${baseName} A`, email: emailA, password },
    });
    expectStatus(registerA, 201, 'Regjistrimi i perdoruesit A');
    const userA = registerA.body.data.user;
    createdUserIds.push(userA.id);

    const registerB = await request(baseUrl, 'POST', '/api/auth/register', {
      body: { name: `${baseName} B`, email: emailB, password },
    });
    expectStatus(registerB, 201, 'Regjistrimi i perdoruesit B');
    const userB = registerB.body.data.user;
    createdUserIds.push(userB.id);

    const loginA = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { email: emailA, password },
    });
    expectStatus(loginA, 200, 'Hyrja e perdoruesit A');
    const tokenA = loginA.body.data.token;

    const loginB = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { email: emailB, password },
    });
    expectStatus(loginB, 200, 'Hyrja e perdoruesit B');
    const tokenB = loginB.body.data.token;

    const noToken = await request(baseUrl, 'GET', '/api/categories');
    expectStatus(noToken, 401, 'Pa token');

    const invalid = await request(baseUrl, 'POST', '/api/categories', {
      token: tokenA,
      body: { name: '', type: 'INVALID' },
    });
    expectStatus(invalid, 400, 'Te dhena te pavlefshme');

    const createA = await request(baseUrl, 'POST', '/api/categories', {
      token: tokenA,
      body: { name: `${baseName} A`, type: 'INCOME' },
    });
    expectStatus(createA, 201, 'Krijimi i kategorise A');
    const categoryA = createA.body.data.category;
    assert.equal(categoryA.userId, userA.id, 'Kategoria lidhet me perdoruesin A');
    console.log('PASS Kategoria lidhet me perdoruesin e autentikuar');

    const createB = await request(baseUrl, 'POST', '/api/categories', {
      token: tokenB,
      body: { name: `${baseName} B`, type: 'EXPENSE' },
    });
    expectStatus(createB, 201, 'Krijimi i kategorise B');
    const categoryB = createB.body.data.category;

    const listA = await request(baseUrl, 'GET', '/api/categories', { token: tokenA });
    expectStatus(listA, 200, 'Listimi i kategorive A');
    assert(listA.body.data.some((category) => category.id === categoryA.id));
    assert(!listA.body.data.some((category) => category.id === categoryB.id));
    console.log('PASS Perdoruesi A sheh kategorine e vet, jo te B');

    const listB = await request(baseUrl, 'GET', '/api/categories', { token: tokenB });
    expectStatus(listB, 200, 'Listimi i kategorive B');
    assert(listB.body.data.some((category) => category.id === categoryB.id));
    assert(!listB.body.data.some((category) => category.id === categoryA.id));
    console.log('PASS Perdoruesi B sheh kategorine e vet, jo te A');

    const readOwn = await request(baseUrl, 'GET', `/api/categories/${categoryA.id}`, { token: tokenA });
    expectStatus(readOwn, 200, 'Leximi sipas ID-se');
    assert.equal(readOwn.body.data.category.id, categoryA.id);

    const readOther = await request(baseUrl, 'GET', `/api/categories/${categoryA.id}`, { token: tokenB });
    expectStatus(readOther, 404, 'Leximi i kategorise se perdoruesit tjeter');

    const updateOther = await request(baseUrl, 'PUT', `/api/categories/${categoryA.id}`, {
      token: tokenB,
      body: { name: `${baseName} changed`, type: 'EXPENSE' },
    });
    expectStatus(updateOther, 404, 'Perditesimi i kategorise se perdoruesit tjeter');

    const deleteOther = await request(baseUrl, 'DELETE', `/api/categories/${categoryA.id}`, { token: tokenB });
    expectStatus(deleteOther, 404, 'Fshirja e kategorise se perdoruesit tjeter');

    const missingId = '00000000-0000-4000-8000-000000000000';
    const missingRead = await request(baseUrl, 'GET', `/api/categories/${missingId}`, { token: tokenA });
    expectStatus(missingRead, 404, 'ID qe nuk ekziston');

    const invalidId = await request(baseUrl, 'GET', '/api/categories/not-a-uuid', { token: tokenA });
    expectStatus(invalidId, 400, 'ID me format te pavlefshem');

    const updateOwn = await request(baseUrl, 'PUT', `/api/categories/${categoryA.id}`, {
      token: tokenA,
      body: { name: `${baseName} A updated`, type: 'EXPENSE' },
    });
    expectStatus(updateOwn, 200, 'Perditesimi i kategorise A');
    assert.equal(updateOwn.body.data.category.name, `${baseName} A updated`);

    const deleteOwn = await request(baseUrl, 'DELETE', `/api/categories/${categoryA.id}`, { token: tokenA });
    expectStatus(deleteOwn, 200, 'Fshirja e kategorise A');

    const missingUpdate = await request(baseUrl, 'PUT', `/api/categories/${missingId}`, {
      token: tokenA,
      body: { name: `${baseName} missing`, type: 'INCOME' },
    });
    expectStatus(missingUpdate, 404, 'Perditesimi i ID-se qe mungon');

    const missingDelete = await request(baseUrl, 'DELETE', `/api/categories/${missingId}`, { token: tokenA });
    expectStatus(missingDelete, 404, 'Fshirja e ID-se qe mungon');
  } finally {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('VERIFIKIMI DESHTOI:', error.message);
  process.exitCode = 1;
});

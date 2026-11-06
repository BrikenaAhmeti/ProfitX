const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function main() {
  require('dotenv').config();
  assert(process.env.DATABASE_URL, 'Konfiguro DATABASE_URL ne backend/.env per testimin real ne databaze');
  const prisma = require('../src/config/database');
  const suppliers = require('../src/services/supplier.service');
  const ApiError = require('../src/utils/ApiError');
  const userIds = [];
  const rejects = (operation, statusCode) => assert.rejects(operation, (error) =>
    error instanceof ApiError && error.statusCode === statusCode);

  try {
    for (const name of ['A', 'B']) {
      const user = await prisma.user.create({ data: {
        name: `Supplier test ${name}`,
        email: `supplier-${randomUUID()}@example.test`,
        passwordHash: 'unused-test-password-hash',
      } });
      userIds.push(user.id);
    }
    const [a, b] = userIds;
    const first = await suppliers.create(a, {
      name: ' Furnitori A ', email: ' SHARED@example.test ', userId: b,
    });
    const second = await suppliers.create(b, { name: 'Furnitori B', email: 'shared@example.test' });
    assert.equal(first.userId, a);
    assert.equal(first.name, 'Furnitori A');
    assert.equal(first.email, 'shared@example.test');
    assert.equal((await prisma.supplier.findUnique({ where: { id: first.id } })).userId, a);
    assert.equal((await suppliers.getById(a, first.id)).id, first.id);
    assert.deepEqual((await suppliers.list(a)).map(row => row.id), [first.id]);
    assert.deepEqual((await suppliers.list(b)).map(row => row.id), [second.id]);
    console.log('PASS Krijimi dhe leximi punojne ne databaze');

    for (const [owner, other] of [[a, second], [b, first]]) {
      await rejects(() => suppliers.getById(owner, other.id), 404);
      await rejects(() => suppliers.update(owner, other.id, { name: 'Blocked' }), 404);
      await rejects(() => suppliers.delete(owner, other.id), 404);
    }
    assert.equal((await suppliers.getById(b, second.id)).name, 'Furnitori B');
    console.log('PASS Perdoruesi A nuk sheh ose ndryshon furnitoret e B (dhe anasjelltas)');

    const missing = randomUUID();
    await rejects(() => suppliers.getById(a, missing), 404);
    await rejects(() => suppliers.update(a, missing, { name: 'Missing' }), 404);
    await rejects(() => suppliers.delete(a, missing), 404);
    await rejects(() => suppliers.getById(a, 'invalid'), 400);
    await rejects(() => suppliers.list(undefined), 400);
    await rejects(() => suppliers.create(undefined, { name: 'Invalid owner' }), 400);
    console.log('PASS ID qe nuk ekziston kthen gabim te kontrolluar');

    await rejects(() => suppliers.create(a, { name: 'Duplicate', email: first.email }), 409);
    await rejects(() => suppliers.create(a, { name: ' ' }), 400);
    await rejects(() => suppliers.update(a, first.id, { name: '' }), 400);
    const updated = await suppliers.update(a, first.id, { phone: ' 123 ', userId: b });
    assert.equal(updated.phone, '123');
    assert.equal(updated.userId, a);
    await suppliers.delete(a, first.id);
    await rejects(() => suppliers.getById(a, first.id), 404);
    console.log('PASS Perditesimi, fshirja dhe validimet');
  } finally {
    try {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(error => {
  console.error('VERIFIKIMI DESHTOI:', error.message);
  process.exitCode = 1;
});

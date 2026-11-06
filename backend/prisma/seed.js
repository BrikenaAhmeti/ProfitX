require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../src/config/database');

const TEST_USER_EMAIL = 'prova@example.test';
const transactions = [
  {
    type: 'INCOME',
    category: 'Shitje',
    amount: '1250.00',
    description: 'Seed: pagesë për shërbime web',
    occurredAt: new Date('2026-01-15T10:00:00.000Z'),
    client: 'Klienti Shembull',
  },
  {
    type: 'EXPENSE',
    category: 'Shpenzime operative',
    amount: '185.50',
    description: 'Seed: pajisje zyre',
    occurredAt: new Date('2026-01-16T10:00:00.000Z'),
    supplier: 'Furnitori Shembull',
  },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {},
    create: {
      name: 'Përdorues Test',
      email: TEST_USER_EMAIL,
      passwordHash: await bcrypt.hash('Test123456', 12),
    },
  });

  const categoryIds = new Map();
  for (const name of ['Shitje', 'Shpenzime operative']) {
    const type = name === 'Shitje' ? 'INCOME' : 'EXPENSE';
    const category = await prisma.category.upsert({
      where: { userId_name_type: { userId: user.id, name, type } },
      update: {},
      create: { userId: user.id, name, type },
    });
    categoryIds.set(name, category.id);
  }

  const client = await prisma.client.upsert({
    where: { userId_email: { userId: user.id, email: 'klienti@example.test' } },
    update: {},
    create: { userId: user.id, name: 'Klienti Shembull', email: 'klienti@example.test' },
  });
  const supplier = await prisma.supplier.upsert({
    where: { userId_email: { userId: user.id, email: 'furnitori@example.test' } },
    update: {},
    create: { userId: user.id, name: 'Furnitori Shembull', email: 'furnitori@example.test' },
  });

  for (const item of transactions) {
    const where = { userId: user.id, description: item.description, occurredAt: item.occurredAt };
    const existing = await prisma.transaction.findFirst({ where });
    if (existing) continue;

    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: categoryIds.get(item.category),
        type: item.type,
        amount: item.amount,
        description: item.description,
        occurredAt: item.occurredAt,
        ...(item.client ? { clientId: client.id } : { supplierId: supplier.id }),
      },
    });
  }

  console.log(`Seed përfundoi për ${TEST_USER_EMAIL}.`);
}

main()
  .catch((error) => {
    console.error('Seed dështoi:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../src/config/database');

const demoUser = {
  name: 'ProfitX Test User',
  email: 'demo@profitx.local',
  password: 'ProfitXDemo123!',
};

async function main() {
  const passwordHash = await bcrypt.hash(demoUser.password, 10);
  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      name: demoUser.name,
      passwordHash,
    },
    create: {
      name: demoUser.name,
      email: demoUser.email,
      passwordHash,
    },
  });

  const categories = [
    { name: 'Shitje', type: 'INCOME' },
    { name: 'Shpenzime operative', type: 'EXPENSE' },
  ];
  const categoryIds = new Map();

  for (const categoryData of categories) {
    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: user.id,
          name: categoryData.name,
          type: categoryData.type,
        },
      },
      update: {},
      create: { ...categoryData, userId: user.id },
    });
    categoryIds.set(categoryData.name, category.id);
  }

  const clients = [
    { name: 'Klienti Demo', email: 'klienti@profitx.local', phone: '+355 69 000 0001' },
    { name: 'Klienti Shembull', email: 'shembull@profitx.local', phone: '+355 69 000 0002' },
  ];
  const clientIds = new Map();

  for (const clientData of clients) {
    const client = await prisma.client.upsert({
      where: { userId_email: { userId: user.id, email: clientData.email } },
      update: { name: clientData.name, phone: clientData.phone },
      create: { ...clientData, userId: user.id },
    });
    clientIds.set(clientData.email, client.id);
  }

  const suppliers = [
    { name: 'Furnitori Demo', email: 'furnitori@profitx.local', phone: '+355 68 000 0001' },
    { name: 'Furnitori Shembull', email: 'furnitor.shembull@profitx.local', phone: '+355 68 000 0002' },
  ];
  const supplierIds = new Map();

  for (const supplierData of suppliers) {
    const supplier = await prisma.supplier.upsert({
      where: { userId_email: { userId: user.id, email: supplierData.email } },
      update: { name: supplierData.name, phone: supplierData.phone },
      create: { ...supplierData, userId: user.id },
    });
    supplierIds.set(supplierData.email, supplier.id);
  }

  const transactions = [
    {
      type: 'INCOME',
      category: 'Shitje',
      amount: '1250.00',
      description: 'Seed: pagesë për shërbime web',
      occurredAt: new Date('2026-01-15T10:00:00.000Z'),
      clientEmail: 'klienti@profitx.local',
    },
    {
      type: 'EXPENSE',
      category: 'Shpenzime operative',
      amount: '185.50',
      description: 'Seed: pajisje zyre',
      occurredAt: new Date('2026-01-16T10:00:00.000Z'),
      supplierEmail: 'furnitori@profitx.local',
    },
  ];

  for (const transaction of transactions) {
    const where = {
      userId: user.id,
      description: transaction.description,
      occurredAt: transaction.occurredAt,
    };
    const existing = await prisma.transaction.findFirst({ where });
    if (existing) continue;

    await prisma.transaction.create({
      data: {
        userId: user.id,
        categoryId: categoryIds.get(transaction.category),
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        occurredAt: transaction.occurredAt,
        ...(transaction.clientEmail
          ? { clientId: clientIds.get(transaction.clientEmail) }
          : { supplierId: supplierIds.get(transaction.supplierEmail) }),
      },
    });
  }

  const invoices = [
    {
      invoiceNumber: 'F-2026-0001',
      clientEmail: 'klienti@profitx.local',
      status: 'PAID',
      issueDate: new Date('2026-01-15T00:00:00.000Z'),
      dueDate: new Date('2026-01-30T00:00:00.000Z'),
      items: [{ description: 'Seed: sherbim web', quantity: '1', unitPrice: '1250.00' }],
    },
    {
      invoiceNumber: 'F-2026-0002',
      clientEmail: 'shembull@profitx.local',
      status: 'SENT',
      issueDate: new Date('2026-02-01T00:00:00.000Z'),
      dueDate: new Date('2026-02-15T00:00:00.000Z'),
      items: [
        { description: 'Seed: dizajn i faqes', quantity: '2', unitPrice: '300.00' },
        { description: 'Seed: hosting vjetor', quantity: '1', unitPrice: '120.00' },
      ],
    },
    {
      invoiceNumber: 'F-2026-0003',
      clientEmail: 'klienti@profitx.local',
      status: 'DRAFT',
      issueDate: new Date('2026-02-10T00:00:00.000Z'),
      items: [{ description: 'Seed: konsulence mujore', quantity: '3.5', unitPrice: '80.00' }],
    },
    {
      invoiceNumber: 'F-2026-0004',
      clientEmail: 'klienti@profitx.local',
      status: 'OVERDUE',
      issueDate: new Date('2026-01-05T00:00:00.000Z'),
      dueDate: new Date('2026-01-20T00:00:00.000Z'),
      items: [{ description: 'Seed: mirembajtje tremujore', quantity: '1', unitPrice: '450.00' }],
    },
  ];

  for (const invoice of invoices) {
    const existing = await prisma.invoice.findUnique({
      where: {
        userId_invoiceNumber: {
          userId: user.id,
          invoiceNumber: invoice.invoiceNumber,
        },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clientIds.get(invoice.clientEmail),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate ?? null,
        items: { create: invoice.items },
      },
    });
  }

  console.log('Seed-i përfundoi: 1 përdorues, 2 kategori, 2 klientë, 2 furnitorë, 2 transaksione dhe 4 fatura.');
  console.log(`Përdoruesi demonstrues: ${demoUser.email}`);
}

main()
  .catch((error) => {
    console.error('Seed-i dështoi:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

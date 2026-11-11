const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Decimal } = require('@prisma/client/runtime/client');

const userId = randomUUID();
const clientId = randomUUID();
const invoices = new Map();
let writes = 0;
let beforeUpdate;

function addInvoice(status, items = [{ description: 'Sherbim', quantity: '2', unitPrice: '5.00' }], owner = userId) {
  const invoice = {
    id: randomUUID(), userId: owner, clientId, invoiceNumber: randomUUID(), status, items,
    issueDate: new Date('2026-11-10'), dueDate: null, createdAt: new Date(),
  };
  invoices.set(invoice.id, invoice);
  return invoice;
}

// Prisma kthen Decimal; perdoren instanca reale edhe me ruajtje te simuluar.
function materialize(invoice) {
  return {
    ...invoice,
    items: invoice.items.map(item => ({ ...item, quantity: new Decimal(item.quantity), unitPrice: new Decimal(item.unitPrice) })),
  };
}

const prisma = {
  client: { findFirst: async ({ where }) => where.id === clientId && where.userId === userId ? { id: clientId } : null },
  invoice: {
    findFirst: async ({ where, select }) => {
      const invoice = invoices.get(where.id);
      if (!invoice || invoice.userId !== where.userId) return null;
      return select ? { id: invoice.id } : materialize(invoice);
    },
    findMany: async ({ where }) => [...invoices.values()].filter(invoice => invoice.userId === where.userId).map(materialize),
    create: async ({ data }) => {
      assert.equal(Object.hasOwn(data, 'total'), false, 'Totali nuk ruhet ne databaze');
      const invoice = addInvoice(data.status || 'DRAFT', data.items.create, data.userId);
      Object.assign(invoice, { clientId: data.clientId, invoiceNumber: data.invoiceNumber });
      writes++;
      return materialize(invoice);
    },
    update: async ({ where, data }) => {
      if (beforeUpdate) {
        const hook = beforeUpdate;
        beforeUpdate = undefined;
        hook();
      }
      const invoice = invoices.get(where.id);
      if (!invoice || invoice.userId !== where.userId || (where.status !== undefined && invoice.status !== where.status)) {
        throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      }
      assert.equal(Object.hasOwn(data, 'total'), false, 'Totali i klientit nuk duhet te ruhet');
      const { items, ...fields } = data;
      Object.assign(invoice, fields);
      if (items) invoice.items = items.create;
      writes++;
      return materialize(invoice);
    },
  },
};

require.cache[require.resolve('../src/config/database')] = { exports: prisma };
process.env.JWT_SECRET = randomUUID();
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
const app = express();
app.use(express.json());
app.use('/api/invoices', require('../src/routes/invoice.routes'));
app.use(require('../src/middleware/error.middleware').errorHandler);

async function main() {
  const server = app.listen(0, '127.0.0.1');
  let checks = 0;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    async function request(method, path, body, status) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/invoices${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify({ method, path, body, result }));
      assert.equal(result.success, status < 400);
      checks++;
      return result;
    }

    const totals = [
      { items: [{ quantity: '2.500', unitPrice: '12.34' }, { quantity: '3', unitPrice: '0.10' }], total: '31.15' },
      { items: [{ quantity: 0.1, unitPrice: 0.2 }, { quantity: 0.3, unitPrice: 0.1 }], total: '0.05' },
      { items: [{ quantity: '0.125', unitPrice: '0.04' }, { quantity: '0.125', unitPrice: '0.04' }], total: '0.02' },
      { items: [{ quantity: '999999999.999', unitPrice: '9999999999.99' }], total: '9999999999980000000.00' },
      { items: [{ quantity: '0.001', unitPrice: '0.01' }], total: '0.00' },
    ];
    const expectedTotals = new Map();
    for (const test of totals) {
      const result = await request('POST', '', {
        clientId, invoiceNumber: randomUUID(), total: '999.99',
        items: test.items.map(item => ({ description: 'Sherbim', ...item })),
      }, 201);
      const invoice = result.data.invoice;
      assert.equal(invoice.status, 'DRAFT');
      assert.equal(invoice.total, test.total);
      assert.equal(Object.hasOwn(invoices.get(invoice.id), 'total'), false);
      expectedTotals.set(invoice.id, test.total);
      const read = await request('GET', `/${invoice.id}`, undefined, 200);
      assert.equal(read.data.invoice.total, test.total);
    }

    const firstId = expectedTotals.keys().next().value;
    const replaced = await request('PUT', `/${firstId}`, {
      total: '123.45', items: [
        { description: 'A', quantity: 2, unitPrice: '0.10' },
        { description: 'B', quantity: 3, unitPrice: '0.05' },
      ],
    }, 200);
    assert.equal(replaced.data.invoice.total, '0.35');
    assert.equal(replaced.data.invoice.items.length, 2);
    expectedTotals.set(firstId, '0.35');
    const metadata = await request('PUT', `/${firstId}`, { invoiceNumber: randomUUID() }, 200);
    assert.equal(metadata.data.invoice.total, '0.35');
    assert.deepEqual(metadata.data.invoice.items, replaced.data.invoice.items);
    assert.equal((await request('GET', `/${firstId}`, undefined, 200)).data.invoice.total, '0.35');

    const statuses = ['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'CANCELLED'];
    const allowed = new Set(['DRAFT>SENT', 'DRAFT>CANCELLED', 'SENT>PAID', 'SENT>OVERDUE', 'SENT>CANCELLED', 'OVERDUE>PAID', 'OVERDUE>CANCELLED']);
    for (const from of statuses) {
      for (const to of statuses) {
        const invoice = addInvoice(from);
        expectedTotals.set(invoice.id, '10.00');
        const snapshot = JSON.stringify(invoice);
        const before = writes;
        const permitted = from === to || allowed.has(`${from}>${to}`);
        const result = await request('PUT', `/${invoice.id}`, { status: to }, permitted ? 200 : 400);
        if (permitted) {
          assert.equal(result.data.invoice.status, to);
          assert.equal(invoices.get(invoice.id).status, to);
          assert.equal(result.data.invoice.total, '10.00');
          assert.equal(writes, before + 1);
        } else {
          assert(result.message.includes(from) && result.message.includes(to));
          assert(result.errors.some(error => error.field === 'status' && error.message === result.message));
          assert.equal(JSON.stringify(invoices.get(invoice.id)), snapshot);
          assert.equal(writes, before);
        }
      }
    }

    const sequential = addInvoice('DRAFT');
    expectedTotals.set(sequential.id, '10.00');
    await request('PUT', `/${sequential.id}`, { status: ' sent ' }, 200);
    await request('PUT', `/${sequential.id}`, { status: 'PAID' }, 200);
    const paidSnapshot = JSON.stringify(invoices.get(sequential.id));
    await request('PUT', `/${sequential.id}`, {
      status: 'CANCELLED', items: [{ description: 'Blocked', quantity: 99, unitPrice: 99 }],
    }, 400);
    assert.equal(JSON.stringify(invoices.get(sequential.id)), paidSnapshot);

    const racing = addInvoice('SENT');
    expectedTotals.set(racing.id, '10.00');
    const originalItems = structuredClone(racing.items);
    const beforeRace = writes;
    beforeUpdate = () => { invoices.get(racing.id).status = 'PAID'; };
    const conflict = await request('PUT', `/${racing.id}`, {
      status: 'CANCELLED', items: [{ description: 'Blocked', quantity: 99, unitPrice: 99 }],
    }, 400);
    assert(conflict.errors.some(error => error.field === 'status' && /Rifreskoni/.test(error.message)));
    assert.equal(invoices.get(racing.id).status, 'PAID');
    assert.deepEqual(invoices.get(racing.id).items, originalItems);
    assert.equal(writes, beforeRace);

    const deleted = addInvoice('SENT');
    beforeUpdate = () => { invoices.delete(deleted.id); };
    await request('PUT', `/${deleted.id}`, { status: 'PAID' }, 404);
    const foreign = addInvoice('DRAFT', undefined, randomUUID());
    await request('GET', `/${foreign.id}`, undefined, 404);
    const list = await request('GET', '', undefined, 200);
    assert.equal(list.data.length, expectedTotals.size);
    for (const invoice of list.data) {
      assert.equal(invoice.userId, userId);
      assert.equal(invoice.total, expectedTotals.get(invoice.id));
    }

    console.log(`PASS ${checks} HTTP checks for invoice totals and status rules.`);
    console.log('PASS Totals on POST/PUT/GET/list, exact decimal arithmetic, line rounding, schema maximums and ignored client totals.');
    console.log('PASS All 25 status pairs, saved allowed transitions, clear 400 errors, unchanged data on rejection and concurrent status protection.');
    console.log('Real routes, JWT, middleware, controllers, service and Prisma Decimal; only storage is mocked. No live database or .env required.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

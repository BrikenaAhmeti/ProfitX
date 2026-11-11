const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const userId = randomUUID();
const clientId = randomUUID();
const invoiceId = randomUUID();
const invoices = new Map();
let writes = 0;

function validBody(overrides = {}) {
  return {
    clientId,
    invoiceNumber: `S10-${randomUUID()}`,
    issueDate: '2026-11-10',
    dueDate: '2026-11-30',
    items: [{ description: 'Sherbim', quantity: '1.250', unitPrice: '12.50' }],
    ...overrides,
  };
}

invoices.set(invoiceId, {
  id: invoiceId, userId, ...validBody(),
  issueDate: new Date('2026-11-10'), dueDate: new Date('2026-11-30'), status: 'DRAFT',
});

const prisma = {
  client: {
    findFirst: async ({ where }) => where.id === clientId && where.userId === userId ? { id: clientId } : null,
  },
  invoice: {
    findFirst: async ({ where }) => {
      const invoice = invoices.get(where.id);
      return invoice?.userId === where.userId ? structuredClone(invoice) : null;
    },
    create: async ({ data }) => {
      writes++;
      const invoice = {
        id: randomUUID(), status: 'DRAFT', issueDate: new Date(new Date().setUTCHours(0, 0, 0, 0)),
        dueDate: null, ...data, items: data.items.create,
      };
      invoices.set(invoice.id, invoice);
      return structuredClone(invoice);
    },
    update: async ({ where, data }) => {
      writes++;
      const existing = invoices.get(where.id);
      const invoice = { ...existing, ...data, items: data.items ? data.items.create : existing.items };
      invoices.set(invoice.id, invoice);
      return structuredClone(invoice);
    },
  },
};

// Vetem ruajtja simulohet; rruga, JWT, validimi, controller-i dhe sherbimi jane reale.
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
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    async function request(method, body, status, fields = [], authenticated = true) {
      const before = writes;
      const snapshot = JSON.stringify([...invoices]);
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/invoices${method === 'PUT' ? `/${invoiceId}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify({ method, body, result }));
      if (status >= 400) {
        assert.equal(result.success, false);
        assert.equal(writes, before, 'Te dhenat e pavlefshme nuk duhet te shkruhen');
        assert.equal(JSON.stringify([...invoices]), snapshot, 'Faturat duhet te mbeten te pandryshuara');
        for (const field of fields) {
          assert(Array.isArray(result.errors), 'Gabimet duhet te jene ne errors[]');
          assert(result.errors.some(error => error.field === field && typeof error.message === 'string' && error.message.length > 0),
            JSON.stringify({ field, result }));
        }
      } else {
        assert.equal(result.success, true);
        assert.equal(writes, before + 1);
        assert.equal(result.data.invoice.userId, userId);
        assert(result.data.invoice.items.length > 0);
        const { total, ...storedFields } = result.data.invoice;
        assert.match(total, /^\d+\.\d{2}$/);
        assert.deepEqual(storedFields, JSON.parse(JSON.stringify(invoices.get(result.data.invoice.id))));
      }
      checks++;
      return result.data?.invoice;
    }

    await request('POST', {}, 400, ['clientId', 'invoiceNumber', 'items']);
    await request('POST', validBody({ items: undefined }), 400, ['items']);
    for (const method of ['POST', 'PUT']) {
      const status = method === 'POST' ? 201 : 200;
      await request(method, validBody(), 401, [], false);
      for (const clientId of [null, '', ' ', 'invalid-id', 12]) {
        await request(method, validBody({ clientId }), 400, ['clientId']);
      }
      for (const invoiceNumber of [null, '', ' ', 12, 'x'.repeat(51)]) {
        await request(method, validBody({ invoiceNumber }), 400, ['invoiceNumber']);
      }
      for (const items of [[], null, {}, 'invalid']) await request(method, validBody({ items }), 400, ['items']);
      for (const item of [null, [], 'invalid']) await request(method, validBody({ items: [item] }), 400, ['items[0]']);
      for (const description of [undefined, ' ', 'x'.repeat(301)]) {
        await request(method, validBody({ items: [{ description, quantity: 1, unitPrice: 1 }] }), 400, ['items[0].description']);
      }
      for (const field of ['quantity', 'unitPrice']) {
        const values = [0, '0', -1, '-0.01', null, '', true, {}, 'NaN', 'Infinity', '0x10'];
        values.push(field === 'quantity' ? '1.0001' : '1.001', field === 'quantity' ? '1000000000' : '10000000000');
        for (const value of values) {
          await request(method, validBody({ items: [{ description: 'Sherbim', quantity: 1, unitPrice: 1, [field]: value }] }), 400, [`items[0].${field}`]);
        }
      }
      await request(method, validBody({ items: [{ description: 'Sherbim' }] }), 400, ['items[0].unitPrice']);
      await request(method, validBody({ items: [
        { description: 'A', quantity: 0, unitPrice: 1 }, { description: 'B', quantity: 1, unitPrice: 0 },
      ] }), 400, ['items[0].quantity', 'items[1].unitPrice']);
      for (const field of ['issueDate', 'dueDate']) {
        for (const value of ['invalid', '2026-02-30', '2025-02-29', '2026-11-10T24:00:00Z', 123]) {
          await request(method, validBody({ [field]: value }), 400, [field]);
        }
      }
      await request(method, validBody({ issueDate: null }), 400, ['issueDate']);
      await request(method, validBody({ dueDate: '2026-11-09' }), 400, ['dueDate']);
      await request(method, validBody({ dueDate: '2026-11-10T00:30:00+02:00' }), 400, ['dueDate']);
      await request(method, validBody({ status: 'UNKNOWN' }), 400, ['status']);
      await request(method, [], 400, ['body']);

      await request(method, validBody(), status);
      await request(method, validBody({ dueDate: '2026-11-10' }), status);
      await request(method, validBody({ issueDate: '2024-02-29', dueDate: '2024-02-29' }), status);
      await request(method, validBody({ issueDate: '2026-11-10T23:00:00Z', dueDate: '2026-11-10T01:00:00Z' }), status);
      const normalized = await request(method, validBody({
        clientId: ` ${clientId} `, invoiceNumber: ` S10-${randomUUID()} `, status: ' sent ',
        issueDate: ' 2026-11-10T23:00:00Z ', dueDate: null,
        items: [{ description: ' Sherbim ', quantity: 0.001, unitPrice: ' 0.01 ' }],
      }), status);
      assert.equal(normalized.clientId, clientId);
      assert.equal(normalized.status, 'SENT');
      assert.equal(normalized.issueDate, '2026-11-10T00:00:00.000Z');
      assert.equal(normalized.items[0].description, 'Sherbim');
      assert.equal(normalized.items[0].unitPrice, '0.01');
      await request(method, validBody({ items: [{ description: 'x'.repeat(300), quantity: '999999999.999', unitPrice: '9999999999.99' }] }), status);
      const defaults = await request(method, validBody({ dueDate: '', items: [{ description: 'Sherbim', unitPrice: 1 }] }), status);
      assert.equal(defaults.items[0].quantity, '1');
      assert.equal(defaults.dueDate, null);
    }

    await request('POST', validBody({ issueDate: undefined, dueDate: '2000-01-01' }), 400, ['dueDate']);
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = await request('POST', validBody({ issueDate: undefined, dueDate: today }), 201);
    assert.equal(defaultDate.issueDate.slice(0, 10), today);
    await request('PUT', validBody(), 200);
    await request('PUT', { dueDate: '2026-11-09' }, 400, ['dueDate']);
    await request('PUT', { issueDate: '2026-12-01' }, 400, ['dueDate']);
    const beforePartial = structuredClone(invoices.get(invoiceId));
    const partial = await request('PUT', { dueDate: '2026-11-11' }, 200);
    assert.equal(partial.invoiceNumber, beforePartial.invoiceNumber);
    assert.deepEqual(partial.items, beforePartial.items);
    const cleared = await request('PUT', { issueDate: '2026-12-01', dueDate: null }, 200);
    assert.equal(cleared.dueDate, null);

    console.log(`PASS ${checks} HTTP checks for invoice validation (POST/PUT and errors[]).`);
    console.log('PASS Fature pa artikuj: 400; sasia ose cmimi zero: 400; afati para leshimit: 400; te dhenat e sakta: 201/200.');
    console.log('Real routes, JWT, middleware, controller and service; only Prisma storage is mocked. No database or .env required.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

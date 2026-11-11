const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

const INVOICE_NUMBER_MAX_LENGTH = 50;
const ITEM_DESCRIPTION_MAX_LENGTH = 300;
const MAX_QUANTITY = 999999999.999;
const MAX_UNIT_PRICE = 9999999999.99;
const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
const STATUS_TRANSITIONS = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

const INVOICE_NOT_FOUND = 'Fatura nuk u gjet';
const CLIENT_NOT_AVAILABLE = 'Klienti nuk ekziston ose nuk i perket perdoruesit te kycur';
const DUPLICATE_INVOICE_NUMBER = 'Ky numer fature ekziston tashme per kete perdorues';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;
const UNIT_PRICE_REGEX = /^\d+(\.\d{1,2})?$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kontrollon formatin e id-se para se te pyesim databazen.
 * Id-ja e pavlefshme nuk duhet te kthej gabim 500 nga Prisma.
 */
function assertValidId(id) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new ApiError(400, 'Id e pavlefshme');
  }
}

function parseDecimal(value, { field, regex, max, label }) {
  if (value === undefined || value === null || value === '') {
    throw new ApiError(400, `${label} eshte e detyrueshme`);
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ApiError(400, `${label} duhet te jete numer`);
  }

  const raw = typeof value === 'string' ? value.trim() : value;
  const text = String(raw);

  if (!regex.test(text)) {
    throw new ApiError(400, `${label} ka format te pavlefshem`);
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${label} duhet te jete me e madhe se zero`);
  }

  if (parsed > max) {
    throw new ApiError(400, `${label} eshte shume e madhe`);
  }

  return text;
}

/**
 * Pret nje date (YYYY-MM-DD ose ISO 8601) dhe e kthen si Date ne UTC.
 * undefined do te thote qe fusha nuk u dergua; null lejohet vetem kur e kerkojme.
 */
function parseDate(value, { field, allowNull = false }) {
  if (value === undefined) return undefined;

  if (value === null || value === '') {
    if (allowNull) return null;
    throw new ApiError(400, `${field} eshte e detyrueshme`);
  }

  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new ApiError(400, `${field} nuk eshte e vlefshme`);
  }

  const date = value instanceof Date ? value : new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${field} nuk eshte e vlefshme`);
  }

  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim())) {
    const text = value.trim();
    const normalized = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== text) {
      throw new ApiError(400, `${field} nuk eshte e vlefshme`);
    }
    return normalized;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeStatus(status) {
  if (typeof status !== 'string') {
    return status;
  }

  return status.trim().toUpperCase();
}

function assertStatusTransition(currentStatus, nextStatus) {
  if (nextStatus === undefined || nextStatus === currentStatus) return;
  if (!STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    const message = `Kalimi i statusit nga ${currentStatus} ne ${nextStatus} nuk lejohet.`;
    throw new ApiError(400, message, [{ field: 'status', message }]);
  }
}

function decimalToUnits(value, scale) {
  const [whole, fraction = ''] = value.toString().split('.');
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
}

/** Totali llogaritet nga artikujt; cdo rresht rrumbullakohet ne cent (gjysma lart). */
function withTotal(invoice) {
  const cents = invoice.items.reduce((sum, item) => {
    const quantity = decimalToUnits(item.quantity, 3);
    const unitPrice = decimalToUnits(item.unitPrice, 2);
    return sum + (quantity * unitPrice + 500n) / 1000n;
  }, 0n);

  return { ...invoice, total: `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}` };
}

function buildItemData(item, index) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new ApiError(400, `Artikulli ${index + 1} duhet te jete objekt`);
  }

  if (typeof item.description !== 'string' || !item.description.trim()) {
    throw new ApiError(400, `Artikulli ${index + 1}: pershkrimi eshte i detyrueshem`);
  }

  const description = item.description.trim();
  if (description.length > ITEM_DESCRIPTION_MAX_LENGTH) {
    throw new ApiError(
      400,
      `Artikulli ${index + 1}: pershkrimi nuk mund te kete me shume se ${ITEM_DESCRIPTION_MAX_LENGTH} karaktere`,
    );
  }

  const quantity = item.quantity === undefined || item.quantity === null || item.quantity === ''
    ? '1'
    : parseDecimal(item.quantity, {
      field: 'quantity',
      regex: QUANTITY_REGEX,
      max: MAX_QUANTITY,
      label: `Artikulli ${index + 1}: sasia`,
    });

  const unitPrice = parseDecimal(item.unitPrice, {
    field: 'unitPrice',
    regex: UNIT_PRICE_REGEX,
    max: MAX_UNIT_PRICE,
    label: `Artikulli ${index + 1}: cmimi per njesi`,
  });

  return { description, quantity, unitPrice };
}

function buildItemsData(items) {
  if (!Array.isArray(items)) {
    throw new ApiError(400, 'Artikujt duhet te jene liste');
  }

  if (items.length === 0) {
    throw new ApiError(400, 'Fatura duhet te kete te pakten nje artikull');
  }

  return items.map(buildItemData);
}

/**
 * Pret te dhenat e fatures dhe kthen nje objekt qe permban vetem fushat e lejuara.
 */
function buildInvoiceData(data = {}) {
  const payload = {};

  if (data.clientId !== undefined) {
    payload.clientId = typeof data.clientId === 'string' ? data.clientId.trim() : data.clientId;
  }

  if (data.invoiceNumber !== undefined) {
    payload.invoiceNumber = typeof data.invoiceNumber === 'string'
      ? data.invoiceNumber.trim()
      : data.invoiceNumber;
  }

  if (data.status !== undefined) {
    payload.status = normalizeStatus(data.status);
  }

  if (data.issueDate !== undefined) {
    payload.issueDate = parseDate(data.issueDate, { field: 'Data e leshimit' });
  }

  if (data.dueDate !== undefined) {
    payload.dueDate = parseDate(data.dueDate, { field: 'Data e afatit', allowNull: true });
  }

  if (data.items !== undefined) {
    payload.items = buildItemsData(data.items);
  }

  return payload;
}

/**
 * Kontrollet e mbrojtjes ne nivel sherbimi per fushat e detyrueshme.
 */
function requireInvoiceFields(payload, { partial = false } = {}) {
  if (!partial || payload.clientId !== undefined) {
    if (!payload.clientId) {
      throw new ApiError(400, 'Klienti eshte i detyrueshem');
    }
    assertValidId(payload.clientId);
  }

  if (!partial || payload.invoiceNumber !== undefined) {
    if (!payload.invoiceNumber || typeof payload.invoiceNumber !== 'string') {
      throw new ApiError(400, 'Numri i fatures eshte i detyrueshem');
    }

    if (payload.invoiceNumber.length > INVOICE_NUMBER_MAX_LENGTH) {
      throw new ApiError(
        400,
        `Numri i fatures nuk mund te kete me shume se ${INVOICE_NUMBER_MAX_LENGTH} karaktere`,
      );
    }
  }

  if (payload.status !== undefined && !INVOICE_STATUSES.includes(payload.status)) {
    throw new ApiError(400, `Statusi duhet te jete ${INVOICE_STATUSES.join(', ')}`);
  }

  if (!partial && payload.items === undefined) {
    throw new ApiError(400, 'Fatura duhet te kete te pakten nje artikull');
  }
}

/**
 * Verifikon qe klienti i perket perdoruesit te kycur.
 */
async function assertOwnedClient(userId, clientId) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });

  if (!client) {
    throw new ApiError(400, CLIENT_NOT_AVAILABLE);
  }
}

function assertDateOrder(issueDate, dueDate) {
  if (issueDate && dueDate && dueDate < issueDate) {
    const message = 'Afati nuk mund te jete para dates se leshimit';
    throw new ApiError(400, message, [{ field: 'dueDate', message }]);
  }
}

function handlePrismaError(error) {
  if (error.code === 'P2002') {
    throw new ApiError(409, DUPLICATE_INVOICE_NUMBER);
  }

  if (error.code === 'P2025') {
    throw new ApiError(404, INVOICE_NOT_FOUND);
  }

  if (error.code === 'P2003' || error.code === 'P2014') {
    throw new ApiError(400, 'Referenca e fatures nuk eshte e vlefshme');
  }

  throw error;
}

/**
 * Kthen vetem faturat e perdoruesit te kycur, me te rejat e para.
 */
async function list(userId) {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    include: { items: true },
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
  });
  return invoices.map(withTotal);
}

/**
 * Kthen nje fature te perdoruesit te kycur bashke me artikujt, ose 404.
 */
async function getById(userId, id) {
  assertValidId(id);

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    include: { items: true },
  });

  if (!invoice) {
    throw new ApiError(404, INVOICE_NOT_FOUND);
  }

  return withTotal(invoice);
}

/**
 * Krijon faturen bashke me artikujt ne nje transaksion te vetem te databazes.
 */
async function create(userId, data) {
  const payload = buildInvoiceData(data);
  requireInvoiceFields(payload);

  await assertOwnedClient(userId, payload.clientId);

  const { items, ...invoiceData } = payload;
  const today = new Date();
  const effectiveIssueDate = invoiceData.issueDate
    || new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  assertDateOrder(effectiveIssueDate, invoiceData.dueDate);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        userId,
        items: { create: items },
      },
      include: { items: true },
    });
    return withTotal(invoice);
  } catch (error) {
    return handlePrismaError(error);
  }
}

/**
 * Nderron faturen dhe, kur dergohen artikujt, i zevendeson te gjithe
 * ne nje transaksion te vetem. Fushat qe nuk dergohen mbeten te pandryshuara.
 */
async function update(userId, id, data) {
  assertValidId(id);
  const existing = await getById(userId, id);

  const payload = buildInvoiceData(data);
  requireInvoiceFields(payload, { partial: true });
  assertStatusTransition(existing.status, payload.status);

  if (payload.clientId !== undefined) {
    await assertOwnedClient(userId, payload.clientId);
  }

  const issueDate = payload.issueDate !== undefined ? payload.issueDate : existing.issueDate;
  const dueDate = payload.dueDate !== undefined ? payload.dueDate : existing.dueDate;
  assertDateOrder(issueDate, dueDate);

  const { items, ...invoiceData } = payload;

  try {
    const invoice = await prisma.invoice.update({
      // Statusi kontrollohet edhe gjate shkrimit, qe nje kerkese paralele te mos e anashkaloje rregullin.
      where: { id, userId, ...(payload.status !== undefined ? { status: existing.status } : {}) },
      data: {
        ...invoiceData,
        ...(items !== undefined ? { items: { deleteMany: {}, create: items } } : {}),
      },
      include: { items: true },
    });
    return withTotal(invoice);
  } catch (error) {
    if (error.code === 'P2025' && payload.status !== undefined) {
      const current = await prisma.invoice.findFirst({ where: { id, userId }, select: { id: true } });
      if (current) {
        const message = 'Statusi i fatures ka ndryshuar. Rifreskoni faturen dhe provoni perseri.';
        throw new ApiError(400, message, [{ field: 'status', message }]);
      }
    }
    return handlePrismaError(error);
  }
}

/**
 * Fshin nje fature te perdoruesit te kycur; artikujt fshihen me cascade.
 */
async function remove(userId, id) {
  assertValidId(id);
  await getById(userId, id);

  try {
    await prisma.invoice.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  delete: remove,
  INVOICE_NUMBER_MAX_LENGTH,
  ITEM_DESCRIPTION_MAX_LENGTH,
  INVOICE_STATUSES,
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
};

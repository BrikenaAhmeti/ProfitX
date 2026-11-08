const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

const DESCRIPTION_MAX_LENGTH = 500;
const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'];
const MAX_AMOUNT = 9999999999.99;

const TRANSACTION_NOT_FOUND = 'Transaksioni nuk u gjet';
const CATEGORY_NOT_AVAILABLE = 'Kategoria nuk ekziston ose nuk i perket perdoruesit te kycur';
const CLIENT_NOT_AVAILABLE = 'Klienti nuk ekziston ose nuk i perket perdoruesit te kycur';
const SUPPLIER_NOT_AVAILABLE = 'Furnitori nuk ekziston ose nuk i perket perdoruesit te kycur';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

const TYPE_ALIASES = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  'TE ARDHURA': 'INCOME',
  'TE_ARDHURA': 'INCOME',
  SHPENZIM: 'EXPENSE',
  SHPENZIME: 'EXPENSE',
};

/**
 * Kontrollon formatin e id-se para se te pyesim databazen.
 * Id-ja e pavlefshme nuk duhet te kthej gabim 500 nga Prisma.
 */
function assertValidId(id) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new ApiError(400, 'Id e pavlefshme');
  }
}

function normalizeType(type) {
  if (typeof type !== 'string') {
    return type;
  }

  const key = type.trim().toUpperCase().replace(/\s+/g, ' ');
  return TYPE_ALIASES[key] || TYPE_ALIASES[key.replace(/ /g, '_')] || key;
}

/**
 * Shuma pranohet si numur ose tekst numerik me maksimumi dy shifra pas presjes.
 * Kthehet si tekst qe Prisma ta ruaje si Decimal pa humbur presjen.
 */
function parseAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    throw new ApiError(400, 'Shuma eshte e detyrueshme');
  }

  if (typeof amount !== 'number' && typeof amount !== 'string') {
    throw new ApiError(400, 'Shuma duhet te jete numer');
  }

  const raw = typeof amount === 'string' ? amount.trim() : amount;
  const text = String(raw);

  if (!AMOUNT_REGEX.test(text)) {
    throw new ApiError(400, 'Shuma duhet te jete numer pozitiv me maksimumi dy shifra pas presjes');
  }

  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, 'Shuma duhet te jete me e madhe se zero');
  }

  if (value > MAX_AMOUNT) {
    throw new ApiError(400, 'Shuma eshte shume e madhe');
  }

  return text;
}

/**
 * Data e transaksionit pranohet si ISO 8601. Kur mungon, databaza vendos daten aktuale.
 */
function parseOccurredAt(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    throw new ApiError(400, 'Data e transaksionit nuk eshte e vlefshme');
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Data e transaksionit nuk eshte e vlefshme');
  }

  return date;
}

/**
 * Pret te dhenat e transaksionit dhe kthen vetem fushat e lejuara.
 * Fushat opsionale qe vijne bosh ('' ose null) ruhen si null.
 */
function buildTransactionData(data = {}) {
  const payload = {};

  if (data.type !== undefined) {
    payload.type = normalizeType(data.type);
  }

  if (data.amount !== undefined) {
    payload.amount = parseAmount(data.amount);
  }

  if (data.description !== undefined) {
    const description = typeof data.description === 'string' ? data.description.trim() : data.description;
    payload.description = description === '' || description === null ? null : description;
  }

  if (data.occurredAt !== undefined) {
    const occurredAt = parseOccurredAt(data.occurredAt);
    if (occurredAt !== undefined) payload.occurredAt = occurredAt;
  }

  if (data.categoryId !== undefined) {
    payload.categoryId = typeof data.categoryId === 'string' ? data.categoryId.trim() : data.categoryId;
  }

  if (data.clientId !== undefined) {
    const clientId = typeof data.clientId === 'string' ? data.clientId.trim() : data.clientId;
    payload.clientId = clientId === '' || clientId === null ? null : clientId;
  }

  if (data.supplierId !== undefined) {
    const supplierId = typeof data.supplierId === 'string' ? data.supplierId.trim() : data.supplierId;
    payload.supplierId = supplierId === '' || supplierId === null ? null : supplierId;
  }

  return payload;
}

/**
 * Kontrollet e mbrojtjes ne nivel sherbimi. Validimi i plote mbetet detyre e S7.
 */
function requireType(payload) {
  if (!payload.type || typeof payload.type !== 'string') {
    throw new ApiError(400, 'Lloji eshte i detyrueshem');
  }

  if (!TRANSACTION_TYPES.includes(payload.type)) {
    throw new ApiError(400, 'Lloji duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE)');
  }
}

function requireCategoryId(payload) {
  if (!payload.categoryId) {
    throw new ApiError(400, 'Kategoria eshte e detyrueshme');
  }
}

function requireAmount(payload) {
  if (payload.amount === undefined) {
    throw new ApiError(400, 'Shuma eshte e detyrueshme');
  }
}

function requireDescriptionLength(payload) {
  if (payload.description === undefined || payload.description === null) return;

  if (typeof payload.description !== 'string') {
    throw new ApiError(400, 'Pershkrimi duhet te jete tekst');
  }

  if (payload.description.length > DESCRIPTION_MAX_LENGTH) {
    throw new ApiError(400, `Pershkrimi nuk mund te kete me shume se ${DESCRIPTION_MAX_LENGTH} karaktere`);
  }
}

/**
 * Verifikon qe kategoria i perket perdoruesit te kycur.
 */
async function assertOwnedCategory(userId, categoryId) {
  assertValidId(categoryId);

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) {
    throw new ApiError(400, CATEGORY_NOT_AVAILABLE);
  }
}

/**
 * Verifikon qe klienti i perket perdoruesit te kycur. Vlera null lejohet.
 */
async function assertOwnedClient(userId, clientId) {
  if (clientId === null) return;

  assertValidId(clientId);

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  });

  if (!client) {
    throw new ApiError(400, CLIENT_NOT_AVAILABLE);
  }
}

/**
 * Verifikon qe furnitori i perket perdoruesit te kycur. Vlera null lejohet.
 */
async function assertOwnedSupplier(userId, supplierId) {
  if (supplierId === null) return;

  assertValidId(supplierId);

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, userId },
    select: { id: true },
  });

  if (!supplier) {
    throw new ApiError(400, SUPPLIER_NOT_AVAILABLE);
  }
}

async function assertOwnedReferences(userId, payload) {
  if (payload.categoryId !== undefined) {
    await assertOwnedCategory(userId, payload.categoryId);
  }

  if (payload.clientId !== undefined) {
    await assertOwnedClient(userId, payload.clientId);
  }

  if (payload.supplierId !== undefined) {
    await assertOwnedSupplier(userId, payload.supplierId);
  }
}

function handlePrismaError(error) {
  if (error.code === 'P2025') {
    throw new ApiError(404, TRANSACTION_NOT_FOUND);
  }

  if (error.code === 'P2003' || error.code === 'P2014') {
    throw new ApiError(400, 'Referenca e transaksionit nuk eshte e vlefshme');
  }

  throw error;
}

/**
 * Kthen vetem transaksionet e perdoruesit te kycur, me te fundit i pari.
 */
// Query: type, categoryId, dateFrom, dateTo. Dates use YYYY-MM-DD in UTC;
// dateTo includes the whole day through an exclusive next-day boundary.
function buildListFilters(filters) {
  const where = {};
  const errors = [];
  if (filters.type !== undefined) {
    const type = normalizeType(filters.type);
    if (!TRANSACTION_TYPES.includes(type)) {
      errors.push({ field: 'type', message: 'Lloji duhet te jete INCOME ose EXPENSE.' });
    } else where.type = type;
  }
  if (filters.categoryId !== undefined) {
    if (typeof filters.categoryId !== 'string' || !UUID_REGEX.test(filters.categoryId)) {
      errors.push({ field: 'categoryId', message: 'Kategoria duhet te jete UUID e vlefshme.' });
    } else where.categoryId = filters.categoryId;
  }
  const dates = {};
  for (const field of ['dateFrom', 'dateTo']) {
    if (filters[field] === undefined) continue;
    const value = filters[field];
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      errors.push({ field, message: 'Data duhet te jete date e vlefshme ne formatin YYYY-MM-DD.' });
    } else dates[field] = date;
  }
  if (dates.dateFrom && dates.dateTo && dates.dateFrom > dates.dateTo) {
    errors.push({ field: 'dateTo', message: 'Data deri duhet te jete e njejte ose pas dates nga.' });
  }
  if (errors.length) throw new ApiError(400, 'Filtrat e transaksioneve jane te pavlefshem.', errors);
  if (dates.dateFrom || dates.dateTo) {
    where.occurredAt = {};
    if (dates.dateFrom) where.occurredAt.gte = dates.dateFrom;
    if (dates.dateTo) {
      const end = new Date(dates.dateTo);
      end.setUTCDate(end.getUTCDate() + 1);
      where.occurredAt.lt = end;
    }
  }
  return where;
}

async function list(userId, filters = {}) {
  const where = buildListFilters(filters);
  return prisma.transaction.findMany({
    where: { ...where, userId },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Kthen nje transaksion te perdoruesit te kycur ose 404.
 */
async function getById(userId, id) {
  assertValidId(id);

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
  });

  if (!transaction) {
    throw new ApiError(404, TRANSACTION_NOT_FOUND);
  }

  return transaction;
}

/**
 * Krijon nje transaksion te lidhur me perdoruesin e kycur.
 * Kategoria, klienti dhe furnitori duhet t'i perkasin te njejtit perdorues.
 */
async function create(userId, data) {
  const payload = buildTransactionData(data);
  requireType(payload);
  requireAmount(payload);
  requireCategoryId(payload);
  requireDescriptionLength(payload);
  await assertOwnedReferences(userId, payload);

  try {
    return await prisma.transaction.create({
      data: {
        ...payload,
        userId,
      },
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

/**
 * Nderron te dhenat e nje transaksioni te perdoruesit te kycur.
 * Fushat qe nuk dergohen mbeten te pandryshuara.
 */
async function update(userId, id, data) {
  assertValidId(id);
  await getById(userId, id);

  const payload = buildTransactionData(data);

  if (payload.type !== undefined) requireType(payload);
  if (payload.categoryId !== undefined) requireCategoryId(payload);
  requireDescriptionLength(payload);
  await assertOwnedReferences(userId, payload);

  try {
    return await prisma.transaction.update({
      where: { id, userId },
      data: payload,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

/**
 * Fshin nje transaksion te perdoruesit te kycur.
 */
async function remove(userId, id) {
  assertValidId(id);
  await getById(userId, id);

  try {
    await prisma.transaction.delete({
      where: { id, userId },
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
  DESCRIPTION_MAX_LENGTH,
  TRANSACTION_TYPES,
  MAX_AMOUNT,
};

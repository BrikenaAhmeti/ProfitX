const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

const NAME_MAX_LENGTH = 100;
const CATEGORY_TYPES = ['INCOME', 'EXPENSE'];

const CATEGORY_NOT_FOUND = 'Kategoria nuk u gjet';
const DUPLICATE_CATEGORY = 'Kjo kategori ekziston tashme per kete lloj';
const CATEGORY_IN_USE = 'Kategoria nuk mund te fshihet sepse perdoret ne transaksione';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Pret te dhenat e kategorise dhe kthen vetem fushat e lejuara.
 */
function buildCategoryData(data = {}) {
  const payload = {};

  if (data.name !== undefined) {
    payload.name = typeof data.name === 'string' ? data.name.trim() : data.name;
  }

  if (data.type !== undefined) {
    payload.type = normalizeType(data.type);
  }

  return payload;
}

function requireName(payload) {
  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    throw new ApiError(400, 'Emri eshte i detyrueshem');
  }
}

function requireType(payload) {
  if (!payload.type || typeof payload.type !== 'string') {
    throw new ApiError(400, 'Lloji eshte i detyrueshem');
  }

  if (!CATEGORY_TYPES.includes(payload.type)) {
    throw new ApiError(400, 'Lloji duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE)');
  }
}

function handlePrismaError(error) {
  if (error.code === 'P2002') {
    throw new ApiError(409, DUPLICATE_CATEGORY);
  }

  if (error.code === 'P2025') {
    throw new ApiError(404, CATEGORY_NOT_FOUND);
  }

  if (error.code === 'P2003' || error.code === 'P2014') {
    throw new ApiError(409, CATEGORY_IN_USE);
  }

  throw error;
}

/**
 * Kthen vetem kategorite e perdoruesit te kycur.
 */
async function list(userId) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Kthen nje kategori te perdoruesit te kycur ose 404.
 */
async function getById(userId, id) {
  assertValidId(id);

  const category = await prisma.category.findFirst({
    where: { id, userId },
  });

  if (!category) {
    throw new ApiError(404, CATEGORY_NOT_FOUND);
  }

  return category;
}

/**
 * Krijon nje kategori te lidhur me perdoruesin e kycur.
 */
async function create(userId, data) {
  const payload = buildCategoryData(data);
  requireName(payload);
  requireType(payload);

  try {
    return await prisma.category.create({
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
 * Nderron te dhenat e nje kategorie te perdoruesit te kycur.
 * Kategoria e nje perdoruesi tjeter nuk mund te ndryshohet.
 */
async function update(userId, id, data) {
  assertValidId(id);
  await getById(userId, id);

  const payload = buildCategoryData(data);
  requireName(payload);
  requireType(payload);

  try {
    return await prisma.category.update({
      where: { id },
      data: payload,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

/**
 * Fshin nje kategori te perdoruesit te kycur.
 */
async function remove(userId, id) {
  assertValidId(id);
  await getById(userId, id);

  try {
    await prisma.category.delete({
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
  NAME_MAX_LENGTH,
  CATEGORY_TYPES,
};

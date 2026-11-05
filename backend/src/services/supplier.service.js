const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

const NAME_MAX_LENGTH = 150;
const EMAIL_MAX_LENGTH = 255;
const PHONE_MAX_LENGTH = 30;
const ADDRESS_MAX_LENGTH = 300;

const SUPPLIER_NOT_FOUND = 'Furnitori nuk u gjet';
const DUPLICATE_EMAIL = 'Ky email eshte tashme i regjistruar per nje furnitor tjeter';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kontrollon formatin e id-se para se te pyesim databazen.
 * Id-ja e pavlefshme nuk duhet te kthej gabim 500 nga Prisma.
 */
function assertValidId(id) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new ApiError(400, 'Id e pavlefshme');
  }
}

/**
 * Pret te dhenat e furnitorit dhe kthen nje objekt qe permban vetem fushat e lejuara.
 * Fushat opsionale qe vijne bosh ('' ose null) ruhen si null.
 */
function buildSupplierData(data = {}) {
  const payload = {};

  if (data.name !== undefined) {
    payload.name = typeof data.name === 'string' ? data.name.trim() : data.name;
  }

  if (data.email !== undefined) {
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : data.email;
    payload.email = email === '' || email === null ? null : email;
  }

  if (data.phone !== undefined) {
    const phone = typeof data.phone === 'string' ? data.phone.trim() : data.phone;
    payload.phone = phone === '' || phone === null ? null : phone;
  }

  if (data.address !== undefined) {
    const address = typeof data.address === 'string' ? data.address.trim() : data.address;
    payload.address = address === '' || address === null ? null : address;
  }

  return payload;
}

/**
 * Kontroll i mbrojtjes ne nivel sherbimi: edhe nese rruga nuk perdor validimin,
 * furnitori nuk krijohet/nderrohet me emer bosh.
 */
function requireName(payload) {
  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    throw new ApiError(400, 'Emri eshte i detyrueshem');
  }
}

function handlePrismaError(error) {
  if (error.code === 'P2002') {
    throw new ApiError(409, DUPLICATE_EMAIL);
  }

  if (error.code === 'P2025') {
    throw new ApiError(404, SUPPLIER_NOT_FOUND);
  }

  throw error;
}

/**
 * Kthen vetem furnitoret e perdoruesit te kycur.
 */
async function list(userId) {
  assertValidId(userId);
  return prisma.supplier.findMany({
    where: { userId },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  });
}

/**
 * Kthen nje furnitor te perdoruesit te kycur ose 404.
 */
async function getById(userId, id) {
  assertValidId(userId);
  assertValidId(id);

  const supplier = await prisma.supplier.findFirst({
    where: { id, userId },
  });

  if (!supplier) {
    throw new ApiError(404, SUPPLIER_NOT_FOUND);
  }

  return supplier;
}

/**
 * Krijon nje furnitor te lidhur me perdoruesin e kycur.
 */
async function create(userId, data) {
  assertValidId(userId);
  const payload = buildSupplierData(data);
  requireName(payload);

  try {
    return await prisma.supplier.create({
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
 * Nderron te dhenat e nje furnitori te perdoruesit te kycur.
 * Furnitori i nje perdoruesi tjeter nuk mund te ndryshohet.
 */
async function update(userId, id, data) {
  assertValidId(id);
  await getById(userId, id);

  const payload = buildSupplierData(data);
  if (payload.name !== undefined) requireName(payload);

  try {
    return await prisma.supplier.update({
      where: { id, userId },
      data: payload,
    });
  } catch (error) {
    return handlePrismaError(error);
  }
}

/**
 * Fshin nje furnitor te perdoruesit te kycur.
 */
async function remove(userId, id) {
  assertValidId(id);
  await getById(userId, id);

  try {
    await prisma.supplier.delete({
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
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  ADDRESS_MAX_LENGTH,
};

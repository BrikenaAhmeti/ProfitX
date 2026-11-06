const NAME_MAX_LENGTH = 100;
const CATEGORY_TYPES = ['INCOME', 'EXPENSE'];

const TYPE_ALIASES = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  'TE ARDHURA': 'INCOME',
  'TE_ARDHURA': 'INCOME',
  SHPENZIM: 'EXPENSE',
  SHPENZIME: 'EXPENSE',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function normalizeType(type) {
  if (typeof type !== 'string') {
    return type;
  }

  const key = type.trim().toUpperCase().replace(/\s+/g, ' ');
  return TYPE_ALIASES[key] || TYPE_ALIASES[key.replace(/ /g, '_')] || key;
}

function validateName(name, errors) {
  if (isEmpty(name)) {
    errors.push({ field: 'name', message: 'Emri eshte i detyrueshem.' });
    return;
  }

  if (typeof name !== 'string') {
    errors.push({ field: 'name', message: 'Emri duhet te jete tekst.' });
    return;
  }

  if (name.trim().length > NAME_MAX_LENGTH) {
    errors.push({ field: 'name', message: 'Emri nuk mund te kete me shume se 100 karaktere.' });
  }
}

function validateType(type, errors) {
  if (isEmpty(type)) {
    errors.push({ field: 'type', message: 'Lloji eshte i detyrueshem.' });
    return;
  }

  if (typeof type !== 'string') {
    errors.push({ field: 'type', message: 'Lloji duhet te jete tekst.' });
    return;
  }

  const normalized = normalizeType(type);
  if (!CATEGORY_TYPES.includes(normalized)) {
    errors.push({
      field: 'type',
      message: 'Lloji duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE).',
    });
  }
}

function validateCategoryBody(body) {
  if (!isObject(body)) {
    return [{ field: 'body', message: 'Trupi i kerkeses duhet te jete nje objekt JSON.' }];
  }

  const errors = [];
  validateName(body.name, errors);
  validateType(body.type, errors);

  return errors;
}

/** POST /api/categories: emri dhe lloji jane te detyrueshem. */
function validateCreateCategory(body) {
  return validateCategoryBody(body);
}

/** PUT /api/categories/:id: e njejta kontrate si krijimi. */
function validateUpdateCategory(body) {
  return validateCategoryBody(body);
}

module.exports = {
  validateCreateCategory,
  validateUpdateCategory,
};

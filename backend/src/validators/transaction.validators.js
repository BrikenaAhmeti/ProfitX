const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_ALIASES = ['INCOME', 'EXPENSE', 'TE ARDHURA', 'TE_ARDHURA', 'SHPENZIM', 'SHPENZIME'];

function validDate(value) {
  // Accept an ISO date or timestamp with an explicit timezone, not locale-dependent dates.
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2})))?$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isFinite(calendar.getTime()) && calendar.getUTCFullYear() === Number(year)
    && calendar.getUTCMonth() + 1 === Number(month) && calendar.getUTCDate() === Number(day)
    && (hour === undefined || (Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60))
    && (offsetHour === undefined || (Number(offsetHour) < 24 && Number(offsetMinute) < 60))
    && Number.isFinite(Date.parse(value));
}

function validateTransactionBody(body, partial) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [{ field: 'body', message: 'Trupi i kerkeses duhet te jete nje objekt JSON.' }];
  }
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  if (!partial || body.amount !== undefined) {
    const amount = typeof body.amount === 'string' ? body.amount.trim() : body.amount;
    if ((typeof amount !== 'number' && typeof amount !== 'string') || amount === '') {
      add('amount', 'Shuma eshte e detyrueshme dhe duhet te jete numer pozitiv.');
    } else if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      add('amount', 'Shuma duhet te jete me e madhe se zero.');
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(amount)) || Number(amount) > 9999999999.99) {
      add('amount', 'Shuma duhet te kete maksimumi dy shifra pas presjes dhe te mos kaloje 9999999999.99.');
    }
  }

  if (!partial || body.type !== undefined) {
    const type = typeof body.type === 'string' ? body.type.trim().toUpperCase().replace(/\s+/g, ' ') : body.type;
    if (!TYPE_ALIASES.includes(type)) {
      add('type', 'Lloji eshte i detyrueshem dhe duhet te jete te ardhura (INCOME) ose shpenzim (EXPENSE).');
    }
  }

  for (const field of ['categoryId', 'clientId', 'supplierId']) {
    const value = typeof body[field] === 'string' ? body[field].trim() : body[field];
    if (field !== 'categoryId' && (value === undefined || value === null || value === '')) continue;
    if (partial && field === 'categoryId' && value === undefined) continue;
    if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
      add(field, field === 'categoryId' ? 'Kategoria eshte e detyrueshme dhe duhet te jete UUID e vlefshme.' : `${field} duhet te jete UUID e vlefshme.`);
    }
  }

  if (body.occurredAt !== undefined && !validDate(body.occurredAt)) {
    add('occurredAt', 'Data e transaksionit duhet te jete date ISO 8601 e vlefshme (p.sh. 2026-11-08 ose 2026-11-08T10:00:00Z).');
  }
  if (body.description !== undefined && body.description !== null
      && (typeof body.description !== 'string' || body.description.trim().length > 500)) {
    add('description', 'Pershkrimi duhet te jete tekst me maksimumi 500 karaktere.');
  }
  return errors;
}

function validateCreateTransaction(body) {
  return validateTransactionBody(body, false);
}

// Preserve the service contract: omitted fields remain unchanged on PUT.
function validateUpdateTransaction(body) {
  return validateTransactionBody(body, true);
}

module.exports = { validateCreateTransaction, validateUpdateTransaction };

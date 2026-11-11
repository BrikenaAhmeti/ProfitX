const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

function validateDecimal(value, field, label, pattern, max, errors) {
  const raw = typeof value === 'string' ? value.trim() : value;
  if ((typeof raw !== 'number' && typeof raw !== 'string') || raw === '') {
    errors.push({ field, message: `${label} eshte e detyrueshme dhe duhet te jete numer pozitiv.` });
  } else if (!Number.isFinite(Number(raw)) || Number(raw) <= 0) {
    errors.push({ field, message: `${label} duhet te jete me e madhe se zero.` });
  } else if (!pattern.test(String(raw)) || Number(raw) > max) {
    errors.push({ field, message: `${label} ka format ose vlere jashte kufijve te lejuar.` });
  }
}

// Datat ruhen si DATE: kontrollo kalendarin dhe krahaso diten ne UTC.
function parseDate(value) {
  if (typeof value !== 'string') return NaN;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2})))?$/.exec(text);
  if (!match) return NaN;

  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (calendar.getUTCFullYear() !== Number(year)
      || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)
      || (hour !== undefined && (Number(hour) >= 24 || Number(minute) >= 60 || Number(second) >= 60))
      || (offsetHour !== undefined && (Number(offsetHour) >= 24 || Number(offsetMinute) >= 60))) {
    return NaN;
  }

  return new Date(text).setUTCHours(0, 0, 0, 0);
}

function validateItems(items, errors) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ field: 'items', message: 'Fatura duhet te kete te pakten nje artikull.' });
    return;
  }

  items.forEach((item, index) => {
    const field = `items[${index}]`;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({ field, message: `Artikulli ${index + 1} duhet te jete objekt.` });
      return;
    }

    if (typeof item.description !== 'string' || !item.description.trim()) {
      errors.push({ field: `${field}.description`, message: 'Pershkrimi i artikullit eshte i detyrueshem.' });
    } else if (item.description.trim().length > 300) {
      errors.push({ field: `${field}.description`, message: 'Pershkrimi nuk mund te kete me shume se 300 karaktere.' });
    }

    // Sasia e munguar merr vleren 1 sipas modelit InvoiceItem.
    if (item.quantity !== undefined) {
      validateDecimal(item.quantity, `${field}.quantity`, 'Sasia', /^\d+(\.\d{1,3})?$/, 999999999.999, errors);
    }
    validateDecimal(item.unitPrice, `${field}.unitPrice`, 'Cmimi per njesi', /^\d+(\.\d{1,2})?$/, 9999999999.99, errors);
  });
}

function validateInvoiceBody(body, partial) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [{ field: 'body', message: 'Trupi i kerkeses duhet te jete nje objekt JSON.' }];
  }

  const errors = [];
  if (!partial || body.clientId !== undefined) {
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : body.clientId;
    if (typeof clientId !== 'string' || !UUID_REGEX.test(clientId)) {
      errors.push({ field: 'clientId', message: 'Klienti eshte i detyrueshem dhe duhet te kete UUID te vlefshme.' });
    }
  }

  if (!partial || body.invoiceNumber !== undefined) {
    if (typeof body.invoiceNumber !== 'string' || !body.invoiceNumber.trim()) {
      errors.push({ field: 'invoiceNumber', message: 'Numri i fatures eshte i detyrueshem.' });
    } else if (body.invoiceNumber.trim().length > 50) {
      errors.push({ field: 'invoiceNumber', message: 'Numri i fatures nuk mund te kete me shume se 50 karaktere.' });
    }
  }

  if (!partial || body.items !== undefined) validateItems(body.items, errors);

  if (body.status !== undefined
      && (typeof body.status !== 'string' || !INVOICE_STATUSES.includes(body.status.trim().toUpperCase()))) {
    errors.push({ field: 'status', message: `Statusi duhet te jete ${INVOICE_STATUSES.join(', ')}.` });
  }

  let issueDate = partial ? undefined : new Date().setUTCHours(0, 0, 0, 0);
  if (body.issueDate !== undefined) {
    issueDate = parseDate(body.issueDate);
    if (Number.isNaN(issueDate)) {
      errors.push({ field: 'issueDate', message: 'Data e leshimit duhet te jete date ISO 8601 e vlefshme.' });
    }
  }

  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== '') {
    const dueDate = parseDate(body.dueDate);
    if (Number.isNaN(dueDate)) {
      errors.push({ field: 'dueDate', message: 'Data e afatit duhet te jete date ISO 8601 e vlefshme.' });
    } else if (issueDate !== undefined && dueDate < issueDate) {
      errors.push({ field: 'dueDate', message: 'Afati nuk mund te jete para dates se leshimit.' });
    }
  }

  return errors;
}

function validateCreateInvoice(body) {
  return validateInvoiceBody(body, false);
}

// Ne PUT, fushat e paderguara ruhen; sherbimi kontrollon datat efektive.
function validateUpdateInvoice(body) {
  return validateInvoiceBody(body, true);
}

module.exports = { validateCreateInvoice, validateUpdateInvoice };

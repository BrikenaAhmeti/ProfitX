const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\s./-]+$/;

const NAME_MAX_LENGTH = 150;
const EMAIL_MAX_LENGTH = 255;
const PHONE_MAX_LENGTH = 30;
const ADDRESS_MAX_LENGTH = 300;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
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
    errors.push({ field: 'name', message: 'Emri nuk mund te kete me shume se 150 karaktere.' });
  }
}

function validateEmail(email, errors) {
  // Email-i eshte opsional per furnitorin; kontrollohet vetem kur dergohet.
  if (isEmpty(email)) return;

  if (typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email-i duhet te jete tekst.' });
    return;
  }

  const normalizedEmail = email.trim();
  if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
    errors.push({ field: 'email', message: 'Email-i nuk mund te kete me shume se 255 karaktere.' });
  } else if (!EMAIL_REGEX.test(normalizedEmail)) {
    errors.push({ field: 'email', message: 'Email-i nuk eshte ne format te vlefshem.' });
  }
}

function validatePhone(phone, errors) {
  // Telefoni eshte opsional.
  if (isEmpty(phone)) return;

  if (typeof phone !== 'string') {
    errors.push({ field: 'phone', message: 'Telefoni duhet te jete tekst.' });
    return;
  }

  const normalizedPhone = phone.trim();
  if (normalizedPhone.length > PHONE_MAX_LENGTH) {
    errors.push({ field: 'phone', message: 'Telefoni nuk mund te kete me shume se 30 karaktere.' });
  } else if (!PHONE_REGEX.test(normalizedPhone)) {
    errors.push({ field: 'phone', message: 'Telefoni permban karaktere te pavlefshme.' });
  }
}

function validateAddress(address, errors) {
  // Adresa eshte opsionale.
  if (isEmpty(address)) return;

  if (typeof address !== 'string') {
    errors.push({ field: 'address', message: 'Adresa duhet te jete tekst.' });
    return;
  }

  if (address.trim().length > ADDRESS_MAX_LENGTH) {
    errors.push({ field: 'address', message: 'Adresa nuk mund te kete me shume se 300 karaktere.' });
  }
}

function validateSupplierBody(body) {
  if (!isObject(body)) {
    return [{ field: 'body', message: 'Trupi i kerkeses duhet te jete nje objekt JSON.' }];
  }

  const errors = [];
  validateName(body.name, errors);
  validateEmail(body.email, errors);
  validatePhone(body.phone, errors);
  validateAddress(body.address, errors);

  return errors;
}

/** POST /api/suppliers: emri i detyrueshem, te tjerat opsionale. */
function validateCreateSupplier(body) {
  return validateSupplierBody(body);
}

/** PUT /api/suppliers/:id: e njejta kontrate si krijimi. */
function validateUpdateSupplier(body) {
  return validateSupplierBody(body);
}

module.exports = {
  validateCreateSupplier,
  validateUpdateSupplier,
};

const express = require('express');
const invoiceController = require('../controllers/invoice.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { validateCreateInvoice, validateUpdateInvoice } = require('../validators/invoice.validators');

const router = express.Router();

/** Te gjitha rrugut e faturave kerkojne token te vlefshem. */
router.use(authenticate);

router.get('/', invoiceController.list);
router.post('/', validate(validateCreateInvoice), invoiceController.create);
router.get('/:id', invoiceController.getById);
router.put('/:id', validate(validateUpdateInvoice), invoiceController.update);
router.delete('/:id', invoiceController.remove);

module.exports = router;

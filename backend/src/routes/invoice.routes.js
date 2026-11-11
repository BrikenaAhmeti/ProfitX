const express = require('express');
const invoiceController = require('../controllers/invoice.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

/** Te gjitha rrugut e faturave kerkojne token te vlefshem. */
router.use(authenticate);

router.get('/', invoiceController.list);
router.post('/', invoiceController.create);
router.get('/:id', invoiceController.getById);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.remove);

module.exports = router;

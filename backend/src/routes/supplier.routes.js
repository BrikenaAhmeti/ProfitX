const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { validateCreateSupplier, validateUpdateSupplier } = require('../validators/supplier.validators');

const router = express.Router();

/** Te gjitha rrugut e furnitoreve kerkojne token te vlefshem. */
router.use(authenticate);

router.get('/', supplierController.list);
router.post('/', validate(validateCreateSupplier), supplierController.create);
router.get('/:id', supplierController.getById);
router.put('/:id', validate(validateUpdateSupplier), supplierController.update);
router.delete('/:id', supplierController.remove);

module.exports = router;

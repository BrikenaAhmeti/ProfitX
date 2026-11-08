const express = require('express');
const transactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { validateCreateTransaction, validateUpdateTransaction } = require('../validators/transaction.validators');

const router = express.Router();

/** Te gjitha rrugut e transaksioneve kerkojne token te vlefshem. */
router.use(authenticate);

router.get('/', transactionController.list);
router.post('/', validate(validateCreateTransaction), transactionController.create);
router.get('/:id', transactionController.getById);
router.put('/:id', validate(validateUpdateTransaction), transactionController.update);
router.delete('/:id', transactionController.remove);

module.exports = router;

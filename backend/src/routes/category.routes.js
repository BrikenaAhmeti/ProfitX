const express = require('express');
const categoryController = require('../controllers/category.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { validateCreateCategory, validateUpdateCategory } = require('../validators/category.validators');

const router = express.Router();

/** Te gjitha rrugut e kategorive kerkojne token te vlefshem. */
router.use(authenticate);

router.get('/', categoryController.list);
router.post('/', validate(validateCreateCategory), categoryController.create);
router.get('/:id', categoryController.getById);
router.put('/:id', validate(validateUpdateCategory), categoryController.update);
router.delete('/:id', categoryController.remove);

module.exports = router;

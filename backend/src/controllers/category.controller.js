const categoryService = require('../services/category.service');

/**
 * GET /api/categories
 * Pergjigje sukses: vetem kategorite e perdoruesit te kycur.
 */
async function list(req, res, next) {
  try {
    const categories = await categoryService.list(req.user.id);

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/categories/:id
 */
async function getById(req, res, next) {
  try {
    const category = await categoryService.getById(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/categories
 * Pergjigje sukses: 201 dhe kategoria e krijuar.
 */
async function create(req, res, next) {
  try {
    const category = await categoryService.create(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: 'Kategoria u krijua me sukses',
      data: { category },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/categories/:id
 */
async function update(req, res, next) {
  try {
    const category = await categoryService.update(req.user.id, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Kategoria u perditesua me sukses',
      data: { category },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/categories/:id
 */
async function remove(req, res, next) {
  try {
    await categoryService.remove(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Kategoria u fshi me sukses',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};

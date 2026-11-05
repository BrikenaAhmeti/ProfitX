const supplierService = require('../services/supplier.service');

/**
 * GET /api/suppliers
 * Pergjigje sukses: vetem furnitoret e perdoruesit te kycur.
 */
async function list(req, res, next) {
  try {
    const suppliers = await supplierService.list(req.user.id);

    return res.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/suppliers/:id
 */
async function getById(req, res, next) {
  try {
    const supplier = await supplierService.getById(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      data: { supplier },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/suppliers
 * Pergjigje sukses: 201 dhe furnitori i krijuar.
 */
async function create(req, res, next) {
  try {
    const supplier = await supplierService.create(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: 'Furnitori u krijua me sukses',
      data: { supplier },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/suppliers/:id
 */
async function update(req, res, next) {
  try {
    const supplier = await supplierService.update(req.user.id, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Furnitori u perditesua me sukses',
      data: { supplier },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/suppliers/:id
 */
async function remove(req, res, next) {
  try {
    await supplierService.remove(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Furnitori u fshi me sukses',
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

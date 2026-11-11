const invoiceService = require('../services/invoice.service');

/**
 * GET /api/invoices
 * Pergjigje sukses: vetem faturat e perdoruesit te kycur, bashke me artikujt.
 */
async function list(req, res, next) {
  try {
    const invoices = await invoiceService.list(req.user.id);

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/invoices/:id
 */
async function getById(req, res, next) {
  try {
    const invoice = await invoiceService.getById(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/invoices
 * Pergjigje sukses: 201 dhe fatura e krijuar bashke me artikujt.
 */
async function create(req, res, next) {
  try {
    const invoice = await invoiceService.create(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: 'Fatura u krijua me sukses',
      data: { invoice },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/invoices/:id
 */
async function update(req, res, next) {
  try {
    const invoice = await invoiceService.update(req.user.id, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Fatura u perditesua me sukses',
      data: { invoice },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/invoices/:id
 */
async function remove(req, res, next) {
  try {
    await invoiceService.remove(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Fatura u fshi me sukses',
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

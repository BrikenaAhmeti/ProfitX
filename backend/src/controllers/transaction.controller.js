const transactionService = require('../services/transaction.service');

/**
 * GET /api/transactions
 * Pergjigje sukses: vetem transaksionet e perdoruesit te kycur.
 */
async function list(req, res, next) {
  try {
    const transactions = await transactionService.list(req.user.id);

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/transactions/:id
 */
async function getById(req, res, next) {
  try {
    const transaction = await transactionService.getById(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/transactions
 * Pergjigje sukses: 201 dhe transaksioni i krijuar.
 */
async function create(req, res, next) {
  try {
    const transaction = await transactionService.create(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      message: 'Transaksioni u krijua me sukses',
      data: { transaction },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PUT /api/transactions/:id
 */
async function update(req, res, next) {
  try {
    const transaction = await transactionService.update(req.user.id, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Transaksioni u perditesua me sukses',
      data: { transaction },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/transactions/:id
 */
async function remove(req, res, next) {
  try {
    await transactionService.remove(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Transaksioni u fshi me sukses',
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

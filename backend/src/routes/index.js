const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const clientRoutes = require('./client.routes');
const categoryRoutes = require('./category.routes');
const supplierRoutes = require('./supplier.routes');
const transactionRoutes = require('./transaction.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/transactions', transactionRoutes);

module.exports = router;

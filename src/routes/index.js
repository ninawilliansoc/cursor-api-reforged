const express = require('express');
const router = express.Router();
const v1Routes = require('./v1');
const cursorRoutes = require('./cursor');
const adminRoutes = require('./admin');

// API routes
router.use('/v1', v1Routes);
router.use('/cursor', cursorRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

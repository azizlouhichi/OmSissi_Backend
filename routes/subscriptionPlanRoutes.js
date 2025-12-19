const express = require('express');
const router = express.Router();
const {
  createPlan,
  getPlanById,
  updatePlanById,
  deletePlanById
} = require('../controllers/subscriptionController');

const { protectAdmin } = require('../middleware/authMiddleware');

// Admin-only CRUD for subscription plans
router.post('/', protectAdmin, createPlan);
router.get('/:id', protectAdmin, getPlanById);
router.put('/:id', protectAdmin, updatePlanById);
router.delete('/:id', protectAdmin, deletePlanById);

module.exports = router;

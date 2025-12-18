const express = require('express');
const router = express.Router();
const {
  // Auth APIs
  registerParent,
  loginParent,
  getParentProfile,
  
  // Admin APIs
  getAllParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
  getParentsStats,
  
  // Children Management APIs
  getParentChildren,
  addChildToParent,
  updateChild,
  deleteChild,
  switchToChild,
  switchBackToParent,
  getCurrentChildProfile
} = require('../controllers/parentController');

const { validateParentRegistration } = require('../middleware/validation');
const { protect } = require('../middleware/authMiddleware');

// ==================== PUBLIC ROUTES ====================
router.post('/register', validateParentRegistration, registerParent);
router.post('/login', loginParent);

// ==================== PROTECTED ROUTES (Parent only) ====================
router.get('/profile', protect, getParentProfile);
router.post('/switch-child/:childId', protect, switchToChild);
router.post('/switch-back', protect, switchBackToParent);
router.get('/current-child', protect, getCurrentChildProfile);

// ==================== ADMIN ROUTES ====================
// Parent management routes
router.get('/', getAllParents); // Fixed: Separate GET
router.post('/', createParent); // Fixed: Separate POST
router.get('/stats/overview', getParentsStats);

// Parent CRUD routes
router.get('/:id', getParentById);
router.put('/:id', updateParent);
router.delete('/:id', deleteParent);

// ==================== CHILDREN MANAGEMENT ROUTES (Admin only) ====================
router.get('/:parentId/children', getParentChildren);
router.post('/:parentId/children', addChildToParent);
router.put('/:parentId/children/:childId', updateChild);
router.delete('/:parentId/children/:childId', deleteChild);

module.exports = router;
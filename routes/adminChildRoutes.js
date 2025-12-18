const express = require('express');
const router = express.Router();
const {
  getAllChildren,
  getChildById,
  createChildAdmin,
  updateChildAdmin,
  deleteChildAdmin,
  getChildrenStats,
  getChildStoriesAdmin,
  getChildActivityAdmin
} = require('../controllers/adminChildController');
const { protect, protectAdmin } = require('../middleware/authMiddleware');

// All routes protected for admin
router.use(protect);
router.use(protectAdmin);

router.get('/all', getAllChildren);
router.post('/', createChildAdmin);
router.get('/stats', getChildrenStats);
router.get('/:id/stories', getChildStoriesAdmin);
router.get('/:id/activity', getChildActivityAdmin);
router.get('/:id', getChildById);
router.put('/:id', updateChildAdmin);
router.delete('/:id', deleteChildAdmin);

module.exports = router;

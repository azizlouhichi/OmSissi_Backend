const express = require('express');
const router = express.Router();
const {
  createStory,
  getStories,
  getStory,
  getStoriesByChild,
  updateStory,
  deleteStory
} = require('../controllers/storyController');
const { validateStoryCreation, validateStoryUpdate } = require('../middleware/storyValidation');
const { protect, protectParent } = require('../middleware/authMiddleware');

// ? Both parents and children can create stories
router.post('/', protect, validateStoryCreation, createStory);
// ? Parents can update/delete stories
router.put('/:id', protectParent, validateStoryUpdate, updateStory);
router.delete('/:id', protectParent, deleteStory);

// ? Both parents and children can read stories
router.get('/', protect, getStories);
router.get('/child/:childId', protect, getStoriesByChild);
router.get('/:id', protect, getStory);

module.exports = router;
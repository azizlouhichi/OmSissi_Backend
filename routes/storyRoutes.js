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
const { protect } = require('../middleware/authMiddleware');

// Toutes les routes protégées par l'authentification parent
router.use(protect);

router.post('/', validateStoryCreation, createStory);
router.get('/', getStories);
router.get('/child/:childId', getStoriesByChild);
router.get('/:id', getStory);
router.put('/:id', validateStoryUpdate, updateStory);
router.delete('/:id', deleteStory);

module.exports = router;
const express = require('express');
const router = express.Router();
const {
  createChild,
  getChildren,
  getChild,
  updateChild,
  deleteChild,
  getChildrenNames,
  getChildLinkCode,
  linkChildFromQr
} = require('../controllers/childController');
const { validateChildCreation, validateChildUpdate } = require('../middleware/childValidation');
const { protect } = require('../middleware/authMiddleware');

// Public route for child/tablet linking
router.post('/link-from-qr', linkChildFromQr);

// The following routes require authenticated parent (protect middleware)
router.get('/names', protect, getChildrenNames); // Doit être avant /:id
router.post('/', protect, validateChildCreation, createChild);
router.get('/', protect, getChildren);
router.get('/:id/link-code', protect, getChildLinkCode);
router.get('/:id', protect, getChild); // Cette route vient APRÈS /names
router.put('/:id', protect, validateChildUpdate, updateChild);
router.delete('/:id', protect, deleteChild);

module.exports = router;
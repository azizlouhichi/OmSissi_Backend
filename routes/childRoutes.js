const express = require('express');
const router = express.Router();
const {
  createChild,
  getChildren,
  getChild,
  updateChild,
  deleteChild,
  getChildrenNames
  ,getChildLinkCode
  ,linkChildFromQr
} = require('../controllers/childController');
const { validateChildCreation, validateChildUpdate } = require('../middleware/childValidation');
const { protect } = require('../middleware/authMiddleware');
router.post('/link-from-qr', linkChildFromQr);
// Toutes les routes protégées par l'authentification parent
router.use(protect);

router.get('/names', getChildrenNames); // Doit être avant /:id
router.post('/', validateChildCreation, createChild);
router.get('/', getChildren);
router.get('/:id/link-code', getChildLinkCode);
router.get('/:id', getChild); // Cette route vient APRÈS /names
router.put('/:id', validateChildUpdate, updateChild);
router.delete('/:id', deleteChild);

module.exports = router;
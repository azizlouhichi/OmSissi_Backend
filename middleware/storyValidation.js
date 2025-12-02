const { body, validationResult } = require('express-validator');

const validateStoryCreation = [
  body('childId')
    .notEmpty()
    .withMessage('L\'ID de l\'enfant est requis')
    .isMongoId()
    .withMessage('ID enfant invalide'),
  
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Le titre est requis')
    .isLength({ min: 1, max: 200 })
    .withMessage('Le titre doit contenir entre 1 et 200 caractères'),
  
  body('pages')
    .isArray({ min: 1 })
    .withMessage('Les pages doivent être un tableau non vide'),
  
  body('pages.*')
    .trim()
    .notEmpty()
    .withMessage('Chaque page doit contenir du texte'),
  
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Les mots-clés doivent être un tableau'),
  
  body('keywords.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Chaque mot-clé ne peut pas dépasser 50 caractères'),
  
  body('language')
    .optional()
    .isIn(['fr', 'ar', 'en'])
    .withMessage('Langue non valide (fr, ar, en)'),
  
  body('source')
    .optional()
    .isIn(['ai', 'manual'])
    .withMessage('Source non valide (ai, manual)'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation échouée',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateStoryUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Le titre doit contenir entre 1 et 200 caractères'),
  
  body('pages')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Les pages doivent être un tableau non vide'),
  
  body('pages.*')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Chaque page doit contenir du texte'),
  
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Les mots-clés doivent être un tableau'),
  
  body('language')
    .optional()
    .isIn(['fr', 'ar', 'en'])
    .withMessage('Langue non valide'),
  
  body('source')
    .optional()
    .isIn(['ai', 'manual'])
    .withMessage('Source non valide'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation échouée',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateStoryCreation,
  validateStoryUpdate
};
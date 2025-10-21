const { body, validationResult } = require('express-validator');

const validateChildCreation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ min: 1, max: 50 })
    .withMessage('Le prénom doit contenir entre 1 et 50 caractères'),
  
  body('age')
    .isInt({ min: 0, max: 18 })
    .withMessage('L\'âge doit être entre 0 et 18 ans'),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_specified'])
    .withMessage('Genre non valide'),
  
  body('preferredLanguages')
    .optional()
    .isArray()
    .withMessage('Les langues doivent être un tableau'),
  
  body('preferredLanguages.*')
    .isIn(['arabe', 'français', 'anglais'])
    .withMessage('Langue non valide'),
  
  body('interests')
    .optional()
    .isArray()
    .withMessage('Les centres d\'intérêt doivent être un tableau'),
  
  body('interests.*')
    .isIn([
      'animaux', 'aventure', 'héros', 'science', 'amitié', 
      'magie', 'histoire', 'valeurs', 'musique', 'sport'
    ])
    .withMessage('Centre d\'intérêt non valide'),
  
  body('readingLevel')
    .optional()
    .isIn(['débutant', 'intermédiaire', 'avancé'])
    .withMessage('Niveau de lecture non valide'),
  
  body('preferredVoice')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La voix préférée ne peut pas dépasser 50 caractères'),
  
  body('safeMode')
    .optional()
    .isBoolean()
    .withMessage('Le mode sécurisé doit être un booléen'),
  
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

const validateChildUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Le prénom doit contenir entre 1 et 50 caractères'),
  
  body('age')
    .optional()
    .isInt({ min: 0, max: 18 })
    .withMessage('L\'âge doit être entre 0 et 18 ans'),
  
  // ... autres validations similaires mais optionnelles
];

module.exports = {
  validateChildCreation,
  validateChildUpdate
};
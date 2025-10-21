const Child = require('../models/Child');
const Parent = require('../models/Parent');

// @desc    Créer un profil enfant
// @route   POST /api/children
// @access  Private (Parent)
const createChild = async (req, res) => {
  try {
    const {
      firstName,
      age,
      gender = 'non_specified',
      preferredLanguages = [],
      interests = [],
      readingLevel = 'débutant',
      preferredVoice = 'Om Sisi',
      safeMode = true
    } = req.body;

    // Vérifier que le parent existe
    const parent = await Parent.findById(req.parent._id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent non trouvé'
      });
    }

    // Créer le profil enfant
    const child = await Child.create({
      parentId: req.parent._id,
      firstName,
      age,
      gender,
      preferredLanguages,
      interests,
      readingLevel,
      preferredVoice,
      safeMode
    });

    // Ajouter la référence à l'enfant dans le profil parent
    await Parent.findByIdAndUpdate(
      req.parent._id,
      { $push: { childrenProfiles: child._id } }
    );

    res.status(201).json({
      success: true,
      message: 'Profil enfant créé avec succès',
      data: child
    });

  } catch (error) {
    console.error('Erreur création enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du profil enfant',
      error: error.message
    });
  }
};

// @desc    Obtenir tous les profils enfants d'un parent
// @route   GET /api/children
// @access  Private (Parent)
const getChildren = async (req, res) => {
  try {
    const children = await Child.find({ parentId: req.parent._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: children.length,
      data: children
    });

  } catch (error) {
    console.error('Erreur récupération enfants:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des profils enfants',
      error: error.message
    });
  }
};

// @desc    Obtenir un profil enfant spécifique
// @route   GET /api/children/:id
// @access  Private (Parent)
const getChild = async (req, res) => {
  try {
    const child = await Child.findOne({
      _id: req.params.id,
      parentId: req.parent._id
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Profil enfant non trouvé'
      });
    }

    res.json({
      success: true,
      data: child
    });

  } catch (error) {
    console.error('Erreur récupération enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du profil enfant',
      error: error.message
    });
  }
};

// @desc    Mettre à jour un profil enfant
// @route   PUT /api/children/:id
// @access  Private (Parent)
const updateChild = async (req, res) => {
  try {
    const child = await Child.findOneAndUpdate(
      {
        _id: req.params.id,
        parentId: req.parent._id
      },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Profil enfant non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Profil enfant mis à jour avec succès',
      data: child
    });

  } catch (error) {
    console.error('Erreur mise à jour enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du profil enfant',
      error: error.message
    });
  }
};

// @desc    Supprimer un profil enfant
// @route   DELETE /api/children/:id
// @access  Private (Parent)
const deleteChild = async (req, res) => {
  try {
    const child = await Child.findOneAndDelete({
      _id: req.params.id,
      parentId: req.parent._id
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Profil enfant non trouvé'
      });
    }

    // Retirer la référence de l'enfant du profil parent
    await Parent.findByIdAndUpdate(
      req.parent._id,
      { $pull: { childrenProfiles: req.params.id } }
    );

    res.json({
      success: true,
      message: 'Profil enfant supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression du profil enfant',
      error: error.message
    });
  }
};
// @desc    Obtenir les noms des enfants pour l'accueil
// @route   GET /api/children/names
// @access  Private (Parent)
const getChildrenNames = async (req, res) => {
  try {
    console.log('Récupération des noms des enfants pour le parent ID:', req.parent._id);
    const children = await Child.find({ parentId: req.parent._id })
      .select('firstName _id') // Seulement le prénom et l'ID
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: children.map(child => ({
        id: child._id,
        name: child.firstName,
        emoji: _getChildEmoji(child.firstName) // Optionnel: emoji basé sur le nom
      }))
    });

  } catch (error) {
    console.error('Erreur récupération noms enfants:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des noms enfants',
      error: error.message
    });
  }
};

// Helper pour assigner un emoji basé sur le nom (optionnel)
const _getChildEmoji = (name) => {
  const emojis = ['🦊', '🐣', '🐻', '🐰', '🐯', '🐨', '🐼', '🐙', '🦁', '🐸'];
  const index = name.length % emojis.length;
  return emojis[index];
};

module.exports = {
  createChild,
  getChildren,
  getChild,
  updateChild,
  deleteChild,
  getChildrenNames // ← Ajouter cette ligne
};
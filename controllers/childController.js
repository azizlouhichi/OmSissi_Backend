const { generateLinkCode } = require('../middleware/helper');
const Child = require('../models/Child');
const Parent = require('../models/Parent');
const jwt = require('jsonwebtoken');

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
    console.log(req)

    // Vérifier que le parent existe
    const parent = await Parent.findById(req.parent._id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent non trouvé'
      });
    }

    // 🔶 Générer un code de liaison + expiration optionnelle
    const linkCode = generateLinkCode();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // ex: valide 7 jours

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
      safeMode,
      linkCode,
      linkExpiresAt: expires,
    });

    // Ajouter la référence à l'enfant dans le profil parent
    await Parent.findByIdAndUpdate(
      req.parent._id,
      { $push: { childrenProfiles: child._id } }
    );

    res.status(201).json({
      success: true,
      message: 'Profil enfant créé avec succès',
      data: child,
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
console.log(req)
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
    let child;

    // If parent is viewing as child, allow access to the specific child
    if (req.userType === 'child_session') {
      child = await Child.findOne({
        _id: req.params.id,
        parentId: req.parent._id
      });
    }
    // If regular parent, verify child belongs to them
    else {
      child = await Child.findOne({
        _id: req.params.id,
        parentId: req.parent._id
      });
    }

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
// @desc    Récupérer le code de liaison (pour QR) d'un enfant
// @route   GET /api/children/:id/link-code
// @access  Private (Parent)
const getChildLinkCode = async (req, res) => {
  try {
    const child = await Child.findOne({
      _id: req.params.id,
      parentId: req.parent._id, // sécurité : l’enfant doit appartenir au parent
    }).select('firstName linkCode linkExpiresAt');

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Profil enfant non trouvé',
      });
    }

    // Option : regénérer un code s’il est expiré
    const now = new Date();
    if (!child.linkCode || (child.linkExpiresAt && child.linkExpiresAt < now)) {
      child.linkCode = generateLinkCode();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      child.linkExpiresAt = expires;
      await child.save();
    }

    // Tu peux décider du format pour le QR.
    // Ex simple : juste le code.
    // Ex plus évolué : "OMSISI:${child.linkCode}"
    const payloadForQr = `OMSISI:${child.linkCode}`;

    res.json({
      success: true,
      data: {
        childId: child._id,
        name: child.firstName,
        linkCode: child.linkCode,
        linkExpiresAt: child.linkExpiresAt,
        qrData: payloadForQr,
      },
    });

  } catch (error) {
    console.error('Erreur getChildLinkCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du code de liaison',
      error: error.message,
    });
  }
};
// @desc    Lier une tablette enfant via un QR code
// @route   POST /api/children/link-from-qr
// @access  Public (app enfant)
const linkChildFromQr = async (req, res) => {
  try {
    const { qrData, linkCode } = req.body || {};

    // 1) Récupérer le code à partir de qrData ou linkCode
    let code = linkCode || '';
console.log('Données reçues pour la liaison depuis QR:', req.body);
    if (!code && qrData) {
      if (typeof qrData !== 'string' || !qrData.startsWith('OMSISI:')) {
        return res.status(400).json({
          success: false,
          message: 'Format de code QR invalide',
        });
      }
      code = qrData.substring('OMSISI:'.length).trim();
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Aucun code de liaison fourni',
      });
    }

    // 2) Trouver l’enfant correspondant
    const child = await Child.findOne({ linkCode: code }).populate(
      'parentId',
      'firstName lastName email'
    );

    if (!child) {
      return res.status(400).json({
        success: false,
        message: 'Ce code ne correspond à aucun profil enfant',
      });
    }

    // 3) Vérifier la date d’expiration
    const now = new Date();
    if (child.linkExpiresAt && child.linkExpiresAt < now) {
      return res.status(400).json({
        success: false,
        message:
          'Ce code a expiré. Demande à ton parent de régénérer un nouveau code.',
      });
    }

    // 4) Générer un token "enfant"
    const payload = {
      childId: child._id,
      parentId: child.parentId?._id,
      role: 'child',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '30d', // par ex.
    });

    // 5) Retourner les infos nécessaires
    return res.json({
      success: true,
      message: 'Tablette liée avec succès à ce profil enfant',
      data: {
        token,
        child: {
          id: child._id,
          firstName: child.firstName,
          age: child.age,
          gender: child.gender,
          readingLevel: child.readingLevel,
          safeMode: child.safeMode,
        },
        parent: child.parentId
          ? {
              id: child.parentId._id,
              firstName: child.parentId.firstName,
              lastName: child.parentId.lastName,
              email: child.parentId.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Erreur linkChildFromQr:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la liaison de la tablette',
      error: error.message,
    });
  }
};


module.exports = {
  createChild,
  getChildren,
  getChild,
  updateChild,
  deleteChild,
  getChildrenNames ,
  getChildLinkCode,
  linkChildFromQr,
};
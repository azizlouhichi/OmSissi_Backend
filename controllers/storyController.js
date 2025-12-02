const Story = require('../models/Story');
const Child = require('../models/Child');

// @desc    Créer une nouvelle histoire
// @route   POST /api/stories
// @access  Private (Parent)
const createStory = async (req, res) => {
  try {
    const { childId, title, pages, keywords, language, source } = req.body;

    // Vérifier que l'enfant existe et appartient au parent
    const child = await Child.findOne({
      _id: childId,
      parentId: req.parent._id
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Enfant non trouvé ou non autorisé'
      });
    }

    // Créer l'histoire
    const story = await Story.create({
      childId,
      parentId: req.parent._id,
      title,
      pages,
      keywords: keywords || [],
      language: language || 'fr',
      source: source || 'ai'
    });

    res.status(201).json({
      success: true,
      message: 'Histoire créée avec succès',
      data: story
    });

  } catch (error) {
    console.error('Erreur création histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de l\'histoire',
      error: error.message
    });
  }
};

// @desc    Obtenir toutes les histoires
// @route   GET /api/stories
// @access  Private (Parent or Child)
const getStories = async (req, res) => {
  try {
    const { childId, limit = 20, page = 1 } = req.query;

    let query = {};
    
    // If child token, only show their stories
    if (req.userType === 'child') {
      query.childId = req.child._id;
    } 
    // If parent token, show all their children's stories
    else if (req.userType === 'parent') {
      query.parentId = req.parent._id;
      if (childId) {
        query.childId = childId;
      }
    }

    const stories = await Story.find(query)
      .populate('childId', 'firstName age')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Story.countDocuments(query);

    res.json({
      success: true,
      count: stories.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: stories
    });

  } catch (error) {
    console.error('Erreur récupération histoires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des histoires',
      error: error.message
    });
  }
};

// @desc    Obtenir une histoire spécifique
// @route   GET /api/stories/:id
// @access  Private (Parent or Child)
const getStory = async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Child can only see their own stories
    if (req.userType === 'child') {
      query.childId = req.child._id;
    } 
    // Parent can see all their children's stories
    else if (req.userType === 'parent') {
      query.parentId = req.parent._id;
    }

    const story = await Story.findOne(query).populate('childId', 'firstName age gender');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Histoire non trouvée'
      });
    }

    res.json({
      success: true,
      data: story
    });

  } catch (error) {
    console.error('Erreur récupération histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'histoire',
      error: error.message
    });
  }
};

// @desc    Obtenir les histoires d'un enfant spécifique
// @route   GET /api/stories/child/:childId
// @access  Private (Parent or Child)
const getStoriesByChild = async (req, res) => {
  try {
    const { childId } = req.params;

    // If child token, they can only see their own stories
    if (req.userType === 'child' && req.child._id.toString() !== childId) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    // If parent token, verify child belongs to them
    if (req.userType === 'parent') {
      const child = await Child.findOne({
        _id: childId,
        parentId: req.parent._id
      });

      if (!child) {
        return res.status(404).json({
          success: false,
          message: 'Enfant non trouvé ou non autorisé'
        });
      }
    }

    const stories = await Story.find({ childId })
      .sort({ createdAt: -1 })
      .populate('childId', 'firstName age');

    res.json({
      success: true,
      count: stories.length,
      data: stories
    });

  } catch (error) {
    console.error('Erreur récupération histoires enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des histoires',
      error: error.message
    });
  }
};

// @desc    Mettre à jour une histoire
// @route   PUT /api/stories/:id
// @access  Private (Parent)
const updateStory = async (req, res) => {
  try {
    const story = await Story.findOneAndUpdate(
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

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Histoire non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Histoire mise à jour avec succès',
      data: story
    });

  } catch (error) {
    console.error('Erreur mise à jour histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour de l\'histoire',
      error: error.message
    });
  }
};

// @desc    Supprimer une histoire
// @route   DELETE /api/stories/:id
// @access  Private (Parent)
const deleteStory = async (req, res) => {
  try {
    const story = await Story.findOneAndDelete({
      _id: req.params.id,
      parentId: req.parent._id
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Histoire non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Histoire supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de l\'histoire',
      error: error.message
    });
  }
};

module.exports = {
  createStory,
  getStories,
  getStory,
  getStoriesByChild,
  updateStory,
  deleteStory
};
const Story = require('../models/Story');
const Child = require('../models/Child');

// @desc    Cr�er une nouvelle histoire
// @route   POST /api/stories
// @access  Private (Parent or Child)
const createStory = async (req, res) => {
  try {
    const { childId, title, pages, keywords, language, source } = req.body;

    let parentId, targetChildId;

    // Check if it's a child creating their own story
    if (req.child) {
      // Child can only create stories for themselves
      if (childId && childId !== req.child._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez cr�er des histoires que pour vous-m�me'
        });
      }

      targetChildId = req.child._id;
      parentId = req.child.parentId;

    } else if (req.parent) {
      // Parent creating a story for their child
      if (!childId) {
        return res.status(400).json({
          success: false,
          message: 'L\'ID de l\'enfant est requis'
        });
      }

      // Verify child exists and belongs to parent
      const child = await Child.findOne({
        _id: childId,
        parentId: req.parent._id
      });

      if (!child) {
        return res.status(404).json({
          success: false,
          message: 'Enfant non trouv� ou non autoris�'
        });
      }

      targetChildId = child._id;
      parentId = req.parent._id;

    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    // Create the story
    const story = await Story.create({
      childId: targetChildId,
      parentId: parentId,
      title,
      pages,
      keywords: keywords || [],
      language: language || 'fr',
      source: source || 'manual'
    });

    res.status(201).json({
      success: true,
      message: 'Histoire cr��e avec succ�s',
      data: story
    });

  } catch (error) {
    console.error('Erreur cr�ation histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la cr�ation de l\'histoire',
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
    // If parent viewing as child (child session)
    else if (req.userType === 'child_session') {
      // Only show stories for the specific child being viewed as
      query.childId = req.child._id;
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
    console.error('Erreur r�cup�ration histoires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la r�cup�ration des histoires',
      error: error.message
    });
  }
};

// @desc    Obtenir une histoire sp�cifique
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
    // Parent viewing as child can only see the child's stories
    else if (req.userType === 'child_session') {
      query.childId = req.child._id;
    }

    const story = await Story.findOne(query).populate('childId', 'firstName age gender');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Histoire non trouv�e'
      });
    }

    res.json({
      success: true,
      data: story
    });

  } catch (error) {
    console.error('Erreur r�cup�ration histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la r�cup�ration de l\'histoire',
      error: error.message
    });
  }
};

// @desc    Obtenir les histoires d'un enfant sp�cifique
// @route   GET /api/stories/child/:childId
// @access  Private (Parent or Child)
const getStoriesByChild = async (req, res) => {
  try {
    const { childId } = req.params;

    // If child token, they can only see their own stories
    if (req.userType === 'child' && req.child._id.toString() !== childId) {
      return res.status(403).json({
        success: false,
        message: 'Acc�s refus�'
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
          message: 'Enfant non trouv� ou non autoris�'
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
    console.error('Erreur r�cup�ration histoires enfant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la r�cup�ration des histoires',
      error: error.message
    });
  }
};

// @desc    Mettre � jour une histoire
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
        message: 'Histoire non trouv�e'
      });
    }

    res.json({
      success: true,
      message: 'Histoire mise � jour avec succ�s',
      data: story
    });

  } catch (error) {
    console.error('Erreur mise � jour histoire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise � jour de l\'histoire',
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
        message: 'Histoire non trouv�e'
      });
    }

    res.json({
      success: true,
      message: 'Histoire supprim�e avec succ�s'
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
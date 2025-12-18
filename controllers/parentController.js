const Parent = require('../models/Parent');
const Child = require('../models/Child');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new parent
// @route   POST /api/parents/register
// @access  Public
const registerParent = async (req, res) => {
  try {
    const { firstName, lastName, email, password, parentalPIN, acceptedTerms } = req.body;

    // Check if parent already exists
    const parentExists = await Parent.findOne({ email });
    if (parentExists) {
      return res.status(400).json({
        success: false,
        message: 'Parent already exists with this email'
      });
    }

    // Create new parent
    const parent = await Parent.create({
      firstName,
      lastName,
      email,
      password,
      parentalPIN,
      acceptedTerms: acceptedTerms === 'true'
    });

    if (parent) {
      res.status(201).json({
        success: true,
        message: 'Parent account created successfully',
        data: {
          _id: parent._id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          token: generateToken(parent._id)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid parent data'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login parent
// @route   POST /api/parents/login
// @access  Public
const loginParent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for parent
    const parent = await Parent.findOne({ email });
    if (parent && (await parent.checkPassword(password))) {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: parent._id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          token: generateToken(parent._id)
        }
      });
      console.log(`Parent logged in: ${res}`);
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get parent profile
// @route   GET /api/parents/profile
// @access  Private
const getParentProfile = async (req, res) => {
  try {
    const parent = await Parent.findById(req.parent._id).select('-password -parentalPIN');
    
    if (parent) {
      res.json({
        success: true,
        data: parent
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// ==================== ADMIN APIs ====================

// @desc    Get all parents (Admin)
// @route   GET /api/parents
// @access  Private/Admin
const getAllParents = async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      subscription = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
      includeChildren = 'false'
    } = req.query;

    // Build query
    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }

    // Subscription filter
    if (subscription && subscription !== 'all') {
      query.subscription = subscription;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Populate options
    const populateOptions = includeChildren === 'true' 
      ? { path: 'childrenProfiles', select: 'firstName lastName birthDate gender grade' }
      : '';

    // Execute query
    const parents = await Parent.find(query)
      .select('-password -parentalPIN')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate(populateOptions)
      .lean();

    // Count total for pagination
    const total = await Parent.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: parents,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get all parents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching parents'
    });
  }
};

// @desc    Get parent by ID (Admin)
// @route   GET /api/parents/:id
// @access  Private/Admin
const getParentById = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id)
      .select('-password -parentalPIN')
      .populate('childrenProfiles');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: parent
    });

  } catch (error) {
    console.error('Get parent by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching parent'
    });
  }
};

// @desc    Update parent (Admin)
// @route   PUT /api/parents/:id
// @access  Private/Admin
const updateParent = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      subscription,
      isActive,
      maxChildren
    } = req.body;

    // Check if parent exists
    let parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check if email is already used by another parent
    if (email && email !== parent.email) {
      const existingParent = await Parent.findOne({ email });
      if (existingParent) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(subscription && { subscription }),
      ...(isActive !== undefined && { isActive }),
      ...(maxChildren && { maxChildren })
    };

    // Update parent
    parent = await Parent.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -parentalPIN').populate('childrenProfiles');

    res.status(200).json({
      success: true,
      message: 'Parent updated successfully',
      data: parent
    });

  } catch (error) {
    console.error('Update parent error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating parent'
    });
  }
};

// @desc    Delete parent (Admin)
// @route   DELETE /api/parents/:id
// @access  Private/Admin
const deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Delete all children profiles first
    await Child.deleteMany({ parentId: req.params.id });

    // Delete parent
    await Parent.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Parent deleted successfully'
    });

  } catch (error) {
    console.error('Delete parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting parent'
    });
  }
};

// @desc    Get parents statistics (Admin)
// @route   GET /api/parents/stats/overview
// @access  Private/Admin
const getParentsStats = async (req, res) => {
  try {
    const totalParents = await Parent.countDocuments();
    const activeParents = await Parent.countDocuments({ isActive: true });
    const premiumParents = await Parent.countDocuments({ subscription: 'Premium' });
    
    // Parents created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await Parent.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Total children count
    const totalChildren = await Child.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        total: totalParents,
        active: activeParents,
        premium: premiumParents,
        newThisMonth,
        totalChildren
      }
    });

  } catch (error) {
    console.error('Get parents stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
};

// @desc    Create parent (Admin)
// @route   POST /api/parents
// @access  Private/Admin
const createParent = async (req, res) => {
  try {
    const { firstName, lastName, email, password, parentalPIN, phone, subscription, children } = req.body;

    // Check if parent already exists
    const parentExists = await Parent.findOne({ email });
    if (parentExists) {
      return res.status(400).json({
        success: false,
        message: 'Parent already exists with this email'
      });
    }

    // Create new parent
    const parent = await Parent.create({
      firstName,
      lastName,
      email,
      password,
      parentalPIN,
      phone,
      subscription: subscription || 'Basic',
      acceptedTerms: true // Admin creation assumes terms accepted
    });

    // Create children if provided
    if (children && children.length > 0) {
      const validChildren = children.filter(child => 
        child.firstName && child.firstName.trim() && child.lastName && child.lastName.trim()
      );
      
      if (validChildren.length > 0) {
        const childrenData = validChildren.map(child => ({
          ...child,
          parentId: parent._id
        }));
        
        const createdChildren = await Child.insertMany(childrenData);
        
        // Link children to parent
        parent.childrenProfiles = createdChildren.map(child => child._id);
        await parent.save();
      }
    }

    const parentResponse = await Parent.findById(parent._id)
      .select('-password -parentalPIN')
      .populate('childrenProfiles');

    res.status(201).json({
      success: true,
      message: 'Parent created successfully',
      data: parentResponse
    });

  } catch (error) {
    console.error('Create parent error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Parent already exists with this email'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating parent'
    });
  }
};

// ==================== CHILDREN MANAGEMENT APIs ====================

// @desc    Get children of a parent (Admin)
// @route   GET /api/parents/:parentId/children
// @access  Private/Admin
const getParentChildren = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    const children = await Child.find({ parentId: parentId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: children
    });

  } catch (error) {
    console.error('Get parent children error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching children'
    });
  }
};

// @desc    Add child to parent (Admin)
// @route   POST /api/parents/:parentId/children
// @access  Private/Admin
const addChildToParent = async (req, res) => {
  try {
    const { parentId } = req.params;
    const childData = req.body;

    // Check if parent exists
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check if parent has reached max children limit
    const currentChildrenCount = await Child.countDocuments({ parentId: parentId });
    if (currentChildrenCount >= parent.maxChildren) {
      return res.status(400).json({
        success: false,
        message: `Parent has reached the maximum limit of ${parent.maxChildren} children`
      });
    }

    // Calculate age from birthDate if not provided
    if (childData.birthDate && !childData.age) {
      const birthDate = new Date(childData.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      childData.age = age;
    }

    // Ensure parentId is set correctly
    childData.parentId = parentId;

    // Create child
    const child = await Child.create(childData);

    // Add child to parent's childrenProfiles array
    parent.childrenProfiles.push(child._id);
    await parent.save();

    const populatedChild = await Child.findById(child._id);

    res.status(201).json({
      success: true,
      message: 'Child added successfully',
      data: populatedChild
    });

  } catch (error) {
    console.error('Add child to parent error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while adding child'
    });
  }
};

// @desc    Update child (Admin)
// @route   PUT /api/parents/:parentId/children/:childId
// @access  Private/Admin
const updateChild = async (req, res) => {
  try {
    const { parentId, childId } = req.params;
    const updateData = req.body;

    // Check if child exists and belongs to parent
    const child = await Child.findOne({ _id: childId, parentId: parentId });
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or does not belong to this parent'
      });
    }

    // Update child
    const updatedChild = await Child.findByIdAndUpdate(
      childId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Child updated successfully',
      data: updatedChild
    });

  } catch (error) {
    console.error('Update child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating child'
    });
  }
};

// @desc    Delete child (Admin)
// @route   DELETE /api/parents/:parentId/children/:childId
// @access  Private/Admin
const deleteChild = async (req, res) => {
  try {
    const { parentId, childId } = req.params;

    // Check if child exists and belongs to parent
    const child = await Child.findOne({ _id: childId, parentId: parentId });
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or does not belong to this parent'
      });
    }

    // Remove child from parent's childrenProfiles array
    await Parent.findByIdAndUpdate(parentId, {
      $pull: { childrenProfiles: childId }
    });

    // Delete child
    await Child.findByIdAndDelete(childId);

    res.status(200).json({
      success: true,
      message: 'Child deleted successfully'
    });

  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting child'
    });
  }
};


module.exports = {
  registerParent,
  loginParent,
  getParentProfile,
  // Admin APIs
  getAllParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
  getParentsStats,

  // Children Management APIs
  getParentChildren,
  addChildToParent,
  updateChild,
  deleteChild

};
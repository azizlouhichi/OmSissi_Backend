const Child = require('../models/Child');
const Parent = require('../models/Parent');
const Story = require('../models/Story');

// GET /api/admin/children - list all children (with optional filters)
const getAllChildren = async (req, res) => {
  try {
    const { parentId, name, gender, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (parentId) filter.parentId = parentId;
    if (name) filter.firstName = new RegExp(name, 'i');
    if (gender) filter.gender = gender;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    const [items, total] = await Promise.all([
      Child.find(filter).populate('parentId', 'firstName lastName email').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
      Child.countDocuments(filter)
    ]);

    res.json({ success: true, count: total, data: items });
  } catch (error) {
    console.error('Admin getAllChildren error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/admin/children/:id
const getChildById = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id).populate('parentId', 'firstName lastName email');
    if (!child) return res.status(404).json({ success: false, message: 'Child not found' });
    res.json({ success: true, data: child });
  } catch (error) {
    console.error('Admin getChildById error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST /api/admin/children - create a child (admin may specify parentId)
const createChildAdmin = async (req, res) => {
  try {
    const { parentId, firstName, age, gender } = req.body;
    if (!parentId) return res.status(400).json({ success: false, message: 'parentId is required' });
    const parent = await Parent.findById(parentId);
    if (!parent) return res.status(404).json({ success: false, message: 'Parent not found' });

    const child = await Child.create({ parentId, firstName, age, gender });
    parent.childrenProfiles = parent.childrenProfiles || [];
    parent.childrenProfiles.push(child._id);
    await parent.save();

    res.status(201).json({ success: true, data: child });
  } catch (error) {
    console.error('Admin createChild error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PUT /api/admin/children/:id
const updateChildAdmin = async (req, res) => {
  try {
    const child = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!child) return res.status(404).json({ success: false, message: 'Child not found' });
    res.json({ success: true, data: child });
  } catch (error) {
    console.error('Admin updateChild error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE /api/admin/children/:id
const deleteChildAdmin = async (req, res) => {
  try {
    const child = await Child.findByIdAndDelete(req.params.id);
    if (!child) return res.status(404).json({ success: false, message: 'Child not found' });
    // Remove reference from parent
    await Parent.findByIdAndUpdate(child.parentId, { $pull: { childrenProfiles: child._id } });
    res.json({ success: true, message: 'Child deleted' });
  } catch (error) {
    console.error('Admin deleteChild error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/admin/children/stats
const getChildrenStats = async (req, res) => {
  try {
    const total = await Child.countDocuments();
    const byGender = await Child.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);
    const byReading = await Child.aggregate([
      { $group: { _id: '$readingLevel', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { total, byGender, byReading } });
  } catch (error) {
    console.error('Admin getChildrenStats error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/admin/children/:id/stories
const getChildStoriesAdmin = async (req, res) => {
  try {
    const stories = await Story.find({ childId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, count: stories.length, data: stories });
  } catch (error) {
    console.error('Admin getChildStories error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET /api/admin/children/:id/activity
const getChildActivityAdmin = async (req, res) => {
  try {
    const storiesCount = await Story.countDocuments({ childId: req.params.id });
    const lastStory = await Story.findOne({ childId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { storiesCount, lastStoryAt: lastStory ? lastStory.createdAt : null } });
  } catch (error) {
    console.error('Admin getChildActivity error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllChildren,
  getChildById,
  createChildAdmin,
  updateChildAdmin,
  deleteChildAdmin,
  getChildrenStats,
  getChildStoriesAdmin,
  getChildActivityAdmin
};

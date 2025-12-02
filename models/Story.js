const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child',
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    pages: {
      type: [String], // tableau de pages
      required: true,
      validate: v => Array.isArray(v) && v.length > 0,
    },
    keywords: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: 'fr',
    },
    source: {
      type: String,
      enum: ['ai', 'manual'],
      default: 'ai',
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

// Index pour les requêtes fréquentes
StorySchema.index({ childId: 1, createdAt: -1 });
StorySchema.index({ parentId: 1, createdAt: -1 });

module.exports = mongoose.model('Story', StorySchema);
const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [0, 'Age cannot be negative'],
    max: [18, 'Age cannot exceed 18']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'non_specified'],
    default: 'non_specified'
  },
  preferredLanguages: [{
    type: String,
    enum: ['arabe', 'français', 'anglais']
  }],
  interests: [{
    type: String,
    enum: [
      'animaux', 'aventure', 'héros', 'science', 'amitié', 
      'magie', 'histoire', 'valeurs', 'musique', 'sport'
    ]
  }],
  readingLevel: {
    type: String,
    enum: ['débutant', 'intermédiaire', 'avancé'],
    default: 'débutant'
  },
  preferredVoice: {
    type: String,
    default: 'Om Sisi'
  },
  safeMode: {
    type: Boolean,
    default: true
  },
  linkCode: {
    type: String,
    unique: true,
    sparse: true  
  },
  linkExpiresAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour les requêtes fréquentes
childSchema.index({ parentId: 1, createdAt: -1 });

module.exports = mongoose.model('Child', childSchema);
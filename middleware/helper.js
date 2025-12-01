const crypto = require('crypto');
const Child = require('../models/Child');
const Parent = require('../models/Parent');

// Helper pour générer un code lisible
const generateLinkCode = () => {
  // Exemple: 10 caractères [A-Z0-9]
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // éviter I/O/1/0
  let code = '';
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
};
module.exports = {
    generateLinkCode,
};

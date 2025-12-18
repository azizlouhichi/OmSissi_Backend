require('dotenv').config();
const connectDB = require('../config/database');
const Admin = require('../models/Admin');

const main = async () => {
  try {
    await connectDB();

    const [,, email, password, firstName = 'Admin', lastName = 'User', role = 'admin'] = process.argv;

    if (!email || !password) {
      console.error('Usage: node scripts/createAdmin.js <email> <password> [firstName] [lastName] [role]');
      process.exit(1);
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log('Admin already exists:', existing.email, existing._id.toString());
      process.exit(0);
    }

    const admin = new Admin({ firstName, lastName, email, password, role, isActive: true });
    await admin.save();
    console.log('Created admin:', { email: admin.email, id: admin._id.toString(), role: admin.role });
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

main();

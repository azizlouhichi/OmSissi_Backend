const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require('dotenv');
const { spawn } = require("child_process");
const connectDB = require('./config/database');
const { initializePlans } = require('./utils/stripe');

const app = express();

// Load env vars FIRST
dotenv.config();

// Connect to database
connectDB();

// Initialize subscription plans
initializePlans().catch(err => {
  console.error('Error initializing subscription plans:', err.message);
});

// Middleware - Use express.json() instead of bodyParser.json() for newer Express versions
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/parents', require('./routes/parentRoutes'));
app.use('/api/children', require('./routes/childRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Story App API is running!' });
});

// Route POST /generate
app.post("/generate", (req, res) => {
  const { character, place, object, value } = req.body;

  // Validate required fields
  if (!character || !place || !object || !value) {
    return res.status(400).json({
      success: false,
      message: 'All fields (character, place, object, value) are required'
    });
  }

  console.log("Generating story with:", { character, place, object, value });

  // Lancer le script Python avec les arguments
  const python = spawn("C:\\Users\\azizl\\AppData\\Local\\Programs\\Python\\Python313\\python.exe", [
    "Script_python/falcon_generate.py",
    character,
    place,
    object,
    value
  ]);

  let result = "";
  let errorOutput = "";

  python.stdout.on("data", (data) => {
    result += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
    console.error("Python error:", data.toString());
  });

  python.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        message: 'Python script execution failed',
        error: errorOutput
      });
    }
    
    res.json({ 
      success: true,
      story: result.trim() 
    });
  });

  python.on("error", (error) => {
    console.error("Failed to start Python process:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to start Python script',
      error: error.message
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// Handle undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

// Single app.listen call
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
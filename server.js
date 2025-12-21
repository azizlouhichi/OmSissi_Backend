const express = require("express");
const cors = require("cors");
const dotenv = require('dotenv');
const { spawn } = require("child_process");
const connectDB = require('./config/database');
const { initializePlans } = require('./utils/stripe');

const app = express();

// ✅ Load env vars FIRST
dotenv.config();

// ✅ Connect to database
connectDB();

// ✅ Initialize subscription plans
initializePlans().catch(err => {
  console.error('Error initializing subscription plans:', err.message);
});

// ✅ CORS - Allow all origins for now
app.use(cors());

// ✅ NOUVEAU: Servir les fichiers statiques (pages HTML de paiement)
app.use(express.static('public'));

// ✅ CRITICAL: Route webhook AVANT express.json()
// Cette route a besoin du body RAW (buffer) pour vérifier la signature Stripe
app.use(
  '/api/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  require('./routes/subscriptionRoutes')
);

// ✅ Maintenant on peut utiliser express.json() pour les autres routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Routes normales (après express.json)
app.use('/api/parents', require('./routes/parentRoutes'));
app.use('/api/children', require('./routes/childRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));

// ✅ Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Om Sisi Story App API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ✅ Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ✅ Route POST /generate - Génération d'histoires avec Python
app.post("/generate", (req, res) => {
  const { character, place, object, value } = req.body;

  // Validation des champs requis
  if (!character || !place || !object || !value) {
    return res.status(400).json({
      success: false,
      message: 'All fields (character, place, object, value) are required'
    });
  }

  console.log("📖 Generating story with:", { character, place, object, value });

  // Déterminer le chemin Python selon l'environnement
  const pythonPath = process.env.PYTHON_PATH || 
                     (process.platform === 'win32' 
                       ? "C:\\Users\\azizl\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"
                       : "python3");

  const python = spawn(pythonPath, [
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
    console.error("🐍 Python error:", data.toString());
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.error("❌ Python script failed with code:", code);
      return res.status(500).json({
        success: false,
        message: 'Python script execution failed',
        error: errorOutput
      });
    }
    
    console.log("✅ Story generated successfully");
    res.json({ 
      success: true,
      story: result.trim() 
    });
  });

  python.on("error", (error) => {
    console.error("❌ Failed to start Python process:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to start Python script',
      error: error.message
    });
  });
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Ne pas exposer les détails de l'erreur en production
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// ✅ Handle undefined routes (404)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ✅ Port configuration
const PORT = process.env.PORT || 5000;

// ✅ Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Om Sisi Story API Server                 ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔗 API Test: http://localhost:${PORT}/api/test`);
  console.log(`💳 Webhook: http://localhost:${PORT}/api/subscriptions/webhook`);
  console.log(`📄 Payment Success: http://localhost:${PORT}/payment-success.html`);
  console.log(`📄 Payment Cancel: http://localhost:${PORT}/payment-cancel.html`);
  console.log('');
  console.log('🎯 Available endpoints:');
  console.log('   - POST /generate');
  console.log('   - GET  /api/test');
  console.log('   - GET  /health');
  console.log('   - *    /api/parents/*');
  console.log('   - *    /api/children/*');
  console.log('   - *    /api/stories/*');
  console.log('   - *    /api/subscriptions/*');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});
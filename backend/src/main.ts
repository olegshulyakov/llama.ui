import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { DatabaseService } from './services/database';

// Import routes
import authRoutes from './routes/auth';
import keyRoutes from './routes/keys';
import syncRoutes from './routes/sync';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

// --- Database Initialization ---
// Immediately initialize the database and create tables if they don't exist.
// This is wrapped in an async IIFE (Immediately Invoked Function Expression).
(async () => {
  try {
    await DatabaseService.init();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Exit the process if the database cannot be initialized, as the app is non-functional.
    process.exit(1);
  }
})();

// --- API Routes ---
// Group routes for better organization.
app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/sync', syncRoutes);

// --- Root Endpoint ---
// A simple health check endpoint to confirm the server is running.
app.get('/', (req, res) => {
  res.send('Sync Backend is running!');
});

// --- Server Startup ---
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-here';

app.use(cors());
app.use(express.json());

// Database setup - exact copy from spa-api
const db = new sqlite3.Database('./hiking.db', (err: Error | null) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the hiking.db database.');
    }
});

// Create users table - exact pattern from spa-api
db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err: Error | null) => {
  if (err) console.error("Error creating users table:", err.message);
});

// Create trails table - exact pattern from spa-api
db.run(`
  CREATE TABLE IF NOT EXISTS trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    length REAL NOT NULL,
    elevation REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err: Error | null) => {
  if (err) console.error("Error creating trails table:", err.message);
});

// Register endpoint - exact pattern from spa-api
app.post('/api/register', async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], (err: Error | null, row: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Insert new user
      db.run(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name || null],
        function(err: Error | null) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }

          res.status(201).json({ message: 'User created successfully' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint - exact pattern from spa-api
app.post('/api/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err: Error | null, user: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Compare password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile - exact pattern from spa-api
app.get('/api/profile', (req: any, res: any) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    db.get('SELECT id, email, name FROM users WHERE id = ?', [decoded.userId], (err: Error | null, user: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Health check
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Start server - exact pattern from spa-api
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
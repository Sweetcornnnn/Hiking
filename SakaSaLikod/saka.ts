const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-here';

// CORS configuration - allow all origins for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// JWT Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    db.get(
      'SELECT id, email, name, is_admin FROM users WHERE id = ?',
      [decoded.userId],
      (dbErr: Error | null, user: any) => {
        if (dbErr) {
          console.error('Database error loading user:', dbErr.message);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: Boolean(user.is_admin),
        };
        next();
      }
    );
  });
};

// Database setup - exact copy from spa-api
const dbPath = path.resolve(__dirname, 'hiking.db');
const db = new sqlite3.Database(dbPath, (err: Error | null) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to hiking.db at', dbPath);
    }
});

const initializeDatabase = (callback: () => void) => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating users table:', err.message);
      else {
        db.all('PRAGMA table_info(users)', (pragmaErr: Error | null, rows: any[]) => {
          if (pragmaErr) {
            console.error('Error checking users schema:', pragmaErr.message);
          } else {
            const hasIsAdmin = rows.some((row: any) => row.name === 'is_admin');
            if (!hasIsAdmin) {
              db.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0', (alterErr: Error | null) => {
                if (alterErr) {
                  console.error('Error adding is_admin column:', alterErr.message);
                } else {
                  console.log('Added is_admin column to users table.');
                }
              });
            }
          }
        });
      }
    });

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
      if (err) console.error('Error creating trails table:', err.message);
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS hikes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        tagalongs INTEGER NOT NULL DEFAULT 1,
        contact_number TEXT,
        emergency_contact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err: Error | null) => {
      if (err) {
        console.error('Error creating hikes table:', err.message);
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS password_change_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        new_password TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err: Error | null) => {
      if (err) {
        console.error('Error creating password_change_requests table:', err.message);
      }
      callback();
    });
  });
};

initializeDatabase(() => {});

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
        'INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name || null, 0],
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
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      try {
        // Compare password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token with admin claim
        const token = jwt.sign(
          { userId: user.id, email: user.email, is_admin: Boolean(user.is_admin) },
          JWT_SECRET
        );

        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            is_admin: Boolean(user.is_admin)
          }
        });
      } catch (bcryptError) {
        console.error('Bcrypt error:', bcryptError);
        return res.status(500).json({ error: 'Password comparison error' });
      }
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
    
    db.get('SELECT id, email, name, is_admin FROM users WHERE id = ?', [decoded.userId], (err: Error | null, user: any) => {
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

// Set admin status - for development/testing
app.post('/api/set-admin', (req: any, res: any) => {
  const { email, isAdmin } = req.body;
  const adminValue = isAdmin ? 1 : 0;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const updateAdminStatus = () => {
    db.run(
      'UPDATE users SET is_admin = ? WHERE email = ?',
      [adminValue, email],
      function(err: Error | null) {
        if (err) {
          if (err.message?.includes('no such column: is_admin')) {
            db.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0', (alterErr: Error | null) => {
              if (alterErr) {
                return res.status(500).json({ error: 'Failed to update database schema' });
              }
              updateAdminStatus();
            });
            return;
          }
          return res.status(500).json({ error: 'Failed to update user' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: `User admin status set to ${isAdmin}` });
      }
    );
  };

  updateAdminStatus();
});

// Health check
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Get all hikes (admin only)
app.get('/api/admin/hikes', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all(`
    SELECT h.*, u.email, u.name 
    FROM hikes h 
    JOIN users u ON h.user_id = u.id 
    ORDER BY h.date DESC, h.start_time DESC
  `, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching hikes:', err.message);
      return res.status(500).json({ error: 'Failed to fetch hikes' });
    }
    res.json({ hikes: rows });
  });
});

// Get user statistics (admin only)
app.get('/api/admin/stats', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Get total hikes count
  db.get('SELECT COUNT(*) as total_hikes FROM hikes', (err: Error | null, hikeRow: any) => {
    if (err) {
      console.error('Error fetching hike count:', err.message);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    // Get total users count
    db.get('SELECT COUNT(*) as total_users FROM users', (err: Error | null, userRow: any) => {
      if (err) {
        console.error('Error fetching user count:', err.message);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
      }

      res.json({
        total_hikes: hikeRow.total_hikes,
        total_users: userRow.total_users,
      });
    });
  });
});

// ─────────────────────────────────────────
// PASSWORD CHANGE REQUEST ENDPOINTS
// ─────────────────────────────────────────

// Request password change (user endpoint)
app.post('/api/password-change-request', authenticateToken, async (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Create password change request
    db.run(
      'INSERT INTO password_change_requests (user_id, new_password, status) VALUES (?, ?, ?)',
      [userId, hashedPassword, 'pending'],
      function(err: Error | null) {
        if (err) {
          console.error('Error creating password change request:', err.message);
          return res.status(500).json({ error: 'Failed to create password change request' });
        }

        res.json({
          message: 'Password change request sent to admin',
          requestId: this.lastID,
        });
      }
    );
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all password change requests (admin only)
app.get('/api/password-change-requests', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all(`
    SELECT pcr.id, pcr.user_id, u.email as userEmail, u.name as userName, 
           pcr.status, pcr.requested_at as requestedAt, pcr.responded_at as respondedAt
    FROM password_change_requests pcr
    JOIN users u ON pcr.user_id = u.id
    ORDER BY pcr.requested_at DESC
  `, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching password change requests:', err.message);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }

    res.json({
      requests: rows || [],
    });
  });
});

// Approve password change request (admin only)
app.post('/api/password-change-requests/:id/approve', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const requestId = req.params.id;

  // Get the password change request
  db.get(
    'SELECT user_id, new_password FROM password_change_requests WHERE id = ? AND status = ?',
    [requestId, 'pending'],
    (err: Error | null, row: any) => {
      if (err) {
        console.error('Error fetching password change request:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Request not found or already processed' });
      }

      // Update user's password
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [row.new_password, row.user_id],
        (updateErr: Error | null) => {
          if (updateErr) {
            console.error('Error updating user password:', updateErr.message);
            return res.status(500).json({ error: 'Failed to update password' });
          }

          // Mark the request as approved
          db.run(
            'UPDATE password_change_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['approved', requestId],
            (approveErr: Error | null) => {
              if (approveErr) {
                console.error('Error updating request status:', approveErr.message);
                return res.status(500).json({ error: 'Failed to update request status' });
              }

              res.json({
                message: 'Password change approved',
                requestId,
              });
            }
          );
        }
      );
    }
  );
});

// Reject password change request (admin only)
app.post('/api/password-change-requests/:id/reject', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const requestId = req.params.id;

  // Mark the request as rejected
  db.run(
    'UPDATE password_change_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
    ['rejected', requestId, 'pending'],
    function(err: Error | null) {
      if (err) {
        console.error('Error updating request status:', err.message);
        return res.status(500).json({ error: 'Failed to update request status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Request not found or already processed' });
      }

      res.json({
        message: 'Password change rejected',
        requestId,
      });
    }
  );
});

initializeDatabase(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
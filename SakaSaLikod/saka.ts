const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const http = require('http');

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

// Database setup
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
        contact_number TEXT,
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
            const hasContactNumber = rows.some((row: any) => row.name === 'contact_number');

            if (!hasContactNumber) {
              db.run('ALTER TABLE users ADD COLUMN contact_number TEXT', (alterErr: Error | null) => {
                if (alterErr) {
                  console.error('Error adding contact_number column:', alterErr.message);
                } else {
                  console.log('Added contact_number column to users table.');
                }
              });
            }

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
        mountain_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating hikes table:', err.message);
    });

    db.all('PRAGMA table_info(hikes)', (err: Error | null, columns: any[]) => {
      if (err) {
        console.error('Error reading hikes schema:', err.message);
        return;
      }
      if (!columns.some((col: any) => col.name === 'mountain_id')) {
        db.run('ALTER TABLE hikes ADD COLUMN mountain_id TEXT', (alterErr: Error | null) => {
          if (alterErr) console.error('Error adding mountain_id to hikes:', alterErr.message);
        });
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
      if (err) console.error('Error creating password_change_requests table:', err.message);
    });

    // WildTrack: Species table
    db.run(`
      CREATE TABLE IF NOT EXISTS species (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scientific_name TEXT NOT NULL,
        common_name TEXT NOT NULL,
        category TEXT NOT NULL,
        conservation_status TEXT,
        gbif_id INTEGER,
        inaturalist_id INTEGER,
        image_url TEXT,
        description TEXT,
        habitat TEXT,
        fun_facts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating species table:', err.message);
    });

    // WildTrack: Discoveries table
    db.run(`
      CREATE TABLE IF NOT EXISTS discoveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        species_id INTEGER NOT NULL,
        mountain_id TEXT NOT NULL,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        latitude REAL,
        longitude REAL,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (species_id) REFERENCES species(id)
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating discoveries table:', err.message);
    });

    // WildTrack: Mountain-Species relationship table
    db.run(`
      CREATE TABLE IF NOT EXISTS mountain_species (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mountain_id TEXT NOT NULL,
        species_id INTEGER NOT NULL,
        is_endemic BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (species_id) REFERENCES species(id),
        UNIQUE(mountain_id, species_id)
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating mountain_species table:', err.message);
    });

    // WildTrack: Cached species data for offline support
    db.run(`
      CREATE TABLE IF NOT EXISTS cached_species_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        species_id INTEGER NOT NULL,
        cached_data TEXT NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (species_id) REFERENCES species(id),
        UNIQUE(species_id)
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating cached_species_data table:', err.message);
    });

    // WildTrack: Mountain biodiversity info
    db.run(`
      CREATE TABLE IF NOT EXISTS mountain_biodiversity (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        curated_species_count INTEGER NOT NULL,
        description TEXT,
        endemic_species_count INTEGER,
        key_species TEXT,
        ecosystem TEXT,
        conservation_status TEXT
      )
    `, (err: Error | null) => {
      if (err) console.error('Error creating mountain_biodiversity table:', err.message);
      callback();
    });
  });
};

// ─────────────────────────────────────────
// AUTH & USER ENDPOINTS
// ─────────────────────────────────────────

app.post('/api/register', async (req: any, res: any) => {
  try {
    const { email, password, name, contact_number } = req.body;

    if (!email || !password || !contact_number) {
      return res.status(400).json({ error: 'Email, password, and phone number are required' });
    }

    db.get('SELECT id FROM users WHERE email = ?', [email], (err: Error | null, row: any) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (row) return res.status(400).json({ error: 'User already exists' });

      const hashedPassword = bcrypt.hashSync(password, 10);

      db.run(
        'INSERT INTO users (email, password, name, contact_number, is_admin) VALUES (?, ?, ?, ?, ?)',
        [email, hashedPassword, name || null, contact_number || '', 0],
        function(err: Error | null) {
          if (err) {
            console.error('Error inserting user:', err.message);
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

app.post('/api/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err: Error | null, user: any) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      try {
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

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
            is_admin: Boolean(user.is_admin),
            contact_number: user.contact_number || ''
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

app.get('/api/profile', (req: any, res: any) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    db.get('SELECT id, email, name, is_admin, contact_number FROM users WHERE id = ?', [decoded.userId], (err: Error | null, user: any) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// User hike CRUD endpoints
app.get('/api/hikes', authenticateToken, (req: any, res: any) => {
  console.log('[API] GET /api/hikes', { userId: req.user?.id, ip: req.ip, headers: { authorization: Boolean(req.headers.authorization) } });
  db.all(
    `
      SELECT h.*, COALESCE(m.name, h.mountain_id) AS mountain_name
      FROM hikes h
      LEFT JOIN mountain_biodiversity m ON h.mountain_id = m.id
      WHERE h.user_id = ?
      ORDER BY h.date ASC, h.start_time ASC
    `,
    [req.user.id],
    (err: Error | null, rows: any[]) => {
      if (err) {
        console.error('Error fetching user hikes:', err.message);
        return res.status(500).json({ error: 'Failed to fetch hikes' });
      }
      res.json({ hikes: rows });
    }
  );
});

app.post('/api/hikes', authenticateToken, (req: any, res: any) => {
  const { date, start_time, end_time, tagalongs, contact_number, emergency_contact, mountain_id } = req.body;

  if (!date || !start_time || !end_time || !mountain_id) {
    return res.status(400).json({ error: 'date, start_time, end_time, and mountain_id are required' });
  }

  db.run(
    'INSERT INTO hikes (user_id, date, start_time, end_time, tagalongs, contact_number, emergency_contact, mountain_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, date, start_time, end_time, tagalongs || 1, contact_number || '', emergency_contact || '', mountain_id],
    function(this: { lastID: number }, err: Error | null) {
      if (err) {
        console.error('Error creating hike:', err.message);
        return res.status(500).json({ error: 'Failed to create hike' });
      }

      db.get('SELECT * FROM hikes WHERE id = ?', [this.lastID], (selectErr: Error | null, row: any) => {
        if (selectErr) {
          console.error('Error loading created hike:', selectErr.message);
          return res.status(500).json({ error: 'Hike created but could not be loaded' });
        }
        res.status(201).json({ hike: row });
      });
    }
  );
});

app.put('/api/hikes/:id', authenticateToken, (req: any, res: any) => {
  const hikeId = req.params.id;
  const { date, start_time, end_time, tagalongs, contact_number, emergency_contact, mountain_id } = req.body;

  if (!date || !start_time || !end_time || !mountain_id) {
    return res.status(400).json({ error: 'date, start_time, end_time, and mountain_id are required' });
  }

  db.run(
    'UPDATE hikes SET date = ?, start_time = ?, end_time = ?, tagalongs = ?, contact_number = ?, emergency_contact = ?, mountain_id = ? WHERE id = ? AND user_id = ?',
    [date, start_time, end_time, tagalongs || 1, contact_number || '', emergency_contact || '', mountain_id, hikeId, req.user.id],
    function(this: { changes: number }, err: Error | null) {
      if (err) {
        console.error('Error updating hike:', err.message);
        return res.status(500).json({ error: 'Failed to update hike' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Hike not found or access denied' });
      }

      res.json({ message: 'Hike updated successfully' });
    }
  );
});

app.delete('/api/hikes/:id', authenticateToken, (req: any, res: any) => {
  const hikeId = req.params.id;

  db.run(
    'DELETE FROM hikes WHERE id = ? AND user_id = ?',
    [hikeId, req.user.id],
    function(this: { changes: number }, err: Error | null) {
      if (err) {
        console.error('Error deleting hike:', err.message);
        return res.status(500).json({ error: 'Failed to delete hike' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Hike not found or access denied' });
      }

      res.json({ message: 'Hike deleted successfully' });
    }
  );
});

// Set admin status - for development/testing
app.post('/api/set-admin', (req: any, res: any) => {
  const { email, isAdmin } = req.body;
  const adminValue = isAdmin ? 1 : 0;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const updateAdminStatus = () => {
    db.run(
      'UPDATE users SET is_admin = ? WHERE email = ?',
      [adminValue, email],
      function(this: { changes: number }, err: Error | null) {
        if (err) {
          if (err.message?.includes('no such column: is_admin')) {
            db.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0', (alterErr: Error | null) => {
              if (alterErr) return res.status(500).json({ error: 'Failed to update database schema' });
              updateAdminStatus();
            });
            return;
          }
          return res.status(500).json({ error: 'Failed to update user' });
        }

        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
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

// ─────────────────────────────────────────
// ADMIN: HIKES & STATS
// ─────────────────────────────────────────

app.get('/api/admin/hikes', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  db.all(`
    SELECT h.*, u.email AS user_email, u.name AS user_name, COALESCE(m.name, h.mountain_id) AS mountain_name
    FROM hikes h 
    JOIN users u ON h.user_id = u.id 
    LEFT JOIN mountain_biodiversity m ON h.mountain_id = m.id
    ORDER BY h.date DESC, h.start_time DESC
  `, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching hikes:', err.message);
      return res.status(500).json({ error: 'Failed to fetch hikes' });
    }
    const hikes = rows.map((row: any) => ({
      ...row,
      mountain_name: row.mountain_name,
      user: {
        email: row.user_email,
        name: row.user_name,
      },
    }));
    res.json({ hikes });
  });
});

app.get('/api/admin/stats', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  db.get('SELECT COUNT(*) as total_hikes FROM hikes', (err: Error | null, hikeRow: any) => {
    if (err) {
      console.error('Error fetching hike count:', err.message);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

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
// ADMIN: USER MANAGEMENT
// (added from spa-api, not present in wildtrack-api)
// ─────────────────────────────────────────

// Get all users
app.get('/api/admin/users', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  db.all('SELECT id, email, name, contact_number, is_admin, created_at FROM users ORDER BY created_at DESC', (err: Error | null, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: rows });
  });
});

// Update user (name and/or is_admin)
app.put('/api/admin/users/:id', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const { name, is_admin } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (is_admin !== undefined) { updates.push('is_admin = ?'); values.push(is_admin ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.id);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function(this: { changes: number }, err: Error | null) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// Force password reset for a user (admin creates a pending password change request)
app.post('/api/admin/users/:id/reset-password', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashed = bcrypt.hashSync(newPassword, 10);

  db.run(
    'INSERT INTO password_change_requests (user_id, new_password, status) VALUES (?, ?, ?)',
    [req.params.id, hashed, 'pending'],
    function(this: { lastID: number }, err: Error | null) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Password reset request created', requestId: this.lastID });
    }
  );
});

// Delete user (also removes their hikes, password requests, and discoveries)
app.delete('/api/admin/users/:id', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const userId = req.params.id;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }

  db.serialize(() => {
    db.run('DELETE FROM discoveries WHERE user_id = ?', [userId]);
    db.run('DELETE FROM hikes WHERE user_id = ?', [userId]);
    db.run('DELETE FROM password_change_requests WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId], function(this: { changes: number }, err: Error | null) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  });
});

// ─────────────────────────────────────────
// PASSWORD CHANGE REQUEST ENDPOINTS
// ─────────────────────────────────────────

// Request password change (user endpoint)
app.post('/api/password-change-request', async (req: any, res: any) => {
  try {
    const { newPassword, email } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const createRequest = (userId: number) => {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      db.run(
        'INSERT INTO password_change_requests (user_id, new_password, status) VALUES (?, ?, ?)',
        [userId, hashedPassword, 'pending'],
        function(this: { lastID: number }, err: Error | null) {
          if (err) {
            console.error('Error creating password change request:', err.message);
            return res.status(500).json({ error: 'Failed to create password change request' });
          }
          res.json({ message: 'Password change request sent to admin', requestId: this.lastID });
        }
      );
    };

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail], (err: Error | null, user: any) => {
        if (err) {
          console.error('Error finding user by email:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
          return res.status(404).json({ error: 'User with that email not found' });
        }
        createRequest(user.id);
      });
    } else {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(400).json({ error: 'Email or auth token required' });
      }
      jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
          return res.status(403).json({ error: 'Invalid or expired token' });
        }
        createRequest(decoded.userId);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all password change requests (admin only)
app.get('/api/password-change-requests', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

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
    res.json({ requests: rows || [] });
  });
});

// Approve password change request (admin only)
app.post('/api/password-change-requests/:id/approve', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const requestId = req.params.id;

  db.get(
    'SELECT user_id, new_password FROM password_change_requests WHERE id = ? AND status = ?',
    [requestId, 'pending'],
    (err: Error | null, row: any) => {
      if (err) {
        console.error('Error fetching password change request:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) return res.status(404).json({ error: 'Request not found or already processed' });

      db.run('UPDATE users SET password = ? WHERE id = ?', [row.new_password, row.user_id], (updateErr: Error | null) => {
        if (updateErr) {
          console.error('Error updating user password:', updateErr.message);
          return res.status(500).json({ error: 'Failed to update password' });
        }

        db.run(
          'UPDATE password_change_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['approved', requestId],
          (approveErr: Error | null) => {
            if (approveErr) {
              console.error('Error updating request status:', approveErr.message);
              return res.status(500).json({ error: 'Failed to update request status' });
            }
            res.json({ message: 'Password change approved', requestId });
          }
        );
      });
    }
  );
});

// Reject password change request (admin only)
app.post('/api/password-change-requests/:id/reject', authenticateToken, (req: any, res: any) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const requestId = req.params.id;

  db.run(
    'UPDATE password_change_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
    ['rejected', requestId, 'pending'],
    function(this: { changes: number }, err: Error | null) {
      if (err) {
        console.error('Error updating request status:', err.message);
        return res.status(500).json({ error: 'Failed to update request status' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Request not found or already processed' });
      res.json({ message: 'Password change rejected', requestId });
    }
  );
});

// ─────────────────────────────────────────
// WildTrack API
// Full species, mountain, discovery, and stats integration.
// ─────────────────────────────────────────

app.get('/api/wildtrack/featured', (req: any, res: any) => {
  const { mountain_id } = req.query;

  let query = `
    SELECT s.*, ms.is_endemic, ms.mountain_id
    FROM species s
    JOIN mountain_species ms ON s.id = ms.species_id
    WHERE ms.is_endemic = 1
  `;
  const params: any[] = [];

  if (mountain_id) {
    query += ' AND ms.mountain_id = ?';
    params.push(mountain_id);
  }

  query += ' ORDER BY RANDOM() LIMIT 10';

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching featured species:', err.message);
      return res.status(500).json({ error: 'Failed to fetch featured species' });
    }
    res.json({ species: rows });
  });
});

app.get('/api/wildtrack/mountain-info/:id', (req: any, res: any) => {
  const { id } = req.params;

  db.get('SELECT * FROM mountain_biodiversity WHERE id = ?', [id], (err: Error | null, info: any) => {
    if (err) {
      console.error('[WildTrack] Error fetching mountain info:', err.message);
      return res.status(500).json({ error: 'Failed to fetch mountain info' });
    }
    if (!info) return res.status(404).json({ error: 'Mountain info not found' });
    res.json({ info });
  });
});

app.get('/api/wildtrack/mountain/:id', (req: any, res: any) => {
  const { id } = req.params;
  const { user_id } = req.query;

  let query = `
    SELECT s.*, ms.is_endemic,
      CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END as discovered
    FROM species s
    JOIN mountain_species ms ON s.id = ms.species_id
    LEFT JOIN discoveries d ON s.id = d.species_id 
      AND d.mountain_id = ms.mountain_id
      ${user_id ? 'AND d.user_id = ?' : ''}
    WHERE ms.mountain_id = ?
    ORDER BY s.common_name ASC
  `;

  const params: any[] = user_id ? [user_id, id] : [id];

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching mountain species:', err.message);
      return res.status(500).json({ error: 'Failed to fetch mountain species' });
    }
    res.json({ species: rows });
  });
});

app.get('/api/wildtrack/species', (req: any, res: any) => {
  const { mountain_id, category } = req.query;

  let query = `
    SELECT s.*, ms.is_endemic, ms.mountain_id
    FROM species s
    LEFT JOIN mountain_species ms ON s.id = ms.species_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (mountain_id) {
    query += ' AND ms.mountain_id = ?';
    params.push(mountain_id);
  }
  if (category) {
    query += ' AND s.category = ?';
    params.push(category);
  }

  query += ' ORDER BY s.common_name ASC';

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching species:', err.message);
      return res.status(500).json({ error: 'Failed to fetch species' });
    }
    res.json({ species: rows });
  });
});

app.get('/api/wildtrack/species/:id', (req: any, res: any) => {
  const { id } = req.params;

  db.get('SELECT * FROM species WHERE id = ?', [id], (err: Error | null, species: any) => {
    if (err) {
      console.error('Error fetching species:', err.message);
      return res.status(500).json({ error: 'Failed to fetch species' });
    }
    if (!species) return res.status(404).json({ error: 'Species not found' });
    res.json({ species });
  });
});

app.get('/api/wildtrack/discoveries', authenticateToken, (req: any, res: any) => {
  const { mountain_id, category } = req.query;

  let query = `
    SELECT d.*, s.scientific_name, s.common_name, s.category, s.image_url, s.conservation_status
    FROM discoveries d
    JOIN species s ON d.species_id = s.id
    WHERE d.user_id = ?
  `;
  const params: any[] = [req.user.id];

  if (mountain_id) {
    query += ' AND d.mountain_id = ?';
    params.push(mountain_id);
  }
  if (category) {
    query += ' AND s.category = ?';
    params.push(category);
  }

  query += ' ORDER BY d.discovered_at DESC';

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching discoveries:', err.message);
      return res.status(500).json({ error: 'Failed to fetch discoveries' });
    }
    res.json({ discoveries: rows });
  });
});

app.post('/api/wildtrack/discover', authenticateToken, (req: any, res: any) => {
  const { species_id, mountain_id, latitude, longitude, notes } = req.body;

  if (!species_id || !mountain_id) {
    return res.status(400).json({ error: 'species_id and mountain_id are required' });
  }

  db.get(
    'SELECT id FROM discoveries WHERE user_id = ? AND species_id = ? AND mountain_id = ?',
    [req.user.id, species_id, mountain_id],
    (err: Error | null, existing: any) => {
      if (err) {
        console.error('Error checking existing discovery:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (existing) return res.status(400).json({ error: 'Species already discovered on this mountain' });

      db.run(
        'INSERT INTO discoveries (user_id, species_id, mountain_id, latitude, longitude, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, species_id, mountain_id, latitude || null, longitude || null, notes || null],
        function(this: any, err: Error | null) {
          if (err) {
            console.error('Error creating discovery:', err.message);
            return res.status(500).json({ error: 'Failed to create discovery' });
          }
          res.status(201).json({ message: 'Discovery recorded', discovery_id: this.lastID });
        }
      );
    }
  );
});

app.delete('/api/wildtrack/discovery/:id', authenticateToken, (req: any, res: any) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM discoveries WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    (err: Error | null, discovery: any) => {
      if (err) {
        console.error('Error checking discovery:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!discovery) return res.status(404).json({ error: 'Discovery not found' });

      db.run(
        'DELETE FROM discoveries WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(this: any, err: Error | null) {
          if (err) {
            console.error('Error deleting discovery:', err.message);
            return res.status(500).json({ error: 'Failed to delete discovery' });
          }
          res.json({ message: 'Discovery removed successfully' });
        }
      );
    }
  );
});

app.get('/api/wildtrack/stats', authenticateToken, (req: any, res: any) => {
  const { mountain_id } = req.query;

  let countQuery = 'SELECT COUNT(*) as discovered_count FROM discoveries WHERE user_id = ?';
  const countParams: any[] = [req.user.id];

  if (mountain_id) {
    countQuery += ' AND mountain_id = ?';
    countParams.push(mountain_id);
  }

  db.get(countQuery, countParams, (err: Error | null, countRow: any) => {
    if (err) {
      console.error('Error fetching discovery count:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    let totalQuery = 'SELECT curated_species_count as total_species FROM mountain_biodiversity';
    const totalParams: any[] = [];

    if (mountain_id) {
      totalQuery += ' WHERE id = ?';
      totalParams.push(mountain_id);
    } else {
      totalQuery = 'SELECT SUM(curated_species_count) as total_species FROM mountain_biodiversity';
    }

    db.get(totalQuery, totalParams, (err: Error | null, totalRow: any) => {
      if (err) {
        console.error('Error fetching total species count:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stats' });
      }

      const totalSpecies = totalRow.total_species || 0;
      const percentage = totalSpecies > 0
        ? Math.round((countRow.discovered_count / totalSpecies) * 100)
        : 0;

      let categoryQuery = `
        SELECT s.category, COUNT(*) as count
        FROM discoveries d
        JOIN species s ON d.species_id = s.id
        WHERE d.user_id = ?
      `;
      const categoryParams: any[] = [req.user.id];

      if (mountain_id) {
        categoryQuery += ' AND d.mountain_id = ?';
        categoryParams.push(mountain_id);
      }

      categoryQuery += ' GROUP BY s.category';

      db.all(categoryQuery, categoryParams, (err: Error | null, categoryRows: any[]) => {
        if (err) {
          console.error('Error fetching category stats:', err.message);
          return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        res.json({
          discovered_count: countRow.discovered_count,
          total_species: totalSpecies,
          percentage,
          by_category: categoryRows,
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// WildTrack: ENHANCED API INTEGRATION ENDPOINTS
// ─────────────────────────────────────────

// Search species using GBIF and iNaturalist APIs
app.get('/api/wildtrack/api-search', async (req: any, res: any) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  console.log(`[WildTrack] API search for: ${q}`);

  try {
    const gbifResponse = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(q)}&limit=5`);
    const gbifData: any = await gbifResponse.json();
    const gbifResults = gbifData.results || [];

    const inatResponse = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&per_page=5`);
    const inatData: any = await inatResponse.json();
    const inatResults = inatData.results || [];

    const merged: any[] = [];
    const seen = new Set<string>();

    for (const gbif of gbifResults) {
      const scientificName = gbif.scientificName || gbif.canonicalName;
      if (scientificName && !seen.has(scientificName)) {
        seen.add(scientificName);
        merged.push({
          scientific_name: scientificName,
          common_name: gbif.vernacularName,
          gbif_id: gbif.speciesKey || gbif.usageKey,
          rank: gbif.rank,
          source: 'GBIF',
        });
      }
    }

    for (const inat of inatResults) {
      if (!seen.has(inat.name)) {
        seen.add(inat.name);
        merged.push({
          scientific_name: inat.name,
          common_name: inat.preferred_common_name,
          inaturalist_id: inat.id,
          image_url: inat.default_photo?.medium_url || inat.default_photo?.url,
          rank: inat.rank,
          conservation_status: inat.conservation_status?.status_name,
          source: 'iNaturalist',
        });
      }
    }

    res.json({ results: merged, count: merged.length });
  } catch (error) {
    console.error('[WildTrack] API search error:', error);
    res.status(500).json({ error: 'Failed to search species' });
  }
});

// Get species by location (for mountain-specific biodiversity)
app.get('/api/wildtrack/location-species', async (req: any, res: any) => {
  const { lat, lng, radius = 50 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Latitude and longitude are required' });

  console.log(`[WildTrack] Location species search: ${lat}, ${lng}, radius: ${radius}km`);

  try {
    const gbifResponse = await fetch(
      `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${lat}&decimalLongitude=${lng}&radius=${radius}&limit=50&hasCoordinate=true`
    );
    const gbifData: any = await gbifResponse.json();
    const gbifOccurrences = gbifData.results || [];

    const inatResponse = await fetch(
      `https://api.inaturalist.org/v1/observations?lat=${lat}&lng=${lng}&radius=${radius}&per_page=30&order=desc&order_by=created_at`
    );
    const inatData: any = await inatResponse.json();
    const inatObservations = inatData.results || [];

    const species: any[] = [];
    const seen = new Set<string>();

    for (const occ of gbifOccurrences) {
      if (occ.species && !seen.has(occ.species)) {
        seen.add(occ.species);
        species.push({
          scientific_name: occ.species,
          common_name: occ.vernacularName,
          gbif_id: occ.taxonKey,
          rank: occ.taxonRank,
          source: 'GBIF',
        });
      }
    }

    for (const obs of inatObservations) {
      if (obs.taxon && !seen.has(obs.taxon.name)) {
        seen.add(obs.taxon.name);
        species.push({
          scientific_name: obs.taxon.name,
          common_name: obs.taxon.preferred_common_name,
          inaturalist_id: obs.taxon.id,
          image_url: obs.taxon.default_photo?.medium_url || obs.photos?.[0]?.url,
          rank: obs.taxon.rank,
          conservation_status: obs.taxon.conservation_status?.status_name,
          source: 'iNaturalist',
        });
      }
    }

    res.json({ species, count: species.length });
  } catch (error) {
    console.error('[WildTrack] Location species error:', error);
    res.status(500).json({ error: 'Failed to get species by location' });
  }
});

// Get complete species data from external APIs
app.get('/api/wildtrack/api-species/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { source } = req.query;

  console.log(`[WildTrack] Get API species data: ${id}, source: ${source}`);

  try {
    const data: any = {};

    if (source === 'gbif' || !source) {
      const gbifResponse = await fetch(`https://api.gbif.org/v1/species/${id}`);
      const gbifData: any = await gbifResponse.json();

      if (gbifData) {
        data.scientific_name = gbifData.scientificName || gbifData.canonicalName;
        data.gbif_id = parseInt(id);
        data.rank = gbifData.rank;

        const vernacularResponse = await fetch(`https://api.gbif.org/v1/species/${id}/vernacularNames`);
        const vernacularData: any = await vernacularResponse.json();
        if (vernacularData.results && vernacularData.results.length > 0) {
          data.common_name = vernacularData.results[0].vernacularName;
        }

        const descResponse = await fetch(`https://api.gbif.org/v1/species/${id}/descriptions`);
        const descData: any = await descResponse.json();
        if (descData.results && descData.results.length > 0) {
          data.description = descData.results[0].description;
        }
      }
    }

    if (source === 'inaturalist' || !source) {
      const inatResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${id}`);
      const inatData: any = await inatResponse.json();
      const taxon = inatData.results?.[0];

      if (taxon) {
        data.scientific_name = data.scientific_name || taxon.name;
        data.common_name = data.common_name || taxon.preferred_common_name;
        data.inaturalist_id = parseInt(id);
        data.image_url = data.image_url || taxon.default_photo?.medium_url || taxon.default_photo?.url;
        data.rank = data.rank || taxon.rank;
        data.conservation_status = taxon.conservation_status?.status_name;
        data.observations_count = taxon.observations_count || 0;
      }
    }

    if (Object.keys(data).length === 0) return res.status(404).json({ error: 'Species not found' });
    res.json({ species: data });
  } catch (error) {
    console.error('[WildTrack] API species data error:', error);
    res.status(500).json({ error: 'Failed to get species data' });
  }
});

// Cache mountain species checklist for offline access
app.post('/api/wildtrack/cache-checklist', (req: any, res: any) => {
  const { mountain_id, species_list } = req.body;
  if (!mountain_id || !species_list) {
    return res.status(400).json({ error: 'mountain_id and species_list are required' });
  }

  console.log(`[WildTrack] Caching checklist for mountain: ${mountain_id}`);

  const cacheData = JSON.stringify({ species_list, cached_at: new Date().toISOString() });

  db.run(
    'INSERT OR REPLACE INTO cached_species_data (species_id, cached_data, cached_at) VALUES (?, ?, ?)',
    [mountain_id, cacheData, new Date().toISOString()],
    (err: Error | null) => {
      if (err) {
        console.error('[WildTrack] Error caching checklist:', err.message);
        return res.status(500).json({ error: 'Failed to cache checklist' });
      }
      console.log(`[WildTrack] Checklist cached for mountain: ${mountain_id}`);
      res.json({ message: 'Checklist cached successfully' });
    }
  );
});

// Get cached mountain species checklist
app.get('/api/wildtrack/cached-checklist/:mountain_id', (req: any, res: any) => {
  const { mountain_id } = req.params;

  db.get(
    'SELECT cached_data, cached_at FROM cached_species_data WHERE species_id = ?',
    [mountain_id],
    (err: Error | null, row: any) => {
      if (err) {
        console.error('[WildTrack] Error getting cached checklist:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) return res.status(404).json({ error: 'No cached checklist found' });

      const cacheAge = Date.now() - new Date(row.cached_at).getTime();
      const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (cacheAge > maxCacheAge) {
        console.log(`[WildTrack] Cache expired for mountain: ${mountain_id}`);
        return res.status(404).json({ error: 'Cache expired' });
      }

      try {
        const cachedData = JSON.parse(row.cached_data);
        res.json({
          data: cachedData,
          cached_at: row.cached_at,
          age_hours: Math.floor(cacheAge / (1000 * 60 * 60))
        });
      } catch (parseError) {
        console.error('[WildTrack] Error parsing cached data:', parseError);
        return res.status(500).json({ error: 'Failed to parse cached data' });
      }
    }
  );
});

// Seed curated species data (for development)
app.post('/api/wildtrack/seed-curated', (req: any, res: any) => {
  console.log('[WildTrack] Starting curated species seed...');

  const curatedSpecies = [
    {
      id: 1,
      scientific_name: 'Rafflesia speciosa',
      common_name: 'Rafflesia',
      category: 'Plants',
      conservation_status: 'Endangered',
      image_url: 'https://images..com/photo-1597848212624-a19eb35e2651?w=400&h=300&fit=crop',
      description: 'A parasitic plant known for producing the largest individual flower on Earth. Found in the forests of Panay including Mt. Madjaas.',
      habitat: 'Tropical rainforests',
      fun_facts: 'The flower emits a smell like rotting meat to attract flies for pollination.',
      gbif_id: 5361926,
      inaturalist_id: 120861,
      mountains: ['1'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 2,
      scientific_name: 'Penelopides panini',
      common_name: 'Visayan Hornbill',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1551085254-e96b210db58a?w=400&h=300&fit=crop',
      description: 'A large hornbill species endemic to the Visayas islands. Plays a crucial role in seed dispersal in the forest ecosystem.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'Known locally as "Talusi", it is one of the most endangered hornbill species.',
      gbif_id: 2495404,
      inaturalist_id: 5503,
      mountains: ['1'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 3,
      scientific_name: 'Varanus mabitang',
      common_name: 'Panay Monitor Lizard',
      category: 'Reptiles',
      conservation_status: 'Endangered',
      image_url: 'https://images..com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
      description: 'A large arboreal monitor lizard endemic to Panay Island. One of the rarest monitor lizards in the world.',
      habitat: 'Dipterocarp forests',
      fun_facts: 'It is a frugivorous lizard, primarily eating fruits unlike most monitor lizards.',
      gbif_id: 2447288,
      mountains: ['1'],
      is_featured: true,
      is_endemic: true,
      inaturalist_id: 39436,
    },
    {
      id: 4,
      scientific_name: 'Platymantis guentheri',
      common_name: 'Guiting-Guiting Forest Frog',
      category: 'Amphibians',
      conservation_status: 'Vulnerable',
      image_url: 'https://images..com/photo-1559253664-ca249d4608c6?w=400&h=300&fit=crop',
      description: 'A endemic frog species found only on Mt. Guiting-Guiting. Adapted to the mossy forest habitat.',
      habitat: 'Montane mossy forests',
      fun_facts: 'This frog has unique toe pads that allow it to climb on wet mossy surfaces.',
      gbif_id: 2429088,
      mountains: ['2'],
      is_featured: true,
      is_endemic: true,
      inaturalist_id: 25957,
    },
    {
      id: 5,
      scientific_name: 'Nisaetus pinskeri',
      common_name: 'Romblon Hawk-Eagle',
      category: 'Birds',
      conservation_status: 'Vulnerable',
      image_url: 'https://images..com/photo-1611689342806-0863700ce1e4?w=400&h=300&fit=crop',
      description: 'A majestic raptor endemic to the Romblon island group. Named after Austrian ornithologist Wilhelm Pinsker.',
      habitat: 'Lowland and montane forests',
      fun_facts: 'It was only recognized as a distinct species in 2005.',
      gbif_id: 2495398,
      inaturalist_id: 144470,
      mountains: ['2'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 6,
      scientific_name: 'Gallicolumba keayi',
      common_name: 'Negros Bleeding-heart',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1444464666168-49d633b86797?w=400&h=300&fit=crop',
      description: 'A rare ground-dwelling pigeon with a distinctive red patch on its breast. Critically endangered due to habitat loss.',
      habitat: 'Lowland forests',
      fun_facts: 'The red patch on its chest resembles a bleeding wound, hence its name.',
      gbif_id: 2495158,
      inaturalist_id: 3134,
      mountains: ['2'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 7,
      scientific_name: 'Pinus kesiya',
      common_name: 'Benguet Pine',
      category: 'Plants',
      conservation_status: 'Least Concern',
      image_url: 'https://images..com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop',
      description: 'The dominant pine species in the Luzon tropical pine forests. Forms extensive pine forests on Mt. Pulag.',
      habitat: 'Montane pine forests',
      fun_facts: 'Also known as "Khasi pine", it is one of the few pine species native to Southeast Asia.',
      gbif_id: 2685488,
      inaturalist_id: 135814,
      mountains: ['3'],
      is_featured: true,
      is_endemic: false,
    },
    {
      id: 8,
      scientific_name: 'Cervus mariannus',
      common_name: 'Philippine Deer',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      image_url: 'https://images..com/photo-1456926631375-92c8ce872def?w=400&h=300&fit=crop',
      description: 'The largest endemic deer species in the Philippines. Found in forested areas across Luzon including Mt. Pulag.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'Also known as "Sambar deer", it is an important prey species for the Philippine Eagle.',
      gbif_id: 2440992,
      inaturalist_id: 75051,
      mountains: ['3'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 9,
      scientific_name: 'Phloeomys pallidus',
      common_name: 'Luzon Forest Rat',
      category: 'Mammals',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1425082661705-1834bfd09dca?w=400&h=300&fit=crop',
      description: 'A large arboreal rodent endemic to Luzon. Known locally as "Cloud Rat" due to its habitat in mossy forests.',
      habitat: 'Montane and mossy forests',
      fun_facts: 'These gentle rodents are important seed dispersers in the forest ecosystem.',
      gbif_id: 2441152,
      mountains: ['3'],
      is_featured: true,
      is_endemic: true,
      inaturalist_id: 45163,
    },
    {
      id: 10,
      scientific_name: 'Pithecophaga jefferyi',
      common_name: 'Philippine Eagle',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1611689342806-0863700ce1e4?w=400&h=300&fit=crop',
      description: 'One of the rarest and largest eagles in the world. The national bird of the Philippines and apex predator of the forest.',
      habitat: 'Dipterocarp forests',
      fun_facts: 'It takes 5-7 years for a Philippine Eagle to reach breeding age.',
      gbif_id: 2495392,
      inaturalist_id: 5413,
      mountains: ['4'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 11,
      scientific_name: 'Sus philippensis',
      common_name: 'Philippine Warty Pig',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      image_url: 'https://images..com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
      description: 'A wild pig species endemic to the Philippines. Important ecosystem engineer in forest habitats.',
      habitat: 'Forest and grassland areas',
      fun_facts: 'Males have prominent facial warts that grow larger with age.',
      gbif_id: 2440998,
      inaturalist_id: 42133,
      mountains: ['4'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 12,
      scientific_name: 'Nepenthes attenboroughii',
      common_name: 'Attenborough\'s Pitcher Plant',
      category: 'Plants',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1597848212624-a19eb35e2651?w=400&h=300&fit=crop',
      description: 'A giant pitcher plant discovered on Mt. Apo in 2007. Named after Sir David Attenborough.',
      habitat: 'Montane mossy forests',
      fun_facts: 'This pitcher plant can trap and digest small rodents and birds.',
      gbif_id: 5361928,
      inaturalist_id: 52970,
      mountains: ['4'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 13,
      scientific_name: 'Platymantis luzonensis',
      common_name: 'Albay Forest Frog',
      category: 'Amphibians',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1559253664-ca249d4608c6?w=400&h=300&fit=crop',
      description: 'An endemic frog species found in the forests around Mayon Volcano. Adapted to volcanic soil conditions.',
      habitat: 'Montane forests',
      fun_facts: 'This frog has developed resistance to the acidic conditions of volcanic environments.',
      gbif_id: 2429092,
      mountains: ['5'],
      is_featured: true,
      is_endemic: true,
      inaturalist_id: 25974,
    },
    {
      id: 14,
      scientific_name: 'Apomys gracilirostris',
      common_name: 'Mayon Montane Forest Mouse',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      image_url: 'https://images..com/photo-1425082661705-1834bfd09dca?w=400&h=300&fit=crop',
      description: 'A small rodent endemic to the forests of Mayon Volcano. One of the many endemic mammals of the Bicol region.',
      habitat: 'Montane forests',
      fun_facts: 'This mouse species has a longer snout than most forest mice, adapted for its diet.',
      gbif_id: 2441184,
      mountains: ['5'],
      is_featured: true,
      is_endemic: true,
      inaturalist_id: 74074,
    },
    {
      id: 15,
      scientific_name: 'Tarsius syrichta',
      common_name: 'Philippine Tarsier',
      category: 'Mammals',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1544552866-d3ed42536cfd?w=400&h=300&fit=crop',
      description: 'One of the smallest primates in the world. Found in the forests of southern Luzon including areas near Mayon.',
      habitat: 'Tropical rainforests',
      fun_facts: 'Their eyes are larger than their brain and stomach combined.',
      gbif_id: 2441212,
      inaturalist_id: 1369286,
      mountains: ['5'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 16,
      scientific_name: 'Ptilinopus arcanus',
      common_name: 'Negros Fruit Dove',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1444464666168-49d633b86797?w=400&h=300&fit=crop',
      description: 'An extremely rare fruit dove endemic to Negros Island. Possibly the rarest bird in the Philippines.',
      habitat: 'Montane forests',
      fun_facts: 'This species was only rediscovered in 1993 after being thought extinct for decades.',
      gbif_id: 2495184,
      inaturalist_id: 2844,
      mountains: ['6'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 17,
      scientific_name: 'Sus cebifrons',
      common_name: 'Visayan Warty Pig',
      category: 'Mammals',
      conservation_status: 'Critically Endangered',
      image_url: 'https://images..com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
      description: 'A critically endangered pig species endemic to the Visayas. Found in the forests of Negros including Mt. Kanlaon.',
      habitat: 'Forest and grassland areas',
      fun_facts: 'Males grow a distinctive tuft of hair during mating season.',
      gbif_id: 2441000,
      inaturalist_id: 42129,
      mountains: ['6'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 18,
      scientific_name: 'Stachyris speciosa',
      common_name: 'Flame-templed Babbler',
      category: 'Birds',
      conservation_status: 'Endangered',
      image_url: 'https://images..com/photo-1444464666168-49d633b86797?w=400&h=300&fit=crop',
      description: 'A colorful babbler endemic to Negros and Panay. Named for its distinctive flame-colored crown patch.',
      habitat: 'Lowland and montane forests',
      fun_facts: 'This bird is highly territorial and pairs stay together for life.',
      gbif_id: 2493092,
      inaturalist_id: 15532,
      mountains: ['6'],
      is_featured: true,
      is_endemic: true,
    },
    {
      id: 19,
      scientific_name: 'Dicaeum quadricolor',
      common_name: 'Bicolored Flowerpecker',
      category: 'Birds',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1551085254-e96b210db58a?w=400&h=300&fit=crop',
      description: 'A small colorful bird endemic to the Philippines. Important for seed dispersal of mistletoe plants.',
      habitat: 'Forest canopies',
      fun_facts: 'They play a crucial role in seed dispersal for mistletoe plants.',
      gbif_id: 2495248,
      inaturalist_id: 13402,
      mountains: ['1', '2', '3', '4', '5', '6'],
      is_endemic: true,
    },
    {
      id: 20,
      scientific_name: 'Ptilinopus merrilli',
      common_name: 'Merrill\'s Fruit Dove',
      category: 'Birds',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1444464666168-49d633b86797?w=400&h=300&fit=crop',
      description: 'A colorful fruit dove endemic to the Philippines. Found in Luzon and some Visayan islands.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'They feed almost exclusively on fruits.',
      gbif_id: 2495180,
      inaturalist_id: 1650502,
      mountains: ['1', '3', '4'],
      is_endemic: true,
    },
    {
      id: 21,
      scientific_name: 'Naja philippinensis',
      common_name: 'Philippine Cobra',
      category: 'Reptiles',
      conservation_status: 'Near Threatened',
      image_url: 'https://images..com/photo-1552728089-57bdde30beb3?w=400&h=300&fit=crop',
      description: 'A highly venomous spitting cobra endemic to the Philippines. Found in forest edges and agricultural areas.',
      habitat: 'Forest edges, agricultural areas',
      fun_facts: 'It can spit venom up to 3 meters with accuracy.',
      gbif_id: 2447280,
      inaturalist_id: 73875,
      mountains: ['1', '2', '3', '4', '5', '6'],
      is_endemic: true,
    },
    {
      id: 22,
      scientific_name: 'Heteropoda davidbowie',
      common_name: 'Bowie Spider',
      category: 'Insects',
      conservation_status: 'Data Deficient',
      image_url: 'https://images..com/photo-1559253664-ca249d4608c6?w=400&h=300&fit=crop',
      description: 'A large huntsman spider named after David Bowie due to its bright orange coloring.',
      habitat: 'Tropical forests',
      fun_facts: 'Named after David Bowie due to its bright orange coloring.',
      gbif_id: 2447320,
      mountains: ['1', '2', '3', '4'],
      is_endemic: true,
      inaturalist_id: 542254,
    },
  ];

  const mountainBiodiversity = [
    {
      id: '1',
      name: 'Mt. Madjaas',
      curated_species_count: 142,
      description: 'Mt. Madjaas is one of Panay\'s biodiversity hotspots and home to several endemic Visayan species including the Visayan Hornbill and Rafflesia. The mountain features diverse ecosystems from lowland dipterocarp forests to mossy forests at the summit.',
      endemic_species_count: 48,
      key_species: JSON.stringify(['Rafflesia speciosa', 'Visayan Hornbill', 'Panay Monitor Lizard']),
      ecosystem: 'Dipterocarp and mossy forests',
      conservation_status: 'Protected Landscape',
    },
    {
      id: '2',
      name: 'Mt. Guiting-Guiting',
      curated_species_count: 118,
      description: 'Mt. Guiting-Guiting in Romblon is known for its unique biodiversity with many species found nowhere else on Earth. The rugged terrain has created isolated ecosystems fostering endemic evolution.',
      endemic_species_count: 52,
      key_species: JSON.stringify(['Guiting-Guiting Forest Frog', 'Romblon Hawk-Eagle', 'Negros Bleeding-heart']),
      ecosystem: 'Lowland and montane forests',
      conservation_status: 'Protected Area',
    },
    {
      id: '3',
      name: 'Mt. Pulag',
      curated_species_count: 156,
      description: 'Mt. Pulag, the third highest peak in the Philippines, hosts diverse flora and fauna across its elevational gradient. Famous for its sea of clouds and unique montane forest ecosystem.',
      endemic_species_count: 38,
      key_species: JSON.stringify(['Benguet Pine', 'Philippine Deer', 'Cloud Rat']),
      ecosystem: 'Montane and mossy forests',
      conservation_status: 'National Park',
    },
    {
      id: '4',
      name: 'Mt. Apo',
      curated_species_count: 189,
      description: 'Mt. Apo, the highest mountain in the Philippines, boasts exceptional biodiversity with numerous endemic species. Its diverse habitats range from tropical rainforests to alpine meadows.',
      endemic_species_count: 67,
      key_species: JSON.stringify(['Philippine Eagle', 'Warty Pig', 'Nepenthes attenboroughii']),
      ecosystem: 'Diverse forest types and volcanic formations',
      conservation_status: 'Protected Area and Natural Park',
    },
    {
      id: '5',
      name: 'Mayon Volcano',
      curated_species_count: 134,
      description: 'Mayon Volcano\'s slopes support rich biodiversity despite volcanic activity. The surrounding areas feature unique adaptations of flora and fauna to volcanic soils.',
      endemic_species_count: 29,
      key_species: JSON.stringify(['Albay Forest Frog', 'Mayon Montane Forest Mouse', 'Philippine Tarsier']),
      ecosystem: 'Volcanic tropical forests',
      conservation_status: 'Natural Park',
    },
    {
      id: '6',
      name: 'Mt. Kanlaon',
      curated_species_count: 127,
      description: 'Mt. Kanlaon in Negros Island is a biodiversity treasure with significant endemic species. The active volcano\'s forests provide critical habitat for threatened wildlife.',
      endemic_species_count: 44,
      key_species: JSON.stringify(['Negros Fruit Dove', 'Visayan Warty Pig', 'Flame-templed Babbler']),
      ecosystem: 'Dipterocarp and montane forests',
      conservation_status: 'National Park',
    },
  ];

  let insertedSpecies = 0;
  let insertedMountains = 0;

  const insertSpecies = (index: number) => {
    if (index >= curatedSpecies.length) {
      console.log(`[WildTrack] Inserted ${insertedSpecies} species`);
      insertMountainBiodiversity(0);
      return;
    }

    const species = curatedSpecies[index];

    db.get('SELECT id FROM species WHERE id = ?', [species.id], (err: Error | null, existing: any) => {
      if (err) {
        console.error('[WildTrack] Error checking species:', err.message);
        insertSpecies(index + 1);
        return;
      }

      if (existing) {
        console.log(`[WildTrack] Species ${species.id} already exists, skipping`);
        insertSpecies(index + 1);
        return;
      }

      db.run(
        `INSERT INTO species (id, scientific_name, common_name, category, conservation_status, image_url, description, habitat, fun_facts, gbif_id, inaturalist_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [species.id, species.scientific_name, species.common_name, species.category,
         species.conservation_status, species.image_url, species.description,
         species.habitat, species.fun_facts, species.gbif_id, species.inaturalist_id],
        function(this: any, err: Error | null) {
          if (err) {
            console.error('[WildTrack] Error inserting species:', err.message);
          } else {
            insertedSpecies++;
            console.log(`[WildTrack] Inserted species: ${species.common_name} (ID: ${species.id})`);
            species.mountains.forEach((mountainId: string) => {
              db.run(
                'INSERT INTO mountain_species (mountain_id, species_id, is_endemic) VALUES (?, ?, ?)',
                [mountainId, species.id, species.is_endemic ? 1 : 0],
                (err: Error | null) => {
                  if (err) console.error('[WildTrack] Error associating species with mountain:', err.message);
                }
              );
            });
          }
          insertSpecies(index + 1);
        }
      );
    });
  };

  const insertMountainBiodiversity = (index: number) => {
    if (index >= mountainBiodiversity.length) {
      console.log(`[WildTrack] Inserted ${insertedMountains} mountain biodiversity records`);
      console.log(`[WildTrack] Seed complete: ${insertedSpecies} species, ${insertedMountains} mountains`);
      return res.json({
        message: 'Curated species and mountain biodiversity seeded successfully',
        species_count: insertedSpecies,
        mountain_count: insertedMountains
      });
    }

    const mountain = mountainBiodiversity[index];

    db.run(
      `INSERT OR REPLACE INTO mountain_biodiversity (id, name, curated_species_count, description, endemic_species_count, key_species, ecosystem, conservation_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mountain.id, mountain.name, mountain.curated_species_count, mountain.description,
       mountain.endemic_species_count, mountain.key_species, mountain.ecosystem, mountain.conservation_status],
      (err: Error | null) => {
        if (err) {
          console.error('[WildTrack] Error inserting mountain biodiversity:', err.message);
        } else {
          insertedMountains++;
          console.log(`[WildTrack] Inserted mountain biodiversity: ${mountain.name}`);
        }
        insertMountainBiodiversity(index + 1);
      }
    );
  };

  insertSpecies(0);
});

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────

initializeDatabase(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Auto-seed curated WildTrack data on startup (development convenience)
    try {
      const options = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/wildtrack/seed-curated',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': 0,
        },
      };

      const req = http.request(options, (res: any) => {
        let body = '';
        res.on('data', (chunk: any) => { body += chunk; });
        res.on('end', () => {
          console.log('[WildTrack] Auto-seed response status:', res.statusCode);
          try { console.log('[WildTrack] Auto-seed response:', JSON.parse(body)); }
          catch { console.log('[WildTrack] Auto-seed response (raw):', body); }
        });
      });

      req.on('error', (err: any) => {
        console.error('[WildTrack] Auto-seed request failed:', err.message);
      });

      req.end();
    } catch (err: any) {
      console.error('[WildTrack] Error triggering auto-seed:', err.message);
    }
  });
});
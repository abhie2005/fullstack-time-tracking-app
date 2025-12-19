const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'timesheet.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
      } else {
        console.log('Users table ready');
        // Add is_admin column if it doesn't exist (for existing databases)
        db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column name')) {
            console.log('Migration note:', err.message);
          }
        });
      }
    });
    
    // Create clock_records table with user_id
    db.run(`CREATE TABLE IF NOT EXISTS clock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating clock_records table:', err.message);
      } else {
        console.log('Clock records table ready');
        
        // Migrate existing records if user_id column doesn't exist
        db.run(`ALTER TABLE clock_records ADD COLUMN user_id INTEGER`, (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column name')) {
            console.log('Migration note:', err.message);
          }
        });
      }
    });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware - checks if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    db.get(
      'SELECT is_admin FROM users WHERE id = ?',
      [req.user.id],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!user || !user.is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        next();
      }
    );
  } catch (error) {
    return res.status(500).json({ error: 'Error checking admin status' });
  }
};

// Helper function to get today's date in YYYY-MM-DD format
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

// Helper function to get current time in HH:MM:SS format
const getCurrentTime = () => {
  return new Date().toTimeString().split(' ')[0];
};

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the first user (make them admin)
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const isAdmin = result.count === 0 ? 1 : 0; // First user becomes admin
      
      db.run(
        'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, isAdmin],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Username or email already exists' });
            }
            return res.status(500).json({ error: err.message });
          }

          // Generate JWT token
          const token = jwt.sign(
            { id: this.lastID, username, email, isAdmin: isAdmin === 1 },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: this.lastID, username, email, isAdmin: isAdmin === 1 }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      try {
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const isAdmin = user.is_admin === 1;
        const token = jwt.sign(
          { id: user.id, username: user.username, email: user.email, isAdmin },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username, email: user.email, isAdmin }
        });
      } catch (error) {
        res.status(500).json({ error: 'Error during login' });
      }
    }
  );
});

// Get current user endpoint
app.get('/api/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        ...user,
        isAdmin: user.is_admin === 1
      });
    }
  );
});

// Get all users endpoint (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    `SELECT id, username, email, is_admin, created_at,
     (SELECT COUNT(*) FROM clock_records WHERE user_id = users.id) as total_records,
     (SELECT COUNT(*) FROM clock_records WHERE user_id = users.id AND clock_out IS NOT NULL) as completed_records
     FROM users ORDER BY created_at DESC`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1,
        createdAt: user.created_at,
        totalRecords: user.total_records,
        completedRecords: user.completed_records
      }));

      res.json({ users: formattedUsers });
    }
  );
});

// Get current status (whether user has clocked in today)
app.get('/api/status', authenticateToken, (req, res) => {
  const today = getToday();
  const userId = req.user.id;
  
  db.get(
    'SELECT * FROM clock_records WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
    [userId, today],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.json({ 
          clockedIn: false, 
          clockInTime: null, 
          clockOutTime: null,
          date: today 
        });
      }
      
      res.json({
        clockedIn: row.clock_out === null,
        clockInTime: row.clock_in,
        clockOutTime: row.clock_out,
        date: row.date
      });
    }
  );
});

// Clock in endpoint
app.post('/api/clock-in', authenticateToken, (req, res) => {
  const today = getToday();
  const currentTime = getCurrentTime();
  const userId = req.user.id;
  
  // Check if already clocked in today
  db.get(
    'SELECT * FROM clock_records WHERE user_id = ? AND date = ? AND clock_out IS NULL',
    [userId, today],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ 
          error: 'You are already clocked in. Please clock out first.' 
        });
      }
      
      // Check if there's a record for today (with clock out)
      db.get(
        'SELECT * FROM clock_records WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1',
        [userId, today],
        (err, existingRow) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Create new record
          db.run(
            'INSERT INTO clock_records (user_id, date, clock_in, clock_out) VALUES (?, ?, ?, ?)',
            [userId, today, currentTime, null],
            function(err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ 
                message: 'Clocked in successfully',
                clockInTime: currentTime,
                date: today,
                id: this.lastID
              });
            }
          );
        }
      );
    }
  );
});

// Clock out endpoint
app.post('/api/clock-out', authenticateToken, (req, res) => {
  const today = getToday();
  const currentTime = getCurrentTime();
  const userId = req.user.id;
  
  // Find the most recent clock in without a clock out
  db.get(
    'SELECT * FROM clock_records WHERE user_id = ? AND date = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1',
    [userId, today],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(400).json({ 
          error: 'You are not clocked in. Please clock in first.' 
        });
      }
      
      // Update the record with clock out time
      db.run(
        'UPDATE clock_records SET clock_out = ? WHERE id = ? AND user_id = ?',
        [currentTime, row.id, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ 
            message: 'Clocked out successfully',
            clockInTime: row.clock_in,
            clockOutTime: currentTime,
            date: today
          });
        }
      );
    }
  );
});

// Get report endpoint
app.get('/api/report', authenticateToken, (req, res) => {
  const { period = 'all' } = req.query;
  const userId = req.user.id;
  let query = 'SELECT * FROM clock_records WHERE user_id = ?';
  const params = [userId];
  
  const now = new Date();
  
  if (period === 'today') {
    query += ' AND date = ?';
    params.push(getToday());
  } else if (period === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    query += ' AND date >= ?';
    params.push(weekAgo.toISOString().split('T')[0]);
  } else if (period === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    query += ' AND date >= ?';
    params.push(monthAgo.toISOString().split('T')[0]);
  }
  
  query += ' ORDER BY date DESC, id DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const HOURLY_RATE = 18; // $18 per hour
    
    // Calculate hours and salary for each record
    const recordsWithSalary = rows.map(row => {
      let hours = 0;
      let salary = 0;
      
      if (row.clock_in && row.clock_out) {
        const inTime = new Date(`${row.date}T${row.clock_in}`);
        const outTime = new Date(`${row.date}T${row.clock_out}`);
        hours = (outTime - inTime) / (1000 * 60 * 60);
        salary = hours * HOURLY_RATE;
      }
      
      return {
        ...row,
        hours: hours > 0 ? hours.toFixed(2) : null,
        salary: salary > 0 ? salary.toFixed(2) : null
      };
    });
    
    // Calculate total hours and total salary for completed records
    const totalHours = rows
      .filter(row => row.clock_in && row.clock_out)
      .reduce((total, row) => {
        const inTime = new Date(`${row.date}T${row.clock_in}`);
        const outTime = new Date(`${row.date}T${row.clock_out}`);
        const hours = (outTime - inTime) / (1000 * 60 * 60);
        return total + hours;
      }, 0);
    
    const totalSalary = totalHours * HOURLY_RATE;
    
    res.json({
      records: recordsWithSalary,
      totalRecords: rows.length,
      completedRecords: rows.filter(row => row.clock_in && row.clock_out).length,
      totalHours: totalHours.toFixed(2),
      totalSalary: totalSalary.toFixed(2),
      hourlyRate: HOURLY_RATE
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
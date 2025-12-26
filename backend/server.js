const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware - CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In production, check if origin matches
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        console.log('Allowed origins:', allowedOrigins);
        return callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow localhost
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(express.json());

// Initialize SQLite database
// For production, store in data folder; for development, use current directory
const dbDir = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data')
  : __dirname;
  
// Ensure data directory exists in production
if (process.env.NODE_ENV === 'production') {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

const dbPath = path.join(dbDir, 'timesheet.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    console.error('Database path:', dbPath);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    
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
    
    // Create jobs table
    db.run(`CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      hourly_rate REAL DEFAULT 18.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating jobs table:', err.message);
      } else {
        console.log('Jobs table ready');
      }
    });
    
    // Create clock_records table with user_id and job_id
    db.run(`CREATE TABLE IF NOT EXISTS clock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id INTEGER,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating clock_records table:', err.message);
      } else {
        console.log('Clock records table ready');
        
        // Migrate existing records - add columns if they don't exist
        db.run(`ALTER TABLE clock_records ADD COLUMN user_id INTEGER`, (err) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE clock_records ADD COLUMN job_id INTEGER`, (err) => {
          // Ignore error if column already exists
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

  console.log('Registration attempt:', { username, email, passwordLength: password?.length });

  if (!username || !email || !password) {
    console.log('Registration failed: Missing required fields');
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (password.length < 6) {
    console.log('Registration failed: Password too short');
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Check if this is the first user (make them admin)
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        console.error('Database error checking user count:', err);
        return res.status(500).json({ error: err.message });
      }
      
      const isAdmin = result.count === 0 ? 1 : 0; // First user becomes admin
      console.log(`User will be admin: ${isAdmin === 1}, Total users: ${result.count}`);
      
      db.run(
        'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, isAdmin],
        function(err) {
          if (err) {
            console.error('Database error inserting user:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Username or email already exists' });
            }
            return res.status(500).json({ error: err.message });
          }

          console.log('User created successfully with ID:', this.lastID);

          // Generate JWT token
          const token = jwt.sign(
            { id: this.lastID, username, email, isAdmin: isAdmin === 1 },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          console.log('JWT token generated successfully');
          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: this.lastID, username, email, isAdmin: isAdmin === 1 }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Error registering user' });
  }
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log('Login attempt for:', username);

  if (!username || !password) {
    console.log('Login failed: Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err) {
        console.error('Database error during login:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        console.log('Login failed: User not found');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      try {
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          console.log('Login failed: Invalid password');
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const isAdmin = user.is_admin === 1;
        const token = jwt.sign(
          { id: user.id, username: user.username, email: user.email, isAdmin },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        console.log('Login successful for user:', user.username);
        res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username, email: user.email, isAdmin }
        });
      } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Error during login' });
      }
    }
  );
});

// Health check endpoint (for deployment verification)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
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

// Jobs endpoints
// Get all jobs for current user
app.get('/api/jobs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.all(
    'SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, jobs) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ jobs });
    }
  );
});

// Create a new job
app.post('/api/jobs', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, description, hourly_rate } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Job name is required' });
  }
  
  const rate = hourly_rate ? parseFloat(hourly_rate) : 18.0;
  
  db.run(
    'INSERT INTO jobs (user_id, name, description, hourly_rate) VALUES (?, ?, ?, ?)',
    [userId, name.trim(), description || null, rate],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        message: 'Job created successfully',
        job: {
          id: this.lastID,
          user_id: userId,
          name: name.trim(),
          description: description || null,
          hourly_rate: rate
        }
      });
    }
  );
});

// Update a job
app.put('/api/jobs/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const jobId = req.params.id;
  const { name, description, hourly_rate } = req.body;
  
  // First verify the job belongs to the user
  db.get(
    'SELECT * FROM jobs WHERE id = ? AND user_id = ?',
    [jobId, userId],
    (err, job) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const updateName = name ? name.trim() : job.name;
      const updateDesc = description !== undefined ? description : job.description;
      const updateRate = hourly_rate ? parseFloat(hourly_rate) : job.hourly_rate;
      
      db.run(
        'UPDATE jobs SET name = ?, description = ?, hourly_rate = ? WHERE id = ? AND user_id = ?',
        [updateName, updateDesc, updateRate, jobId, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: 'Job updated successfully',
            job: {
              id: jobId,
              name: updateName,
              description: updateDesc,
              hourly_rate: updateRate
            }
          });
        }
      );
    }
  );
});

// Delete a job
app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const jobId = req.params.id;
  
  // First verify the job belongs to the user
  db.get(
    'SELECT * FROM jobs WHERE id = ? AND user_id = ?',
    [jobId, userId],
    (err, job) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Check if there are any clock records for this job
      db.get(
        'SELECT COUNT(*) as count FROM clock_records WHERE job_id = ?',
        [jobId],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          if (result.count > 0) {
            return res.status(400).json({ 
              error: 'Cannot delete job with existing clock records. Please delete records first.' 
            });
          }
          
          db.run(
            'DELETE FROM jobs WHERE id = ? AND user_id = ?',
            [jobId, userId],
            function(err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ message: 'Job deleted successfully' });
            }
          );
        }
      );
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
  const { job_id } = req.query; // Optional job filter
  
  let query = 'SELECT * FROM clock_records WHERE user_id = ? AND date = ?';
  let params = [userId, today];
  
  if (job_id) {
    query += ' AND job_id = ?';
    params.push(job_id);
  }
  
  query += ' ORDER BY id DESC LIMIT 1';
  
  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.json({ 
        clockedIn: false, 
        clockInTime: null, 
        clockOutTime: null,
        date: today,
        jobId: job_id || null
      });
    }
    
    res.json({
      clockedIn: row.clock_out === null,
      clockInTime: row.clock_in,
      clockOutTime: row.clock_out,
      date: row.date,
      jobId: row.job_id || null
    });
  });
});

// Clock in endpoint
app.post('/api/clock-in', authenticateToken, (req, res) => {
  const today = getToday();
  const currentTime = getCurrentTime();
  const userId = req.user.id;
  const { job_id } = req.body; // Optional job_id
  
  // If job_id is provided, verify it belongs to the user
  if (job_id) {
    db.get(
      'SELECT * FROM jobs WHERE id = ? AND user_id = ?',
      [job_id, userId],
      (err, job) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!job) {
          return res.status(400).json({ error: 'Invalid job' });
        }
        proceedWithClockIn();
      }
    );
  } else {
    proceedWithClockIn();
  }
  
  function proceedWithClockIn() {
    let query = 'SELECT * FROM clock_records WHERE user_id = ? AND date = ? AND clock_out IS NULL';
    let params = [userId, today];
    
    if (job_id) {
      query += ' AND job_id = ?';
      params.push(job_id);
    }
    
    // Check if already clocked in today
    db.get(query, params, (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ 
          error: 'You are already clocked in. Please clock out first.' 
        });
      }
      
      // Create new record
      db.run(
        'INSERT INTO clock_records (user_id, job_id, date, clock_in, clock_out) VALUES (?, ?, ?, ?, ?)',
        [userId, job_id || null, today, currentTime, null],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ 
            message: 'Clocked in successfully',
            clockInTime: currentTime,
            date: today,
            jobId: job_id || null,
            id: this.lastID
          });
        }
      );
    });
  }
});

// Clock out endpoint
app.post('/api/clock-out', authenticateToken, (req, res) => {
  const today = getToday();
  const currentTime = getCurrentTime();
  const userId = req.user.id;
  const { job_id } = req.body; // Optional job_id
  
  let query = 'SELECT * FROM clock_records WHERE user_id = ? AND date = ? AND clock_out IS NULL';
  let params = [userId, today];
  
  if (job_id) {
    query += ' AND job_id = ?';
    params.push(job_id);
  }
  
  query += ' ORDER BY id DESC LIMIT 1';
  
  // Find the most recent clock in without a clock out
  db.get(query, params, (err, row) => {
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
          date: today,
          jobId: row.job_id || null
        });
      }
    );
  });
});

// Get report endpoint
app.get('/api/report', authenticateToken, (req, res) => {
  const { period = 'all', job_id } = req.query;
  const userId = req.user.id;
  let query = 'SELECT cr.*, j.name as job_name, j.hourly_rate FROM clock_records cr LEFT JOIN jobs j ON cr.job_id = j.id WHERE cr.user_id = ?';
  const params = [userId];
  
  // Filter by job if specified
  if (job_id) {
    query += ' AND cr.job_id = ?';
    params.push(job_id);
  }
  
  const now = new Date();
  
  if (period === 'today') {
    query += ' AND cr.date = ?';
    params.push(getToday());
  } else if (period === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    query += ' AND cr.date >= ?';
    params.push(weekAgo.toISOString().split('T')[0]);
  } else if (period === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    query += ' AND cr.date >= ?';
    params.push(monthAgo.toISOString().split('T')[0]);
  }
  
  query += ' ORDER BY cr.date DESC, cr.id DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calculate hours and salary for each record
    const recordsWithSalary = rows.map(row => {
      let hours = 0;
      let salary = 0;
      const hourlyRate = row.hourly_rate || 18.0; // Use job rate or default
      
      if (row.clock_in && row.clock_out) {
        const inTime = new Date(`${row.date}T${row.clock_in}`);
        const outTime = new Date(`${row.date}T${row.clock_out}`);
        hours = (outTime - inTime) / (1000 * 60 * 60);
        salary = hours * hourlyRate;
      }
      
      return {
        ...row,
        hours: hours > 0 ? hours.toFixed(2) : null,
        salary: salary > 0 ? salary.toFixed(2) : null,
        hourly_rate: hourlyRate
      };
    });
    
    // Calculate total hours and total salary for completed records
    let totalHours = 0;
    let totalSalary = 0;
    
    rows.forEach(row => {
      if (row.clock_in && row.clock_out) {
        const inTime = new Date(`${row.date}T${row.clock_in}`);
        const outTime = new Date(`${row.date}T${row.clock_out}`);
        const hours = (outTime - inTime) / (1000 * 60 * 60);
        const hourlyRate = row.hourly_rate || 18.0;
        totalHours += hours;
        totalSalary += hours * hourlyRate;
      }
    });
    
    res.json({
      records: recordsWithSalary,
      totalRecords: rows.length,
      completedRecords: rows.filter(row => row.clock_in && row.clock_out).length,
      totalHours: totalHours.toFixed(2),
      totalSalary: totalSalary.toFixed(2)
    });
  });
});


// Start server - must bind to 0.0.0.0 for Render to detect it
// IMPORTANT: Server must start AFTER all routes and middleware are configured
console.log(`Attempting to start server on port ${PORT}...`);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server accessible at: http://0.0.0.0:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
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
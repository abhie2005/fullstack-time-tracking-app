# Clock In/Clock Out System !

A full stack web application to track your office hours with clock in/out functionality and detailed reporting.

📊 **UML Diagrams**: See [UML_DIAGRAMS.md](./UML_DIAGRAMS.md) for detailed architecture, database schema, and sequence diagrams.

## Features

- ✅ User authentication (Login/Register)
- ✅ Secure JWT token-based authentication
- ✅ Clock In/Out functionality
- ✅ Real-time status display
- ✅ Automatic date and time tracking
- ✅ Report generation (Today, Last 7 Days, Last 30 Days, All Time)
- ✅ Total hours calculation
- ✅ Salary calculation ($18/hour)
- ✅ Excel report download (export reports as .xlsx files)
- ✅ Modern, responsive UI
- ✅ SQLite database for data persistence
- ✅ User-specific data isolation

## Tech Stack

### Backend
- Node.js
- Express.js
- SQLite3
- JWT (JSON Web Tokens) for authentication
- bcryptjs for password hashing

### Frontend
- React
- Axios
- XLSX (SheetJS) for Excel export
- Modern CSS with gradients and animations

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm start
   ```
   The backend will run on `http://localhost:3001`

2. **Start the Frontend Development Server** (in a new terminal)
   ```bash
   cd frontend
   npm start
   ```
   The frontend will automatically open in your browser at `http://localhost:3000`

### Development Mode

For auto-reload during development:

- Backend: Use `npm run dev` (requires nodemon, install globally: `npm install -g nodemon`)
- Frontend: `npm start` already includes hot-reload

## Usage

1. **Register/Login**: 
   - First-time users should register with a username, email, and password
   - Existing users can login with their credentials
   - Your session will be remembered using JWT tokens stored in browser localStorage

2. **Clock In**: Click the "Clock In" button when you arrive at the office
3. **Clock Out**: Click the "Clock Out" button when you leave
4. **View Reports**: 
   - Select a time period (Today, Last 7 Days, Last 30 Days, or All Time)
   - Click "Generate Report" to see your attendance history
   - View total hours worked and calculated salary ($18/hour)
5. **Download Excel Report**: 
   - After generating a report, click the "📥 Download Excel" button
   - The report will be downloaded as an Excel file (.xlsx) with all attendance records and summary
   - File includes: Date, Clock In, Clock Out, Hours, and Salary columns
6. **Logout**: Click the "Logout" button to end your session

### Admin Features

**Permanent Admin Account:**
- A permanent admin account is automatically created on first startup
- **Default credentials:**
  - Username: `admin`
  - Email: `admin@clockinout.com`
  - Password: `admin123`
- This admin account persists across database resets and server restarts
- You can customize these credentials using environment variables: `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- **⚠️ Important:** Change the default password after first login for security!

**Note:** The **first user** to register (after the permanent admin) will also become an admin. As an admin, you can:

- Click the **"👥 View Users"** button in the header to see all registered users
- View user details including:
  - Username and email
  - Role (Admin/User)
  - Total clock records
  - Completed records
  - Join date
- Refresh the user list to see the latest data

## Database

The application uses SQLite database stored in `backend/timesheet.db`. The database is automatically created on first run.

### Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```
Note: `is_admin` is set to 1 for the first registered user (admin), 0 for all other users.

CREATE TABLE clock_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

## API Endpoints

### Authentication Endpoints

#### POST `/api/register`
Register a new user
- Body: `{ username, email, password }`
- Returns: JWT token and user data

#### POST `/api/login`
Login with existing credentials
- Body: `{ username, password }` (username can be username or email)
- Returns: JWT token and user data

#### GET `/api/me`
Get current authenticated user information
- Requires: Bearer token in Authorization header
- Returns: User data including admin status

### Admin Endpoints (Admin only)

#### GET `/api/admin/users`
Get list of all users in the system
- Requires: Bearer token + Admin privileges
- Returns: List of all users with their statistics

### Clock In/Out Endpoints (All require authentication)

#### GET `/api/status`
Get current clock in/out status for today
- Requires: Bearer token

#### POST `/api/clock-in`
Clock in for the day
- Requires: Bearer token

#### POST `/api/clock-out`
Clock out for the day
- Requires: Bearer token

#### GET `/api/report?period={period}`
Get attendance report
- Requires: Bearer token
- `period` can be: `today`, `week`, `month`, or `all` (default)
- Returns user-specific records only

## Project Structure

```
Clock in clock out/
├── backend/
│   ├── server.js          # Express server and API endpoints
│   ├── package.json       # Backend dependencies
│   └── timesheet.db       # SQLite database (created automatically)
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Styles
│   │   ├── index.js       # React entry point
│   │   └── index.css      # Global styles
│   └── package.json       # Frontend dependencies
└── README.md
```

## Notes

- **Authentication**: Users must register/login to use the system
- **Admin Role**: The first user to register automatically becomes the admin/owner
- **Session Persistence**: JWT tokens are stored in browser localStorage and persist across page refreshes
- **User Isolation**: Each user can only see and manage their own clock in/out records
- **Admin Access**: Only admins can view the list of all users
- **Security**: Passwords are hashed using bcrypt before storage
- **Token Expiration**: JWT tokens expire after 7 days (users will need to login again)
- The system supports multiple clock in/out cycles per day
- Clock in/out times are stored in HH:MM:SS format
- Reports calculate total hours worked and salary automatically ($18/hour)
- The UI updates automatically every 5 seconds to show current status

## Security Notes

- **Change JWT_SECRET**: For production, set the `JWT_SECRET` environment variable to a strong, random secret
- **HTTPS**: Always use HTTPS in production to protect tokens in transit
- **Password Requirements**: Minimum 6 characters (can be enhanced in the future)

## Future Enhancements

- Password reset functionality
- Email verification
- Export reports to PDF/CSV
- Email notifications
- Mobile app
- Location-based clock in/out verification
- Admin dashboard for multi-user management

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions on deploying your application to production.

## License

ISC

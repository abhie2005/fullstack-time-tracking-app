# UML Diagrams - Clock In/Out System

This document contains UML diagrams for the Clock In/Out System architecture, database schema, and key workflows.

## 1. System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend (React)"
        A[App.js] --> B[Auth.js]
        A --> C[AdminPanel.js]
        A --> D[Clock Interface]
        A --> E[Report Interface]
        E --> F[Excel Export]
    end
    
    subgraph "Backend (Node.js/Express)"
        G[Express Server] --> H[Auth Routes]
        G --> I[Clock Routes]
        G --> J[Report Routes]
        G --> K[Admin Routes]
        H --> L[JWT Middleware]
        I --> L
        J --> L
        K --> L
        K --> M[Admin Middleware]
    end
    
    subgraph "Database (SQLite)"
        N[(Users Table)]
        O[(Clock Records Table)]
    end
    
    A -->|HTTP/REST API| G
    H -->|CRUD| N
    I -->|CRUD| O
    J -->|Read| O
    K -->|Read| N
    O -->|Foreign Key| N
```

## 2. Database Schema (ER Diagram)

```mermaid
erDiagram
    USERS ||--o{ CLOCK_RECORDS : "has"
    
    USERS {
        int id PK
        string username UK
        string email UK
        string password
        int is_admin
        datetime created_at
    }
    
    CLOCK_RECORDS {
        int id PK
        int user_id FK
        string date
        string clock_in
        string clock_out
        datetime created_at
    }
```

## 3. Authentication Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend API
    participant D as Database
    
    Note over U,D: Registration Flow
    U->>F: Fill Registration Form
    F->>B: POST /api/register (username, email, password)
    B->>B: Hash Password (bcrypt)
    B->>D: Check if first user
    D-->>B: User count = 0
    B->>D: INSERT user (is_admin = 1)
    D-->>B: User created
    B->>B: Generate JWT Token
    B-->>F: Return token + user data
    F->>F: Store token in localStorage
    F-->>U: Redirect to Dashboard
    
    Note over U,D: Login Flow
    U->>F: Enter credentials
    F->>B: POST /api/login (username, password)
    B->>D: SELECT user by username/email
    D-->>B: User data
    B->>B: Verify password (bcrypt.compare)
    B->>B: Generate JWT Token (with isAdmin)
    B-->>F: Return token + user data
    F->>F: Store token in localStorage
    F-->>U: Redirect to Dashboard
```

## 4. Clock In/Out Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend API
    participant D as Database
    
    Note over U,D: Clock In Flow
    U->>F: Click Clock In
    F->>B: POST /api/clock-in (Bearer Token)
    B->>B: Verify JWT Token
    B->>B: Extract user_id from token
    B->>D: Check if already clocked in today
    D-->>B: No existing record
    B->>B: Get current date & time
    B->>D: INSERT clock_record (user_id, date, clock_in, clock_out=null)
    D-->>B: Record created
    B-->>F: Success response
    F->>F: Update UI status
    F-->>U: Show "Clocked In" status
    
    Note over U,D: Clock Out Flow
    U->>F: Click Clock Out
    F->>B: POST /api/clock-out (Bearer Token)
    B->>B: Verify JWT Token
    B->>B: Extract user_id from token
    B->>D: SELECT record WHERE user_id AND date AND clock_out IS NULL
    D-->>B: Active record found
    B->>B: Get current time
    B->>D: UPDATE clock_record SET clock_out = current_time
    D-->>B: Record updated
    B-->>F: Success response
    F->>F: Update UI status
    F-->>U: Show "Clocked Out" status
```

## 5. Report Generation Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend API
    participant D as Database
    
    U->>F: Select period & click Generate Report
    F->>B: GET /api/report?period=week (Bearer Token)
    B->>B: Verify JWT Token
    B->>B: Extract user_id from token
    B->>B: Build query based on period
    B->>D: SELECT records WHERE user_id AND date filter
    D-->>B: Return records array
    B->>B: Calculate hours for each record
    B->>B: Calculate salary (hours × $18)
    B->>B: Calculate totals
    B-->>F: Return formatted report data
    F->>F: Display report table
    F-->>U: Show report with totals
    
    Note over U,F: Excel Export
    U->>F: Click Download Excel
    F->>F: Convert report data to Excel format
    F->>F: Create workbook with records + summary
    F->>F: Generate .xlsx file
    F-->>U: Download Excel file
```

## 6. Admin User Management Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant F as Frontend
    participant B as Backend API
    participant M as Admin Middleware
    participant D as Database
    
    A->>F: Click "View Users"
    F->>B: GET /api/admin/users (Bearer Token)
    B->>B: Verify JWT Token
    B->>M: Check if user is admin
    M->>D: SELECT is_admin FROM users WHERE id = user_id
    D-->>M: Return is_admin = 1
    M-->>B: Admin verified
    B->>D: SELECT all users with statistics
    Note over D: JOIN with clock_records<br/>to get counts
    D-->>B: Return users array
    B-->>F: Return formatted users data
    F->>F: Display users in admin panel
    F-->>A: Show all users with stats
```

## 7. Component Class Diagram

```mermaid
classDiagram
    class App {
        -isAuthenticated: boolean
        -user: User
        -status: ClockStatus
        +handleLogin()
        +handleLogout()
        +handleClockIn()
        +handleClockOut()
        +fetchReport()
        +downloadExcelReport()
    }
    
    class Auth {
        -formData: object
        -isLogin: boolean
        +handleSubmit()
    }
    
    class AdminPanel {
        -users: array
        +fetchUsers()
        +formatDate()
    }
    
    class BackendServer {
        -db: Database
        +authenticateToken()
        +requireAdmin()
        +register()
        +login()
        +clockIn()
        +clockOut()
        +getReport()
        +getAllUsers()
    }
    
    class User {
        +id: int
        +username: string
        +email: string
        +password: string
        +isAdmin: boolean
    }
    
    class ClockRecord {
        +id: int
        +userId: int
        +date: string
        +clockIn: string
        +clockOut: string
        +createdAt: datetime
    }
    
    App --> Auth
    App --> AdminPanel
    App --> BackendServer
    BackendServer --> User
    BackendServer --> ClockRecord
    ClockRecord --> User : "belongs to"
```

## 8. API Endpoints Structure

```mermaid
graph LR
    A[API Base: /api] --> B[Authentication]
    A --> C[Clock Operations]
    A --> D[Reports]
    A --> E[Admin]
    
    B --> B1[POST /register]
    B --> B2[POST /login]
    B --> B3[GET /me]
    
    C --> C1[GET /status]
    C --> C2[POST /clock-in]
    C --> C3[POST /clock-out]
    
    D --> D1[GET /report?period=]
    
    E --> E1[GET /admin/users]
    
    style B fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#e8f5e9
    style E fill:#fce4ec
```

## Notes

- **Mermaid diagrams** are rendered automatically on GitHub
- All API endpoints require JWT authentication (except register/login)
- Admin endpoints require additional admin role verification
- Database uses SQLite with foreign key relationships
- Frontend uses React with Axios for API calls
- Excel export is handled client-side using XLSX library


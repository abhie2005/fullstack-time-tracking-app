import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Auth from './Auth';
import AdminPanel from './AdminPanel';
import JobModal from './JobModal';
import './App.css';

// Backend API URL - Update this to match your actual backend deployment URL
// On Render, this is typically: https://{your-service-name}.onrender.com/api
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://clock-in-out-backend.onrender.com/api';

// Configure axios to include token in requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (unauthorized)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState({
    clockedIn: false,
    clockInTime: null,
    clockOutTime: null,
    date: null
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('all');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      const userData = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setUser(userData);
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/jobs`);
      setJobs(response.data.jobs);
      // Set first job as current if no job is selected
      if (response.data.jobs.length > 0 && !currentJobId) {
        setCurrentJobId(response.data.jobs[0].id);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleJobCreated = () => {
    fetchJobs();
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/jobs/${jobId}`);
      fetchJobs();
      if (currentJobId === jobId) {
        setCurrentJobId(null);
      }
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error deleting job');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  useEffect(() => {
    // Fetch user info to check admin status and jobs
    const token = localStorage.getItem('token');
    if (token && isAuthenticated) {
      axios.get(`${API_BASE_URL}/me`)
        .then(response => {
          const updatedUser = { ...response.data, isAdmin: response.data.isAdmin };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        })
        .catch(error => {
          console.error('Error fetching user info:', error);
        });
      
      // Fetch jobs
      fetchJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleLogin = (token, userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    // fetchJobs and fetchStatus will be called by useEffect
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setStatus({
      clockedIn: false,
      clockInTime: null,
      clockOutTime: null,
      date: null
    });
    setShowReport(false);
    setReportData(null);
  };

  const fetchStatus = async () => {
    try {
      const params = currentJobId ? { job_id: currentJobId } : {};
      const response = await axios.get(`${API_BASE_URL}/status`, { params });
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const handleClockIn = async () => {
    if (!currentJobId && jobs.length > 0) {
      setMessage('Please select a job first');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setLoading(true);
    setMessage('');
    try {
      const data = currentJobId ? { job_id: currentJobId } : {};
      const response = await axios.post(`${API_BASE_URL}/clock-in`, data);
      setMessage(response.data.message);
      fetchStatus();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error clocking in');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = currentJobId ? { job_id: currentJobId } : {};
      const response = await axios.post(`${API_BASE_URL}/clock-out`, data);
      setMessage(response.data.message);
      fetchStatus();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error clocking out');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (period) => {
    try {
      const params = { period };
      if (currentJobId) {
        params.job_id = currentJobId;
      }
      const response = await axios.get(`${API_BASE_URL}/report`, { params });
      setReportData(response.data);
      setShowReport(true);
    } catch (error) {
      console.error('Error fetching report:', error);
      setMessage('Error fetching report');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleReportClick = () => {
    fetchReport(reportPeriod);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const calculateHours = (clockIn, clockOut, date) => {
    if (!clockIn || !clockOut) return 'N/A';
    const inTime = new Date(`${date}T${clockIn}`);
    const outTime = new Date(`${date}T${clockOut}`);
    const hours = (outTime - inTime) / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 'N/A') return 'N/A';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const downloadExcelReport = () => {
    if (!reportData || reportData.records.length === 0) {
      setMessage('No data to export');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Prepare data for Excel
    const excelData = reportData.records.map((record) => {
      const date = new Date(record.date);
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      let hours = null;
      if (record.clock_in && record.clock_out) {
        const inTime = new Date(`${record.date}T${record.clock_in}`);
        const outTime = new Date(`${record.date}T${record.clock_out}`);
        const hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        hours = parseFloat(hoursWorked.toFixed(2));
      }
      
      const salary = record.salary ? parseFloat(record.salary) : null;
      
      return {
        'Date': formattedDate,
        'Clock In': record.clock_in || 'N/A',
        'Clock Out': record.clock_out || 'In Progress',
        'Hours': hours,
        'Salary ($)': salary
      };
    });

    // Add empty row and summary section
    excelData.push({});
    excelData.push({
      'Date': 'SUMMARY',
      'Clock In': '',
      'Clock Out': '',
      'Hours': '',
      'Salary ($)': ''
    });
    excelData.push({
      'Date': 'Total Records',
      'Clock In': reportData.totalRecords,
      'Clock Out': '',
      'Hours': '',
      'Salary ($)': ''
    });
    excelData.push({
      'Date': 'Completed Records',
      'Clock In': reportData.completedRecords,
      'Clock Out': '',
      'Hours': '',
      'Salary ($)': ''
    });
    excelData.push({
      'Date': 'Total Hours',
      'Clock In': '',
      'Clock Out': '',
      'Hours': parseFloat(reportData.totalHours),
      'Salary ($)': ''
    });
    excelData.push({
      'Date': 'Total Salary',
      'Clock In': '',
      'Clock Out': '',
      'Hours': '',
      'Salary ($)': parseFloat(reportData.totalSalary)
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // Date
      { wch: 15 }, // Clock In
      { wch: 15 }, // Clock Out
      { wch: 12 }, // Hours
      { wch: 15 }  // Salary
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

    // Generate filename with date and period
    const periodNames = {
      'all': 'All_Time',
      'today': 'Today',
      'week': 'Last_7_Days',
      'month': 'Last_30_Days'
    };
    const periodName = periodNames[reportPeriod] || 'Report';
    const today = new Date().toISOString().split('T')[0];
    const filename = `Clock_Report_${periodName}_${today}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
    
    setMessage('Report downloaded successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <div className="header-top">
            <div>
              <h1>🕐 Clock In/Out System</h1>
              <p className="subtitle">Track your office hours</p>
            </div>
            <div className="user-info">
              <span className="user-name">👤 {user?.username}</span>
              {user?.isAdmin && (
                <button 
                  onClick={() => setShowAdminPanel(true)} 
                  className="btn-admin"
                >
                  👥 View Users
                </button>
              )}
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Job Management Section */}
        <div className="jobs-section">
          <div className="jobs-header">
            <h2>💼 My Jobs</h2>
            <button 
              onClick={() => {
                setEditingJob(null);
                setShowJobModal(true);
              }}
              className="btn-add-job"
            >
              ➕ Add Job
            </button>
          </div>
          
          {jobs.length === 0 ? (
            <div className="no-jobs">
              <p>No jobs yet. Create your first job to start tracking time!</p>
            </div>
          ) : (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  className={`job-card ${currentJobId === job.id ? 'active' : ''}`}
                  onClick={() => setCurrentJobId(job.id)}
                >
                  <div className="job-card-content">
                    <h3>{job.name}</h3>
                    {job.description && <p className="job-description">{job.description}</p>}
                    <p className="job-rate">${job.hourly_rate}/hour</p>
                  </div>
                  <div className="job-card-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingJob(job);
                        setShowJobModal(true);
                      }}
                      className="job-btn-edit"
                      title="Edit job"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id);
                      }}
                      className="job-btn-delete"
                      title="Delete job"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="clock-section">
          <div className="status-card">
            <div className="status-indicator">
              <div className={`status-dot ${status.clockedIn ? 'active' : ''}`}></div>
              <span className="status-text">
                {status.clockedIn ? 'Clocked In' : 'Clocked Out'}
              </span>
            </div>
            
            {status.date && (
              <div className="date-display">
                <strong>Date:</strong> {formatDate(status.date)}
              </div>
            )}
            
            {status.clockInTime && (
              <div className="time-display">
                <strong>Clock In:</strong> {status.clockInTime}
              </div>
            )}
            
            {status.clockOutTime && (
              <div className="time-display">
                <strong>Clock Out:</strong> {status.clockOutTime}
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              onClick={handleClockIn}
              disabled={loading || status.clockedIn}
              className={`btn btn-clock-in ${status.clockedIn ? 'disabled' : ''}`}
            >
              {loading ? 'Processing...' : 'Clock In'}
            </button>
            <button
              onClick={handleClockOut}
              disabled={loading || !status.clockedIn}
              className={`btn btn-clock-out ${!status.clockedIn ? 'disabled' : ''}`}
            >
              {loading ? 'Processing...' : 'Clock Out'}
            </button>
          </div>
        </div>

        <div className="report-section">
          <h2>Generate Report</h2>
          <div className="report-controls">
            <select
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
              className="period-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <button onClick={handleReportClick} className="btn btn-report">
              Generate Report
            </button>
            {showReport && reportData && reportData.records.length > 0 && (
              <button onClick={downloadExcelReport} className="btn btn-download">
                📥 Download Excel
              </button>
            )}
          </div>

          {showReport && reportData && (
            <div className="report-card">
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Records:</span>
                  <span className="summary-value">{reportData.totalRecords}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Completed:</span>
                  <span className="summary-value">{reportData.completedRecords}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Hours:</span>
                  <span className="summary-value">{reportData.totalHours}h</span>
                </div>
                <div className="summary-item summary-item-salary">
                  <span className="summary-label">Total Salary:</span>
                  <span className="summary-value">{formatCurrency(reportData.totalSalary)}</span>
                </div>
              </div>

              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Hours</th>
                      <th>Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.records.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">No records found</td>
                      </tr>
                    ) : (
                      reportData.records.map((record) => (
                        <tr key={record.id}>
                          <td>{formatDate(record.date)}</td>
                          <td>{record.clock_in || 'N/A'}</td>
                          <td>{record.clock_out || 'In Progress'}</td>
                          <td>{record.hours ? `${record.hours}h` : 'N/A'}</td>
                          <td>{formatCurrency(record.salary)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {showJobModal && (
        <JobModal
          onClose={() => {
            setShowJobModal(false);
            setEditingJob(null);
          }}
          onJobCreated={handleJobCreated}
          editingJob={editingJob}
        />
      )}
    </div>
  );
}

export default App;
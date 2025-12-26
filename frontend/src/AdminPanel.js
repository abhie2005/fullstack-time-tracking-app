import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css';

// Backend API URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fullstack-time-tracking-app-backend.onrender.com/api';

function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/users`);
      setUsers(response.data.users);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-header">
          <h2>👥 All Users</h2>
          <button className="admin-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="admin-error">{error}</div>
        )}

        {loading ? (
          <div className="admin-loading">Loading users...</div>
        ) : (
          <div className="admin-content">
            <div className="admin-summary">
              <p>Total Users: <strong>{users.length}</strong></p>
              <button onClick={fetchUsers} className="btn-refresh">🔄 Refresh</button>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Total Records</th>
                    <th>Completed</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-users">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className={user.isAdmin ? 'admin-row' : ''}>
                        <td>{user.id}</td>
                        <td>
                          <strong>{user.username}</strong>
                          {user.isAdmin && <span className="admin-badge">👑 Admin</span>}
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.isAdmin ? 'role-admin' : 'role-user'}`}>
                            {user.isAdmin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td>{user.totalRecords}</td>
                        <td>{user.completedRecords}</td>
                        <td>{formatDate(user.createdAt)}</td>
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
  );
}

export default AdminPanel;

import React, { useState } from 'react';
import axios from 'axios';
import './JobModal.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fullstack-time-tracking-app.onrender.com/api';

function JobModal({ onClose, onJobCreated, editingJob }) {
  const [formData, setFormData] = useState({
    name: editingJob?.name || '',
    description: editingJob?.description || '',
    hourly_rate: editingJob?.hourly_rate || 18
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (editingJob) {
        // Update existing job
        await axios.put(`${API_BASE_URL}/jobs/${editingJob.id}`, formData);
      } else {
        // Create new job
        await axios.post(`${API_BASE_URL}/jobs`, formData);
      }
      onJobCreated();
      onClose();
    } catch (err) {
      console.error('Error creating/updating job:', err);
      setError(err.response?.data?.error || err.message || 'An error occurred. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="job-modal-overlay" onClick={onClose}>
      <div className="job-modal" onClick={(e) => e.stopPropagation()}>
        <div className="job-modal-header">
          <h2>{editingJob ? 'Edit Job' : '➕ Add New Job'}</h2>
          <button className="job-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="job-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="job-modal-form">
          <div className="job-form-group">
            <label htmlFor="name">Job Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Frontend Developer, Freelance Designer"
            />
          </div>

          <div className="job-form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add any notes about this job..."
              rows="3"
            />
          </div>

          <div className="job-form-group">
            <label htmlFor="hourly_rate">Hourly Rate ($)</label>
            <input
              type="number"
              id="hourly_rate"
              name="hourly_rate"
              value={formData.hourly_rate}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="job-modal-actions">
            <button type="button" onClick={onClose} className="job-btn-cancel">
              Cancel
            </button>
            <button type="submit" className="job-btn-submit" disabled={loading}>
              {loading ? 'Saving...' : editingJob ? 'Update Job' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default JobModal;


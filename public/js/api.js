// Front-end API Client wrapper
const API = {
  // Helper for requests, auto-handles 401
  async request(url, options = {}) {
    try {
      const response = await fetch(url, options);
      
      // If unauthorized, redirect to login
      if (response.status === 401 && !url.includes('/api/auth/me') && !url.includes('/api/auth/login')) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
      }
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan pada server');
      }
      return data;
    } catch (error) {
      console.error(`API Error [${url}]:`, error);
      throw error;
    }
  },

  // Auth operations
  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return null;
      }
      return await res.json();
    } catch (err) {
      window.location.href = '/login.html';
      return null;
    }
  },

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },

  // Student operations
  async getStudents() {
    return this.request('/api/students');
  },

  async addStudent(studentData) {
    return this.request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
  },

  async updateStudent(id, studentData) {
    return this.request(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
  },

  async deleteStudent(id) {
    return this.request(`/api/students/${id}`, {
      method: 'DELETE'
    });
  },

  async markStudentSick(id, date) {
    return this.request(`/api/students/${id}/sick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
  },

  async unmarkStudentSick(id, date) {
    return this.request(`/api/students/${id}/sick/${date}`, {
      method: 'DELETE'
    });
  },

  async markWhatsAppSent(id) {
    return this.request(`/api/students/${id}/whatsapp-sent`, {
      method: 'POST'
    });
  },

  // Holiday operations
  async getHolidays() {
    return this.request('/api/holidays');
  },

  async addHoliday(holidayData) {
    return this.request('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayData)
    });
  },

  async deleteHoliday(id) {
    return this.request(`/api/holidays/${id}`, {
      method: 'DELETE'
    });
  },

  // Summary statistics
  async getSummary() {
    return this.request('/api/dashboard-summary');
  },

  // User Management operations (Super Admin)
  async getUsers() {
    return this.request('/api/users');
  },

  async addUser(username, password) {
    return this.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },

  async resetPassword(id, password) {
    return this.request(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
  }
};

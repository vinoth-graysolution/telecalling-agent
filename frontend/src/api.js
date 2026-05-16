const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('medvoice_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Session expired');
      }
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  },

  async post(endpoint, body) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return response.json();
  },

  async patch(endpoint, body) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    return response.json();
  }
};

export const getStats = () => api.get('/dashboard/stats');

/**
 * Fetch appointments from the backend.
 * Backend uses /api/appointments?page=X&page_size=Y
 */
export const getAppointments = async (pageSize = 50, page = 1) => {
  const data = await api.get(`/appointments?page=${page}&page_size=${pageSize}`);
  // Backend returns { total, page, page_size, pages, appointments: [] }
  return data.appointments || [];
};

export const updateAppointmentStatus = (id, status) => 
  api.patch(`/appointments/${id}`, { status });

export const getAppointmentDetails = (id) => api.get(`/appointments/${id}`);

export const getHealth = () => api.get('/health');

/**
 * Fetch call logs from the backend.
 * Backend uses /api/logs?page=X&status=Y
 */
export const getCallLogs = (page = 1, status = null) => {
  const query = status ? `&status=${status}` : '';
  return api.get(`/logs?page=${page}${query}`);
};

// For the Escalations page
export const getEscalations = () => getCallLogs(1, 'failed');

/**
 * Trigger an outbound call.
 * Uses the Outbound Service /start endpoint.
 */
export const startOutboundCall = (phoneNumber) => 
  api.post('/start', {
    dialout_settings: {
      phone_number: phoneNumber
    }
  });

export const getPatients = async (page = 1, pageSize = 20) => {
  const data = await api.get(`/patients?page=${page}&page_size=${pageSize}`);
  return data;
};

export const getPatientHistory = async (phone) => {
  const data = await api.get(`/patients/${phone}/history`);
  return data;
};

export const getLiveCalls = async () => {
  const data = await api.get('/dashboard/live');
  return data;
};

// Admin User Management
export const getAdminUsers = () => api.get('/admin/users');

export const createAdminUser = (email, name, role) =>
  api.post('/admin/users', { email, name, role });

export const disableAdminUser = async (username) => {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
};

export default api;

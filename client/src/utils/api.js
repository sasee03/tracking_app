import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (username, password) => 
    api.post('/auth/register', { username, password }),
  login: (username, password) => 
    api.post('/auth/login', { username, password })
};

export const habitAPI = {
  getHabits: (year, month) => 
    api.get(`/habits/${year}/${month}`),
  saveHabits: (year, month, habits) => 
    api.post(`/habits/${year}/${month}`, { habits }),
  getYearlyReport: (year) => 
    api.get(`/habits/report/${year}`)
};

export default api;
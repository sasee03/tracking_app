import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, LogOut, Calendar, Award } from 'lucide-react';
import { authAPI, habitAPI } from './utils/api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('tracker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [sleepData, setSleepData] = useState({});

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadHabits();
      loadSleepData();
    }
  }, [user, currentMonth, currentYear]);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { username, password } = loginForm;

    if (!username || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      let response;
      if (isRegistering) {
        response = await authAPI.register(username, password);
      } else {
        response = await authAPI.login(username, password);
      }

      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setLoginForm({ username: '', password: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    }

    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setHabits([]);
    setLoginForm({ username: '', password: '' });
  };

  const loadHabits = async () => {
    if (!user) return;

    try {
      const response = await habitAPI.getHabits(currentYear, currentMonth);
      const loadedHabits = response.data.map(habit => {
        // Convert MongoDB Map to regular object
        const completions = {};
        if (habit.completions) {
          if (habit.completions instanceof Map) {
            habit.completions.forEach((value, key) => {
              completions[key] = value;
            });
          } else if (typeof habit.completions === 'object') {
            Object.assign(completions, habit.completions);
          }
        }
        return {
          id: habit._id,
          name: habit.name,
          completions
        };
      });
      setHabits(loadedHabits);
    } catch (error) {
      console.error('Failed to load habits:', error);
      setHabits([]);
    }
  };

  const saveHabits = async (updatedHabits) => {
    if (!user) return;

    try {
      const habitsToSave = updatedHabits.map(habit => ({
        name: habit.name,
        completions: habit.completions
      }));
      await habitAPI.saveHabits(currentYear, currentMonth, habitsToSave);
    } catch (error) {
      console.error('Failed to save habits:', error);
    }
  };

  const addHabit = () => {
    if (newHabit.trim()) {
      const newHabits = [
        ...habits,
        {
          id: Date.now(),
          name: newHabit.trim(),
          completions: {}
        }
      ];
      setHabits(newHabits);
      saveHabits(newHabits);
      setNewHabit('');
      setShowAddHabitModal(false);
    }
  };

  const deleteHabit = (id) => {
    const newHabits = habits.filter(h => h.id !== id);
    setHabits(newHabits);
    saveHabits(newHabits);
  };

  const toggleDay = (habitId, day) => {
    const newHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const completions = { ...habit.completions };
        if (completions[day]) {
          delete completions[day];
        } else {
          completions[day] = true;
        }
        return { ...habit, completions };
      }
      return habit;
    });
    setHabits(newHabits);
    saveHabits(newHabits);
  };

  const getProgress = (habit) => {
    const completed = Object.keys(habit.completions).length;
    return (completed / daysInMonth) * 100;
  };

  const getMonthlyStats = (habits) => {
    const totalDays = habits.length * daysInMonth;
    const completedDays = habits.reduce((sum, h) => sum + Object.keys(h.completions).length, 0);
    const percentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

    return {
      totalHabits: habits.length,
      totalDays,
      completedDays,
      percentage: percentage.toFixed(1),
      bestHabit: habits.reduce((best, h) => {
        const count = Object.keys(h.completions).length;
        return count > (best.count || 0) ? { name: h.name, count } : best;
      }, {})
    };
  };

  const getYearlyReport = async () => {
    if (!user) return null;

    try {
      const response = await habitAPI.getYearlyReport(currentYear);
      const yearHabits = response.data;

      const monthlyData = [];
      for (let month = 1; month <= 12; month++) {
        const monthHabits = yearHabits.filter(h => h.month === month);
        const daysInThisMonth = new Date(currentYear, month, 0).getDate();

        if (monthHabits.length > 0) {
          const totalDays = monthHabits.length * daysInThisMonth;
          const completedDays = monthHabits.reduce((sum, h) => {
            return sum + Object.keys(h.completions || {}).length;
          }, 0);
          const percentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

          monthlyData.push({
            month: new Date(currentYear, month - 1).toLocaleString('default', { month: 'long' }),
            totalHabits: monthHabits.length,
            completedDays,
            percentage: percentage.toFixed(1)
          });
        } else {
          monthlyData.push({
            month: new Date(currentYear, month - 1).toLocaleString('default', { month: 'long' }),
            totalHabits: 0,
            completedDays: 0,
            percentage: 0
          });
        }
      }

      return monthlyData;
    } catch (error) {
      console.error('Failed to load yearly report:', error);
      return [];
    }
  };

  const loadSleepData = async () => {
    if (!user) return;

    try {
      const response = await habitAPI.getSleepData(currentYear, currentMonth);
      setSleepData(response.data || {});
    } catch (error) {
      console.error('Failed to load sleep data:', error);
      setSleepData({});
    }
  };
  const saveSleepData = async (updatedSleepData) => {
    if (!user) return;

    try {
      await habitAPI.saveSleepData(currentYear, currentMonth, updatedSleepData);
    } catch (error) {
      console.error('Failed to save sleep data:', error);
    }
  };

  const toggleSleepHour = (day, hour) => {
    const newSleepData = { ...sleepData };
    const currentHours = newSleepData[day] || 0;
    
    // If clicking the same hour, remove it, otherwise set new hour
    if (currentHours === hour) {
      delete newSleepData[day];
    } else {
      newSleepData[day] = hour;
    }
    
    setSleepData(newSleepData);
    saveSleepData(newSleepData);
  };

  const SleepTracker = () => {
    const hours = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
    const days = [...Array(daysInMonth)].map((_, i) => i + 1);

    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Sleep Tracking (4-8 hours)</h3>
        <div className="relative" style={{ height: '250px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-600 pr-2" style={{ width: '40px' }}>
            {[...hours].reverse().map(hour => (
              <div key={hour} className="text-right">{hour}h</div>
            ))}
          </div>

          {/* Chart area */}
          <div className="ml-10 relative border-l border-b border-gray-300" style={{ height: '100%' }}>
            {/* Horizontal grid lines */}
            {hours.map((hour, idx) => (
              <div 
                key={hour} 
                className="absolute w-full border-t border-gray-100" 
                style={{ bottom: `${(idx / (hours.length - 1)) * 100}%` }}
              />
            ))}

            {/* SVG for lines and dots */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Draw lines between consecutive days */}
              {days.map((day, idx) => {
                if (idx === 0 || !sleepData[day] || !sleepData[day - 1]) return null;
                
                const prevHours = sleepData[day - 1];
                const currHours = sleepData[day];
                
                const x1 = ((day - 2) / (daysInMonth - 1)) * 100;
                const y1 = 100 - (((prevHours - 4) / 4) * 100);
                const x2 = ((day - 1) / (daysInMonth - 1)) * 100;
                const y2 = 100 - (((currHours - 4) / 4) * 100);

                return (
                  <line
                    key={day}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Clickable day columns */}
            <div className="absolute inset-0 flex">
              {days.map(day => (
                <div key={day} className="flex-1 relative" style={{ minWidth: '0' }}>
                  {/* Clickable areas for each hour */}
                  {hours.map((hour, hIdx) => (
                    <button
                      key={hour}
                      onClick={() => toggleSleepHour(day, hour)}
                      className="absolute w-full hover:bg-blue-50 transition-colors pointer-events-auto"
                      style={{
                        bottom: `${(hIdx / (hours.length - 1)) * 100}%`,
                        height: `${100 / (hours.length - 1)}%`,
                        transform: 'translateY(50%)'
                      }}
                    />
                  ))}
                  
                  {/* Show dot if this day has sleep data */}
                  {sleepData[day] && (
                    <div
                      className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md pointer-events-none"
                      style={{
                        bottom: `${((sleepData[day] - 4) / 4) * 100}%`,
                        left: '50%',
                        transform: 'translate(-50%, 50%)'
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* X-axis day labels */}
            <div className="absolute -bottom-6 left-0 right-0 flex text-xs text-gray-600">
              {days.filter((_, idx) => idx % 5 === 0 || idx === days.length - 1).map(day => (
                <div 
                  key={day} 
                  className="absolute" 
                  style={{ left: `${((day - 1) / (daysInMonth - 1)) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MonthlyReport = () => {
    const stats = getMonthlyStats(habits);
    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Calendar className="text-blue-500" />
            Monthly Report - {monthName}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Habits</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalHabits}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Days Completed</p>
              <p className="text-3xl font-bold text-green-600">{stats.completedDays}/{stats.totalDays}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Overall Progress</p>
              <p className="text-3xl font-bold text-purple-600">{stats.percentage}%</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Best Habit</p>
              <p className="text-lg font-bold text-yellow-700 truncate">{stats.bestHabit.name || 'N/A'}</p>
              <p className="text-sm text-gray-600">{stats.bestHabit.count || 0} days</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-700">Habit Performance</h3>
            {habits.map(habit => {
              const completed = Object.keys(habit.completions).length;
              const percentage = ((completed / daysInMonth) * 100).toFixed(1);

              return (
                <div key={habit.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-800">{habit.name}</span>
                    <span className="text-sm text-gray-600">{completed}/{daysInMonth} days ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const YearlyReport = () => {
    const [yearData, setYearData] = useState([]);
    const [loadingReport, setLoadingReport] = useState(true);

    useEffect(() => {
      const loadYearData = async () => {
        const data = await getYearlyReport();
        setYearData(data || []);
        setLoadingReport(false);
      };
      loadYearData();
    }, []);

    if (loadingReport) {
      return <div className="text-center py-8">Loading yearly report...</div>;
    }

    const totalCompleted = yearData.reduce((sum, m) => sum + m.completedDays, 0);
    const avgPercentage = yearData.length > 0
      ? (yearData.reduce((sum, m) => sum + parseFloat(m.percentage), 0) / yearData.filter(m => m.totalHabits > 0).length).toFixed(1)
      : 0;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Award className="text-yellow-500" />
            Year End Report - {currentYear}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg">
              <p className="text-sm opacity-90">Total Days Completed</p>
              <p className="text-4xl font-bold">{totalCompleted}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg">
              <p className="text-sm opacity-90">Average Completion</p>
              <p className="text-4xl font-bold">{avgPercentage}%</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg">
              <p className="text-sm opacity-90">Months Tracked</p>
              <p className="text-4xl font-bold">{yearData.filter(m => m.totalHabits > 0).length}</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-700 mb-4">Monthly Breakdown</h3>
          <div className="space-y-3">
            {yearData.map((month, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-800">{month.month}</span>
                  <span className="text-sm text-gray-600">
                    {month.completedDays} days • {month.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${month.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Habit Tracker
          </h1>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login')}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="w-full text-blue-500 hover:text-blue-600 text-sm"
            >
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Habit Tracker</h1>
            <p className="text-gray-600">Welcome, {user.username}!</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('tracker')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'tracker' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Tracker
            </button>
            <button
              onClick={() => setView('monthly-report')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'monthly-report' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Monthly Report
            </button>
            <button
              onClick={() => setView('yearly-report')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'yearly-report' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Yearly Report
            </button>
            <button
              onClick={() => setShowAddHabitModal(true)}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              title="Add New Habit"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>

        {view === 'monthly-report' && <MonthlyReport />}
        {view === 'yearly-report' && <YearlyReport />}

        {view === 'tracker' && (
          <>
            {/* Add Habit Modal */}
            {showAddHabitModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Habit</h3>
                  <input
                    type="text"
                    value={newHabit}
                    onChange={(e) => setNewHabit(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addHabit()}
                    placeholder="Enter habit name (e.g., Exercise, Read, Meditate)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowAddHabitModal(false);
                        setNewHabit('');
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addHabit}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Add Habit
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              <div className="text-center text-gray-600">
                <p className="font-medium">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                <p className="text-sm">Days in month: {daysInMonth}</p>
              </div>
            </div>

            {habits.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <p className="text-gray-500 text-lg">No habits yet. Add your first habit to get started!</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-200" style={{ width: '100px' }}>
                        Habit
                      </th>
                      {[...Array(daysInMonth)].map((_, i) => (
                        <th key={i} className="px-0.5 py-1.5 text-center text-xs font-medium text-gray-600" style={{ width: '34px', minWidth: '34px' }}>
                          {i + 1}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700 border-l border-gray-200" style={{ width: '70px' }}>
                        Prog
                      </th>
                      <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-700 border-l border-gray-200" style={{ width: '60px' }}>
                        Del
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {habits.map((habit, idx) => (
                      <tr key={habit.id} className={`hover:bg-gray-50 transition-colors ${idx !== habits.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <td className="px-3 py-1 font-medium text-gray-800 sticky left-0 bg-white z-10 text-sm border-r border-gray-200">
                          {habit.name}
                        </td>
                        {[...Array(daysInMonth)].map((_, day) => (
                          <td key={day} className="px-0.5 py-1 text-center">
                            <button
                              onClick={() => toggleDay(habit.id, day + 1)}
                              className={`w-7 h-7 rounded-md transition-all transform hover:scale-105 ${
                                habit.completions[day + 1]
                                  ? 'bg-green-500 hover:bg-green-600 shadow-sm'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                            >
                              {habit.completions[day + 1] && (
                                <Check size={14} className="mx-auto text-white" />
                              )}
                            </button>
                          </td>
                        ))}
                        <td className="px-2 py-1 border-l border-gray-200">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-8 bg-gray-200 rounded-full overflow-hidden h-12 flex flex-col-reverse">
                              <div
                                className="bg-gradient-to-t from-green-500 to-green-400 transition-all duration-300 rounded-full"
                                style={{ height: `${getProgress(habit)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">
                              {Object.keys(habit.completions).length}/{daysInMonth}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center border-l border-gray-200">
                          <button
                            onClick={() => deleteHabit(habit.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <SleepTracker />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
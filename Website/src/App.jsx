// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/core/Navbar';
import Overview from './pages/Overview';
import Markets from './pages/Markets';
import PlaceholderPage from './components/common/PlaceholderPage';
import Portfolio from './pages/Portfolio';
import Orders from './pages/Orders';
import Leaderboard from './pages/leaderboard';
import Insights from './pages/insights';
import Settings from './pages/settings';
import Login from './pages/Login';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <div className="bg-gray-900 transition-colors duration-300 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Overview />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/portfolio" element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/insights" element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<PlaceholderPage title="404 - Page Not Found" />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
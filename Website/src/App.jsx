// src/App.jsx
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/core/Navbar';
import Overview from './pages/Overview';
import Markets from './pages/Markets';
import PlaceholderPage from './components/common/PlaceholderPage';
import Portfolio from './pages/Portfolio';
import Orders from './pages/Orders';
import Leaderboard from './pages/Leaderboard';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Landing from './pages/Landing';
import ProtectedRoute from './components/common/ProtectedRoute';

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<Landing />} />
    <Route path="/landing" element={<Landing />} />
    <Route path="/overview" element={
      <ProtectedRoute>
        <Overview />
      </ProtectedRoute>
    } />
    <Route path="/markets" element={
      <ProtectedRoute>
        <Markets />
      </ProtectedRoute>
    } />
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
    <Route path="/leaderboard" element={
      <ProtectedRoute>
        <Leaderboard />
      </ProtectedRoute>
    } />
    <Route path="/insights" element={
      <ProtectedRoute>
        <Insights />
      </ProtectedRoute>
    } />
    <Route path="/settings" element={
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    } />
    <Route path="*" element={<PlaceholderPage title="404 - Page Not Found" />} />
  </Routes>
);

const AppShell = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const hideNavbarRoutes = new Set(['/', '/landing', '/login']);
  const showNavbar = isAuthenticated && !hideNavbarRoutes.has(location.pathname);

  return (
    <div className="bg-slate-950 transition-colors duration-300 min-h-screen">
      {showNavbar && <Navbar />}
      <AppRoutes />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
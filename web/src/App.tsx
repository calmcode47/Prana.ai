import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForecastPage } from './pages/ForecastPage';
import { FederatedPage } from './pages/FederatedPage';
import { AlertsPage } from './pages/AlertsPage';
import { ApiDocsPage } from './pages/ApiDocsPage';

export const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background text-on-surface">
        <Navigation />
        <main className="flex-1 w-full pt-16">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/map" element={<DashboardPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/federated" element={<FederatedPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;

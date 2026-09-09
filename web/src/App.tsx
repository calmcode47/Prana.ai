import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForecastPage } from './pages/ForecastPage';
import { AirCorridorMapPage } from './pages/AirCorridorMapPage';
import { FederatedPage } from './pages/FederatedPage';
import { AlertsPage } from './pages/AlertsPage';
import { CitizenScannerPage } from './pages/CitizenScannerPage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-canvas-cream text-ink-black selection:bg-primary selection:text-on-primary font-body-md transition-colors">
            <Header />
            <main className="flex-1 w-full">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/operations-war-room" element={<DashboardPage />} />
                <Route path="/dashboard" element={<Navigate to="/operations-war-room" replace />} />
                <Route path="/72h-plume-forecast" element={<ForecastPage />} />
                <Route path="/forecast" element={<Navigate to="/72h-plume-forecast" replace />} />
                <Route path="/air-corridor-map" element={<AirCorridorMapPage />} />
                <Route path="/map" element={<Navigate to="/air-corridor-map" replace />} />
                <Route path="/federated-mesh" element={<FederatedPage />} />
                <Route path="/federated" element={<Navigate to="/federated-mesh" replace />} />
                <Route path="/spcb-incident-command" element={<AlertsPage />} />
                <Route path="/alerts" element={<Navigate to="/spcb-incident-command" replace />} />
                <Route path="/citizen-scanner" element={<CitizenScannerPage />} />
                <Route path="/citizen" element={<Navigate to="/citizen-scanner" replace />} />
                <Route path="/api-docs" element={<Navigate to="/operations-war-room" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;

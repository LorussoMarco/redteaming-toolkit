import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import './assets/css/App.css';

// Lazy loading per i componenti delle pagine
const NmapTool = lazy(() => import('./pages/tools/NmapTool'));
const AmassTool = lazy(() => import('./pages/tools/AmassTool'));
const ExploitTool = lazy(() => import('./pages/tools/ExploitTool'));

// Placeholder per i componenti di strumenti non ancora sviluppati
const ToolPlaceholder = ({ toolName }) => {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>{toolName || 'Tool'} Interface</h1>
      <p>The {toolName || 'tool'} interface is under development.</p>
    </div>
  );
};

// Componente di fallback durante il caricamento
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '1.2rem'
  }}>
    Caricamento...
  </div>
);

function App() {
  // Gestiamo gli errori a livello di app
  React.useEffect(() => {
    const handleError = (event) => {
      if (event.message && event.message.includes("Cannot read properties of null")) {
        console.warn('Prevented error:', event.message);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            
            {/* Projects page */}
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:projectId" element={<ProjectDetail />} />
            
            {/* Reports page */}
            <Route path="reports" element={<Reports />} />
            
            {/* Library route - redirect to reports */}
            <Route path="library" element={<Navigate to="/reports" replace />} />
            
            {/* Tool routes */}
            <Route path="reconnaissance/nmap" element={<NmapTool />} />
            <Route path="reconnaissance/amass" element={<AmassTool />} />
            <Route path="exploitation/metasploit" element={<ExploitTool />} />
            <Route path="tools/exploit" element={<ExploitTool />} />
            
            {/* Route per gestire percorsi non validi */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

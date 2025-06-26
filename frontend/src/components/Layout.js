import React, { Component } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import '../assets/css/Layout.css';

// Componente ErrorBoundary per catturare errori nei componenti figli
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Aggiorna lo stato per mostrare l'UI di fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Puoi anche loggare l'errore
    console.error('Errore catturato da ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // UI di fallback
      return (
        <div style={{ padding: '2rem', margin: '2rem auto', maxWidth: '800px', textAlign: 'center' }}>
          <h2>Qualcosa è andato storto</h2>
          <p>Si è verificato un errore nell'applicazione. Prova a ricaricare la pagina.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '0.5rem 1rem', 
              marginTop: '1rem', 
              backgroundColor: '#54b4eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Ricarica pagina
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Layout = () => {
  return (
    <div className="app-container">
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      <main className="content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default Layout; 
import React from 'react';
import ReactDOM from 'react-dom/client';
import './assets/css/index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';

// Add global error handler at the top of the file
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Gestione globale degli errori per prevenire crash dell'app
window.addEventListener('error', (event) => {
  // Verifica se l'errore proviene da un'estensione Chrome
  if (event.filename && event.filename.includes('chrome-extension://')) {
    console.warn('Errore da estensione Chrome ignorato:', event.error);
    // Previeni la propagazione dell'errore
    event.preventDefault();
    return true;
  }
  return false;
});

// Intercetta le promise non gestite che potrebbero derivare da estensioni
window.addEventListener('unhandledrejection', (event) => {
  const errorString = String(event.reason);
  if (errorString.includes('chrome-extension://')) {
    console.warn('Promise rejection da estensione Chrome ignorata:', event.reason);
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

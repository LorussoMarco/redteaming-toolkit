import React, { useState, useEffect, useRef } from 'react';
import '../assets/css/SystemLogs.css';
import api from '../api/api';

const SystemLogs = ({ maxLogs = 10, refreshInterval = 5000, height = '300px', service = null, title = 'Log di Sistema' }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const logsContainerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId;

    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const response = await api.getSystemLogs(maxLogs, service);
        if (isMounted) {
          if (response && response.logs) {
            // Ordina i log per timestamp (dal più recente al più vecchio)
            const sortedLogs = [...response.logs].sort((a, b) => {
              // Converti le stringhe di timestamp in oggetti Date per il confronto
              const dateA = new Date(a.timestamp);
              const dateB = new Date(b.timestamp);
              // Ordine decrescente (b - a per avere i più recenti prima)
              return dateB - dateA;
            });
            setLogs(sortedLogs);
            setError(null);
          } else {
            setError('Formato di risposta non valido');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Errore durante il recupero dei log:', err);
          setError('Impossibile recuperare i log di sistema');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Fetch logs immediately
    fetchLogs();

    // Set up interval for fetching logs
    intervalId = setInterval(fetchLogs, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [maxLogs, refreshInterval, service]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const getLogLevelClass = (level) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'log-error';
      case 'warning':
        return 'log-warning';
      case 'info':
        return 'log-info';
      case 'debug':
        return 'log-debug';
      default:
        return '';
    }
  };

  // Funzione per formattare correttamente il timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      // Verifica se il timestamp è nel formato YYYYMMDD_HHMMSS (es. 20250331_203053)
      const dateWithUnderscore = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/;
      if (dateWithUnderscore.test(timestamp)) {
        const match = timestamp.match(dateWithUnderscore);
        const year = match[1];
        const month = match[2];
        const day = match[3];
        const hours = match[4];
        const minutes = match[5];
        const seconds = match[6];
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      
      // Verifica se il timestamp è già nel formato corretto: YYYY-MM-DD HH:MM:SS
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
        const [datePart, timePart] = timestamp.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        
        return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
      }
      
      // Se il timestamp è nel formato ISO
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      
      // Tentativo generico di parsing
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      
      // Fallback: restituisci il timestamp originale
      return timestamp;
    } catch (e) {
      console.error('Errore nella formattazione del timestamp:', e);
      return timestamp;
    }
  };

  return (
    <div className={`system-logs-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="system-logs-header" onClick={toggleExpand}>
        <h3>{title}</h3>
        <div className="system-logs-controls">
          {isLoading && <div className="loading-dots-small"><span>.</span><span>.</span><span>.</span></div>}
          <button className="expand-button">
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="system-logs-content" style={{ maxHeight: height }} ref={logsContainerRef}>
          {error ? (
            <div className="system-logs-error">
              <p>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="system-logs-empty">
              <p>Nessun log disponibile</p>
            </div>
          ) : (
            <ul className="system-logs-list">
              {logs.map((log, index) => (
                <li key={index} className={`log-item ${getLogLevelClass(log.level)}`}>
                  <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  <span className="log-level">{log.level}</span>
                  <span className="log-service">{log.service || 'system'}</span>
                  <span className="log-message">{log.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemLogs; 
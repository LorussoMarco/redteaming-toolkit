import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../assets/css/ActivityTimeline.css';
import api from '../api/api';

const ActivityTimeline = ({ limit = 5 }) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        const response = await api.getRecentActivities(limit);
        if (response && response.activities) {
          setActivities(response.activities);
          setError(null);
        } else {
          setError('Formato di risposta non valido');
        }
      } catch (err) {
        console.error('Errore durante il recupero delle attività:', err);
        setError('Impossibile recuperare le attività recenti');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [limit]);

  const getActivityIcon = (tool, status) => {
    if (status === 'failed') return '❌';
    
    switch(tool) {
      case 'nmap':
        return '🔍';
      case 'amass':
        return '🌐';
      case 'metasploit':
        return '🛠️';
      case 'linpeas':
      case 'winpeas':
        return '🔒';
      default:
        return '📊';
    }
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'in_progress':
        return 'status-in-progress';
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Data sconosciuta';
    
    // Gestisce formati di data diversi, inclusi quelli personalizzati come 20250331_205846
    let date;
    
    // Se è una stringa nel formato 20250331_205846
    if (typeof timestamp === 'string' && timestamp.match(/^\d{8}_\d{6}$/)) {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(9, 11);
      const minute = timestamp.substring(11, 13);
      const second = timestamp.substring(13, 15);
      
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    } else {
      date = new Date(timestamp);
    }
    
    // Controlla se la data è valida
    if (isNaN(date.getTime())) {
      console.warn('Data non valida:', timestamp);
      return 'Data sconosciuta';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHrs = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min fa`;
    } else if (diffHrs < 24) {
      return `${diffHrs} ore fa`;
    } else if (diffDays < 7) {
      return `${diffDays} giorni fa`;
    } else {
      return date.toLocaleDateString('it-IT');
    }
  };

  // Funzione per generare il link al report corretto
  const getReportLink = (activity) => {
    if (!activity.report_id && activity.tool !== 'nmap') return null;
    
    // Per i report di nmap, utilizziamo l'ID dell'attività se non c'è un report_id specifico
    const reportId = activity.tool === 'nmap' && !activity.report_id ? activity.id : activity.report_id;
    
    // Crea un link che punta alla scheda corretta nella libreria dei report
    return `/reports?tool=${activity.tool}&id=${reportId}`;
  };

  if (isLoading) {
    return (
      <div className="activity-timeline">
        <h2 className="timeline-title">Attività Recenti</h2>
        <div className="activity-loading">
          <div className="activity-spinner"></div>
          <p>Caricamento attività...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-timeline">
        <h2 className="timeline-title">Attività Recenti</h2>
        <div className="activity-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-timeline">
        <h2 className="timeline-title">Attività Recenti</h2>
        <div className="activity-empty">
          <p>Nessuna attività recente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-timeline">
      <h2 className="timeline-title">Attività Recenti</h2>
      <ul className="timeline-list">
        {activities.map((activity, index) => (
          <li key={index} className="timeline-item">
            <div className="timeline-icon">
              {getActivityIcon(activity.tool, activity.status)}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-tool">{activity.tool}</span>
                <span className={`timeline-status ${getStatusClass(activity.status)}`}>
                  {activity.status === 'completed' ? 'Completato' : 
                   activity.status === 'failed' ? 'Fallito' : 
                   activity.status === 'in_progress' ? 'In corso' : activity.status}
                </span>
              </div>
              <p className="timeline-description">
                {activity.description || `Scansione su ${activity.target || 'target sconosciuto'}`}
              </p>
              <div className="timeline-meta">
                <span className="timeline-timestamp">{formatTimestamp(activity.timestamp)}</span>
                {((activity.report_id || activity.tool === 'nmap') && activity.status === 'completed') && (
                  <Link to={getReportLink(activity)} className="view-report-link">
                    Visualizza Report
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="view-all-container">
        <Link to="/reports" className="view-all-link">Visualizza tutti i Report</Link>
      </div>
    </div>
  );
};

export default ActivityTimeline; 
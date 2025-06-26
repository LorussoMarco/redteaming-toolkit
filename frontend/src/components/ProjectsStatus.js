import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProjectApi from '../api/projectApi';
import '../assets/css/ProjectsStatus.css';

const ProjectsStatus = () => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    active: 0,
    completed: 0,
    archived: 0,
    total: 0
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await ProjectApi.getProjects();
        if (response && response.status === 'success') {
          setProjects(response.projects || []);
          
          // Calcola statistiche per stato
          const newStats = {
            active: 0,
            completed: 0,
            archived: 0,
            total: 0
          };
          
          response.projects.forEach(project => {
            newStats.total++;
            if (project.status === 'active') newStats.active++;
            else if (project.status === 'completed') newStats.completed++;
            else if (project.status === 'archived') newStats.archived++;
          });
          
          setStats(newStats);
          setError(null);
        } else {
          setError('Formato di risposta non valido');
        }
      } catch (err) {
        console.error('Errore durante il recupero dei progetti:', err);
        setError('Impossibile recuperare i progetti');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const renderRecentProjects = () => {
    // Mostra i progetti più recenti (massimo 3)
    const recentProjects = [...projects]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 3);

    if (recentProjects.length === 0) {
      return <p className="no-projects">Nessun progetto disponibile</p>;
    }

    return (
      <ul className="recent-projects-list">
        {recentProjects.map(project => (
          <li key={project.id} className="project-item">
            <div className="project-info">
              <span className="project-name">{project.name}</span>
              <span className={`project-status status-${project.status}`}>
                {project.status === 'active' ? 'Attivo' : 
                 project.status === 'completed' ? 'Completato' : 'Archiviato'}
              </span>
            </div>
            <div className="project-meta">
              <span className="project-phase">Fase: {project.phase}</span>
              <span className="project-date">
                {new Date(project.updated_at).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div className="projects-status">
        <h2 className="status-title">Stato dei Progetti</h2>
        <div className="projects-loading">
          <div className="projects-spinner"></div>
          <p>Caricamento progetti in corso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-status">
        <h2 className="status-title">Stato dei Progetti</h2>
        <div className="projects-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-status">
      <div className="status-header">
        <h2 className="status-title">Stato dei Progetti</h2>
        <Link to="/projects" className="view-all-link">
          Visualizza tutti
        </Link>
      </div>

      <div className="projects-overview">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Totale</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Attivi</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Completati</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.archived}</div>
          <div className="stat-label">Archiviati</div>
        </div>
      </div>

      <div className="recent-projects">
        <h3 className="section-title">Progetti Recenti</h3>
        {renderRecentProjects()}
      </div>
    </div>
  );
};

export default ProjectsStatus; 
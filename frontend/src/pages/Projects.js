import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProjectApi from '../api/projectApi';
import '../assets/css/Projects.css';

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    phase: 'discovery',
    status: 'active'
  });

  // Carica i progetti all'avvio
  useEffect(() => {
    loadProjects();
  }, []);

  // Funzione per caricare i progetti
  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await ProjectApi.getProjects();
      if (response.status === 'success') {
        setProjects(response.projects || []);
      } else {
        setError('Errore nel caricamento dei progetti');
      }
    } catch (err) {
      setError('Errore durante la connessione al server');
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  // Gestisce la creazione di un nuovo progetto
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Set fixed values for phase and status
      const projectData = {
        ...newProject,
        phase: 'discovery',
        status: 'active'
      };
      const response = await ProjectApi.createProject(projectData);
      if (response.status === 'success') {
        setShowCreateModal(false);
        setNewProject({
          name: '',
          description: '',
          phase: 'discovery',
          status: 'active'
        });
        loadProjects(); // Ricarica i progetti
      } else {
        setError('Errore nella creazione del progetto');
      }
    } catch (err) {
      setError('Errore durante la connessione al server');
      console.error('Error creating project:', err);
    } finally {
      setLoading(false);
    }
  };

  // Gestisce l'eliminazione di un progetto
  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Sei sicuro di voler eliminare questo progetto?')) {
      try {
        setLoading(true);
        const response = await ProjectApi.deleteProject(projectId);
        if (response.status === 'success') {
          loadProjects(); // Ricarica i progetti
        } else {
          setError('Errore nell\'eliminazione del progetto');
        }
      } catch (err) {
        setError('Errore durante la connessione al server');
        console.error('Error deleting project:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Gestisce i cambiamenti nei campi del form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProject({
      ...newProject,
      [name]: value
    });
  };

  // Renderizza lo stato del progetto con un colore appropriato
  const renderStatus = (status) => {
    let statusClass = '';
    
    switch (status) {
      case 'active':
        statusClass = 'status-active';
        break;
      case 'completed':
        statusClass = 'status-completed';
        break;
      case 'archived':
        statusClass = 'status-archived';
        break;
      default:
        statusClass = 'status-unknown';
    }
    
    return (
      <span className={`project-status ${statusClass}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h1>Progetti di Assessment</h1>
        <button 
          className="btn-create" 
          onClick={() => setShowCreateModal(true)}
        >
          Nuovo Progetto
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          Caricamento progetti...
        </div>
      ) : (
        <>
          {projects.length === 0 ? (
            <div className="no-projects">
              <p>Nessun progetto disponibile.</p>
              <p>Inizia creando un nuovo progetto di assessment.</p>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(project => (
                <div className="project-card" key={project.id}>
                  <div className="project-header">
                    <h2 className="project-name">{project.name}</h2>
                    {renderStatus(project.status)}
                  </div>
                  <div className="project-meta">
                    <span className="project-phase">Fase: {project.phase}</span>
                    <span className="project-timestamp">
                      Aggiornato: {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="project-description">
                    {project.description || 'Nessuna descrizione'}
                  </p>
                  <div className="project-actions">
                    <Link to={`/projects/${project.id}`} className="btn-view">
                      Dettagli
                    </Link>
                    <button 
                      className="btn-delete" 
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal per creare un nuovo progetto */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Crea Nuovo Progetto</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label htmlFor="name">Nome Progetto*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newProject.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Descrizione</label>
                <textarea
                  id="description"
                  name="description"
                  value={newProject.description}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowCreateModal(false)}
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Creazione...' : 'Crea Progetto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Projects; 
/**
 * Client API per la gestione dei progetti (utilizzando localStorage)
 */
import { API_URL } from './config';

// Chiavi per localStorage
const STORAGE_KEYS = {
  PROJECTS: 'local_projects',
  TARGETS: 'local_targets',
  REPORTS: 'local_reports',
};

// Helpers per localStorage
const getFromStorage = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage (${key}):`, error);
    return defaultValue;
  }
};

const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
    return false;
  }
};

// Genera un ID unico
const generateId = () => {
  return Math.floor(Math.random() * 10000) + 1 + Date.now().toString().slice(-6);
};

/**
 * Classe per la gestione delle API dei progetti
 */
class ProjectApi {
  /**
   * Ottiene la lista dei progetti
   * @param {Object} options - Opzioni di filtro
   * @returns {Promise<Object>} Risposta API
   */
  static async getProjects(options = {}) {
    try {
      // Recupera progetti da localStorage
      let projects = getFromStorage(STORAGE_KEYS.PROJECTS, []);
      
      // Filtra in base alle opzioni
      const { name } = options;
      
      if (name) {
        const searchTerm = name.toLowerCase();
        projects = projects.filter(p => p.name.toLowerCase().includes(searchTerm));
      }
      
      // Aggiungi conteggi per target e report
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, []);
      
      const projectsWithCounts = projects.map(project => ({
        ...project,
        targetsCount: targets.filter(t => t.project_id === project.id).length,
        reportsCount: reports.filter(r => r.project_id === project.id).length,
      }));
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        projects: projectsWithCounts
      };
    } catch (error) {
      console.error('Error fetching projects:', error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while fetching projects'
      };
    }
  }
  
  /**
   * Ottiene i dettagli di un progetto specifico
   * @param {number} projectId - ID del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async getProject(projectId) {
    try {
      // Recupera progetti da localStorage
      const projects = getFromStorage(STORAGE_KEYS.PROJECTS, []);
      const project = projects.find(p => p.id.toString() === projectId.toString());
      
      if (!project) {
        return {
          status: 'error',
          message: `Project with ID ${projectId} not found`
        };
      }
      
      // Aggiungi conteggi per target e report
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, []);
      
      const projectWithCounts = {
        ...project,
        targetsCount: targets.filter(t => t.project_id.toString() === projectId.toString()).length,
        reportsCount: reports.filter(r => r.project_id.toString() === projectId.toString()).length,
      };
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        project: projectWithCounts
      };
    } catch (error) {
      console.error(`Error fetching project ${projectId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while fetching the project'
      };
    }
  }
  
  /**
   * Crea un nuovo progetto
   * @param {Object} projectData - Dati del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async createProject(projectData) {
    try {
      // Recupera progetti esistenti
      const projects = getFromStorage(STORAGE_KEYS.PROJECTS, []);
      
      // Crea un nuovo progetto con ID generato
      const newProject = {
        ...projectData,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phase: 'discovery'
      };
      
      // Aggiungi il nuovo progetto alla lista
      const updatedProjects = [...projects, newProject];
      
      // Salva su localStorage
      saveToStorage(STORAGE_KEYS.PROJECTS, updatedProjects);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        project: newProject,
        project_id: newProject.id
      };
    } catch (error) {
      console.error('Error creating project:', error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while creating the project'
      };
    }
  }
  
  /**
   * Aggiorna un progetto esistente
   * @param {number} projectId - ID del progetto
   * @param {Object} projectData - Dati del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async updateProject(projectId, projectData) {
    try {
      // Recupera progetti esistenti
      const projects = getFromStorage(STORAGE_KEYS.PROJECTS, []);
      
      // Trova l'indice del progetto da aggiornare
      const projectIndex = projects.findIndex(p => p.id.toString() === projectId.toString());
      
      if (projectIndex === -1) {
        return {
          status: 'error',
          message: `Project with ID ${projectId} not found`
        };
      }
      
      // Aggiorna il progetto
      const updatedProject = {
        ...projects[projectIndex],
        ...projectData,
        updated_at: new Date().toISOString()
      };
      
      // Salva su localStorage
      const updatedProjects = [
        ...projects.slice(0, projectIndex),
        updatedProject,
        ...projects.slice(projectIndex + 1)
      ];
      saveToStorage(STORAGE_KEYS.PROJECTS, updatedProjects);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        project: updatedProject
      };
    } catch (error) {
      console.error(`Error updating project ${projectId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while updating the project'
      };
    }
  }
  
  /**
   * Elimina un progetto
   * @param {number} projectId - ID del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async deleteProject(projectId) {
    try {
      // Recupera progetti esistenti
      const projects = getFromStorage(STORAGE_KEYS.PROJECTS, []);
      
      // Filtra il progetto da eliminare
      const updatedProjects = projects.filter(p => p.id.toString() !== projectId.toString());
      
      if (projects.length === updatedProjects.length) {
        return {
          status: 'error',
          message: `Project with ID ${projectId} not found`
        };
      }
      
      // Elimina anche tutti i target, report e risorse associati
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      const updatedTargets = targets.filter(t => t.project_id.toString() !== projectId.toString());
      
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, []);
      const updatedReports = reports.filter(r => r.project_id.toString() !== projectId.toString());
      
      // Salva su localStorage
      saveToStorage(STORAGE_KEYS.PROJECTS, updatedProjects);
      saveToStorage(STORAGE_KEYS.TARGETS, updatedTargets);
      saveToStorage(STORAGE_KEYS.REPORTS, updatedReports);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success'
      };
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while deleting the project'
      };
    }
  }
  
  /**
   * Ottiene la lista dei target
   * @param {Object} options - Opzioni di filtro
   * @returns {Promise<Object>} Risposta API
   */
  static async getTargets(options = {}) {
    try {
      // Recupera target da localStorage
      let targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      
      // Filtra in base alle opzioni
      const { project_id, target_type, status } = options;
      
      if (project_id) {
        targets = targets.filter(t => t.project_id === parseInt(project_id));
      }
      
      if (target_type) {
        targets = targets.filter(t => t.target_type === target_type);
      }
      
      if (status) {
        targets = targets.filter(t => t.status === status);
      }
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        targets: targets
      };
    } catch (error) {
      console.error('Error fetching targets:', error);
      throw error;
    }
  }
  
  /**
   * Ottiene i target di un progetto specifico
   * @param {number} projectId - ID del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async getProjectTargets(projectId) {
    try {
      // Recupera target da localStorage
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, [])
        .filter(t => t.project_id.toString() === projectId.toString());
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        targets: targets
      };
    } catch (error) {
      console.error(`Error fetching targets for project ${projectId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while fetching project targets'
      };
    }
  }
  
  /**
   * Ottiene i report di un progetto specifico
   * @param {number} projectId - ID del progetto
   * @returns {Promise<Object>} Risposta API
   */
  static async getProjectReports(projectId) {
    try {
      // Recupera report da localStorage
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, [])
        .filter(r => r.project_id.toString() === projectId.toString());
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        reports: reports
      };
    } catch (error) {
      console.error(`Error fetching reports for project ${projectId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while fetching project reports'
      };
    }
  }
  
  /**
   * Crea un nuovo target
   * @param {Object} targetData - Dati del target
   * @returns {Promise<Object>} Risposta API
   */
  static async createTarget(targetData) {
    try {
      // Recupera target esistenti
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      
      // Crea un nuovo target con ID generato
      const newTarget = {
        ...targetData,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        scan_count: 0,
        vuln_count: 0
      };
      
      // Aggiungi il nuovo target alla lista
      const updatedTargets = [...targets, newTarget];
      
      // Salva su localStorage
      saveToStorage(STORAGE_KEYS.TARGETS, updatedTargets);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        target: newTarget
      };
    } catch (error) {
      console.error('Error creating target:', error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while creating the target'
      };
    }
  }
  
  /**
   * Aggiorna un target esistente
   * @param {Object} targetData - Dati del target con ID incluso
   * @returns {Promise<Object>} Risposta API
   */
  static async updateTarget(targetData) {
    try {
      if (!targetData.id) {
        return {
          status: 'error',
          message: 'Target ID is required for update'
        };
      }
      
      // Recupera target esistenti
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      
      // Trova l'indice del target da aggiornare
      const targetIndex = targets.findIndex(t => t.id.toString() === targetData.id.toString());
      
      if (targetIndex === -1) {
        return {
          status: 'error',
          message: `Target with ID ${targetData.id} not found`
        };
      }
      
      // Aggiorna il target
      const updatedTarget = {
        ...targets[targetIndex],
        ...targetData,
        updated_at: new Date().toISOString()
      };
      
      // Aggiorna la lista dei target
      targets[targetIndex] = updatedTarget;
      
      // Salva su localStorage
      saveToStorage(STORAGE_KEYS.TARGETS, targets);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success',
        target: updatedTarget
      };
    } catch (error) {
      console.error(`Error updating target:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while updating the target'
      };
    }
  }
  
  /**
   * Elimina un target
   * @param {number} targetId - ID del target
   * @returns {Promise<Object>} Risposta API
   */
  static async deleteTarget(targetId) {
    try {
      // Recupera target esistenti
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      
      // Filtra il target da eliminare
      const updatedTargets = targets.filter(t => t.id.toString() !== targetId.toString());
      
      if (targets.length === updatedTargets.length) {
        return {
          status: 'error',
          message: `Target with ID ${targetId} not found`
        };
      }
      
      // Elimina anche tutti i report associati al target
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, []);
      const updatedReports = reports.filter(r => r.target_id?.toString() !== targetId.toString());
      
      // Salva su localStorage
      saveToStorage(STORAGE_KEYS.TARGETS, updatedTargets);
      saveToStorage(STORAGE_KEYS.REPORTS, updatedReports);
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'success'
      };
    } catch (error) {
      console.error(`Error deleting target ${targetId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while deleting the target'
      };
    }
  }
  
  /**
   * Esegue una scansione Nmap sul target specificato
   * @param {number} targetId - ID del target
   * @param {string} scanType - Tipo di scansione nmap (default: '2')
   * @returns {Promise<Object>} Risposta API
   */
  static async runNmapScan(targetId, scanType = '2') {
    try {
      // Recupera il target
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      const target = targets.find(t => t.id.toString() === targetId.toString());
      
      if (!target) {
        return {
          status: 'error',
          message: `Target with ID ${targetId} not found`
        };
      }

      // Prepara i dati per l'API del backend
      const scanData = {
        target: target.address,
        scan_type: scanType,
        project_id: target.project_id,
        target_id: targetId
      };

      // Chiama l'API del backend
      const backendUrl = `${API_URL}/reconnaissance/nmap/scan`;
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scanData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Aggiorna il conteggio di scansioni sul target
      if (result.status === 'success') {
        const targetIndex = targets.findIndex(t => t.id.toString() === targetId.toString());
        if (targetIndex !== -1) {
          targets[targetIndex] = {
            ...targets[targetIndex],
            scan_count: (targets[targetIndex].scan_count || 0) + 1,
            updated_at: new Date().toISOString()
          };
          saveToStorage(STORAGE_KEYS.TARGETS, targets);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error running Nmap scan for target ${targetId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while running the Nmap scan'
      };
    }
  }
  
  /**
   * Esegue una scansione Amass sul target specificato
   * @param {number} targetId - ID del target
   * @param {string} scanType - Tipo di scansione amass (default: 'passive')
   * @returns {Promise<Object>} Risposta API
   */
  static async runAmassScan(targetId, scanType = 'passive') {
    try {
      // Recupera il target
      const targets = getFromStorage(STORAGE_KEYS.TARGETS, []);
      const target = targets.find(t => t.id.toString() === targetId.toString());
      
      if (!target) {
        return {
          status: 'error',
          message: `Target with ID ${targetId} not found`
        };
      }

      // Helper function to check if string is a domain
      const isDomain = (str) => {
        // Simple check for domain-like format (contains at least one dot and no slashes)
        return str && str.includes('.') && !str.includes('/');
      };
      
      // Check if address format is suitable for an Amass scan
      if (!isDomain(target.address)) {
        return {
          status: 'error',
          message: 'Amass scan requires a domain name in the address field (e.g. example.com)'
        };
      }

      // Prepara i dati per l'API del backend
      const scanData = {
        domain: target.address,
        scan_type: scanType,
        project_id: target.project_id,
        target_id: targetId
      };

      // Chiama l'API del backend
      const backendUrl = `${API_URL}/reconnaissance/amass/scan`;
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scanData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Aggiorna il conteggio di scansioni sul target
      if (result.status === 'success') {
        const targetIndex = targets.findIndex(t => t.id.toString() === targetId.toString());
        if (targetIndex !== -1) {
          targets[targetIndex] = {
            ...targets[targetIndex],
            scan_count: (targets[targetIndex].scan_count || 0) + 1,
            updated_at: new Date().toISOString()
          };
          saveToStorage(STORAGE_KEYS.TARGETS, targets);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error running Amass scan for target ${targetId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while running the Amass scan'
      };
    }
  }
  
  /**
   * Ottiene i dettagli completi di un report
   * @param {number} reportId - ID del report
   * @returns {Promise<Object>} Risposta API
   */
  static async getReportDetails(reportId) {
    try {
      // Recupera report da localStorage
      const reports = getFromStorage(STORAGE_KEYS.REPORTS, []);
      const report = reports.find(r => r.id.toString() === reportId.toString());
      
      if (!report) {
        return {
          status: 'error',
          message: `Report with ID ${reportId} not found`
        };
      }
      
      // Simula un ritardo di rete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return {
        status: 'success',
        report: report
      };
    } catch (error) {
      console.error(`Error fetching report ${reportId}:`, error);
      return {
        status: 'error',
        message: error.message || 'An error occurred while fetching the report'
      };
    }
  }
}

export default ProjectApi; 
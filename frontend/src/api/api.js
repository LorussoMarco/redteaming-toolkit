/**
 * API client for the Red Teaming Toolkit backend
 * Follows a structured approach with error handling and consistent patterns
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:5000';
const API_URL = `${BASE_URL}/api`;

/**
 * Core API functionality and utilities
 */
class ApiClient {
  /**
   * Make a GET request to the API
   * @param {string} endpoint 
   * @param {Object} params 
   * @returns {Promise<Object>} 
   */
  static async get(endpoint, params = {}) {
    try {
      const url = new URL(`${API_URL}${endpoint}`, window.location.origin);
      
      // Add query parameters
      Object.keys(params).forEach(key => 
        params[key] !== undefined && params[key] !== null && 
        url.searchParams.append(key, params[key])
      );
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error in GET ${endpoint}:`, error);
      throw error;
    }
  }
  
  /**
   * Make a POST request to the API
   * @param {string} endpoint 
   * @param {Object} data 
   * @param {Object} options 
   * @returns {Promise<Object>} 
   */
  static async post(endpoint, data = {}, options = {}) {
    try {
      const url = `${API_URL}${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
        mode: 'cors',
        ...options
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error in POST ${endpoint}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract error message from an error object
   * @param {Error} error 
   * @returns {string} 
   */
  static getErrorMessage(error) {
    if (error.response && error.response.data && error.response.data.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unknown error occurred';
  }
  
  /**
   * Handle API error and return a standardized error response
   * @param {Error} error 
   * @param {string} operation 
   * @returns {Object} 
   */
  static handleError(error, operation) {
    console.error(`Error during ${operation}:`, error);
    return { 
      status: 'error', 
      message: this.getErrorMessage(error)
    };
  }
}

/**
 * System related API methods
 */
class SystemApi {
  /**
   * Get system logs
   * @param {number} limit 
   * @param {string} service 
   * @returns {Promise<Object>} 
   */
  static async getLogs(limit = 10, service = null) {
    try {
      return await ApiClient.get('/system/logs', { limit, service });
    } catch (error) {
      return ApiClient.handleError(error, 'fetching system logs');
    }
  }
  
  /**
   * Get recent activities
   * @param {number} limit 
   * @returns {Promise<Object>} 
   */
  static async getRecentActivities(limit = 5) {
    try {
      return await ApiClient.get('/activities/recent', { limit });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return { activities: [] }; // Fallback
    }
  }
  
  /**
   * Get recent targets
   * @param {number} limit 
   * @returns {Promise<Object>} 
   */
  static async getRecentTargets(limit = 5) {
    try {
      return await ApiClient.get('/targets/recent', { limit });
    } catch (error) {
      console.error('Error fetching recent targets:', error);
      return { targets: [] }; 
    }
  }
}

/**
 * Reconnaissance related API methods
 */
class ReconnaissanceApi {
  // Nmap methods
  
  /**
   * Get available Nmap scan commands
   * @returns {Promise<Object>} 
   */
  static async getNmapScanCommands() {
    try {
      return await ApiClient.get('/reconnaissance/nmap/scan-commands');
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Run Nmap scan
   * @param {Object} data 
   * @returns {Promise<Object>} 
   */
  static async runNmapScan(data) {
    try {
      // Check if a project ID is stored in localStorage
      const projectId = localStorage.getItem('current_scan_project_id');
      if (projectId && !data.project_id) {
        data.project_id = projectId;
      }
      
      return await ApiClient.post('/reconnaissance/nmap/scan', data);
    } catch (error) {
      return { status: 'error', message: ApiClient.getErrorMessage(error) };
    }
  }
  
  /**
   * Get Nmap reports
   * @returns {Promise<Object>} 
   */
  static async getNmapReports() {
    try {
      return await ApiClient.get('/reconnaissance/nmap/reports');
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get Nmap report details
   * @param {string|number} reportId 
   * @returns {Promise<Object>} 
   */
  static async getNmapReportDetail(reportId) {
    try {
      const params = {};
      
      if (reportId) {
        // Determine if it's an ID or path
        if (!isNaN(reportId)) {
          params.id = reportId;
        } else {
          params.path = reportId;
        }
      } else {
        throw new Error('Report ID or path not valid');
      }
      
      return await ApiClient.get('/reconnaissance/nmap/report-detail', params);
    } catch (error) {
      throw error;
    }
  }
  
  // Amass methods
  
  /**
   * Get available Amass scan types
   * @returns {Promise<Object>} 
   */
  static async getAmassScanTypes() {
    try {
      return await ApiClient.get('/reconnaissance/amass/scan-types');
    } catch (error) {
      return { status: 'error', message: ApiClient.getErrorMessage(error) };
    }
  }
  
  /**
   * Run Amass scan
   * @param {Object} data 
   * @returns {Promise<Object>} 
   */
  static async runAmassScan(data) {
    try {
      // Check if a project ID is stored in localStorage
      const projectId = localStorage.getItem('current_scan_project_id');
      if (projectId && !data.project_id) {
        data.project_id = projectId;
      }
      
      return await ApiClient.post('/reconnaissance/amass/scan', data);
    } catch (error) {
      return { status: 'error', message: ApiClient.getErrorMessage(error) };
    }
  }
  
  /**
   * Get Amass reports
   * @returns {Promise<Object>} 
   */
  static async getAmassReports() {
    try {
      return await ApiClient.get('/reconnaissance/amass/reports');
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get Amass report details
   * @param {string|number} reportId 
   * @returns {Promise<Object>} 
   */
  static async getAmassReportDetail(reportId) {
    try {
      const params = {};
      
      if (reportId) {
        // Determine if it's an ID or path
        if (!isNaN(reportId)) {
          params.id = reportId;
        } else {
          params.path = reportId;
        }
      } else {
        throw new Error('Report ID or path not valid');
      }
      
      return await ApiClient.get('/reconnaissance/amass/report-detail', params);
    } catch (error) {
      throw error;
    }
  }
  
  // Vulnerability and exploit checking
  
  /**
   * Check exploits for vulnerabilities (Vulners only)
   * @param {string[]} vulnIds 
   * @param {string} reportPath 
   * @returns {Promise<Object>} 
   */
  static async checkVulnersExploits(vulnIds, reportPath = null) {
    try {
      if (!vulnIds || !Array.isArray(vulnIds) || vulnIds.length === 0) {
        return { success: true, results: {} };
      }
      
      const requestData = { 
        vuln_ids: vulnIds
      };
      
      if (reportPath) {
        requestData.report_path = reportPath;
      }
      
      const response = await ApiClient.post('/reconnaissance/vulners/check-only', requestData, {
        timeout: 30000 
      });
      
      if (response && response.status === 'success') {
        return { 
          success: true, 
          results: response.result || {}
        };
      } else {
        return { 
          success: false, 
          error: response.message || 'Unknown error from server',
          results: {}
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Error connecting to server',
        results: {}
      };
    }
  }
}

/**
 * Exploitation related API methods
 */
class ExploitationApi {
  /**
   * Get available payloads
   * @returns {Promise<Object>} 
   */
  static async getAvailablePayloads() {
    try {
      return await ApiClient.get('/exploitation/payloads');
    } catch (error) {
      return ApiClient.handleError(error, 'fetching available payloads');
    }
  }
  
  /**
   * Get available encoders
   * @returns {Promise<Object>} 
   */
  static async getAvailableEncoders() {
    try {
      return await ApiClient.get('/exploitation/encoders');
    } catch (error) {
      return ApiClient.handleError(error, 'fetching available encoders');
    }
  }
  
  /**
   * Get available formats
   * @returns {Promise<Object>} 
   */
  static async getAvailableFormats() {
    try {
      return await ApiClient.get('/exploitation/formats');
    } catch (error) {
      return ApiClient.handleError(error, 'fetching available formats');
    }
  }
  
  /**
   * Generate payload
   * @param {string} payload 
   * @param {Object} options 
   * @returns {Promise<Object>} 
   */
  static async generatePayload(payload, options) {
    try {
      return await ApiClient.post('/exploitation/metasploit/payload', {
        payload,
        options
      });
    } catch (error) {
      return ApiClient.handleError(error, 'generating payload');
    }
  }
}



// Exported API that maintains backward compatibility
const api = {
  getSystemLogs: (limit, service) => SystemApi.getLogs(limit, service),
  getNmapLogs: (limit) => SystemApi.getLogs(limit, 'nmap'),
  getAmassLogs: (limit) => SystemApi.getLogs(limit, 'amass'),
  getRecentActivities: SystemApi.getRecentActivities,
  getToolsStatus: SystemApi.getToolsStatus,
  getRecentTargets: SystemApi.getRecentTargets,
  
  reconnaissance: {
    getNmapScanCommands: ReconnaissanceApi.getNmapScanCommands,
    runNmapScan: ReconnaissanceApi.runNmapScan,
    getNmapReports: ReconnaissanceApi.getNmapReports,
    getNmapReportDetail: ReconnaissanceApi.getNmapReportDetail,
    getAmassScanTypes: ReconnaissanceApi.getAmassScanTypes,
    runAmassScan: ReconnaissanceApi.runAmassScan,
    getAmassReports: ReconnaissanceApi.getAmassReports,
    getAmassReportDetail: ReconnaissanceApi.getAmassReportDetail,
    checkMetasploitExploits: ReconnaissanceApi.checkMetasploitExploits,
    updateReportWithExploits: ReconnaissanceApi.updateReportWithExploits,
    checkVulnersExploits: ReconnaissanceApi.checkVulnersExploits
  },
  
  exploitation: {
    getAvailablePayloads: ExploitationApi.getAvailablePayloads,
    getAvailableEncoders: ExploitationApi.getAvailableEncoders,
    getAvailableFormats: ExploitationApi.getAvailableFormats,
    generatePayload: ExploitationApi.generatePayload
  },
};

export default api;
// Also export the class-based API for more modern usage
export { ApiClient, SystemApi, ReconnaissanceApi, ExploitationApi};
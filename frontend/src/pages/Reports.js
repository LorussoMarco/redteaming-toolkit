import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileDownload, faFilePdf, faFileCode, faFolder, faFolderOpen, faSearch, faExternalLinkAlt, faChevronDown, faChevronUp, faRocket, faEye, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import api from '../api/api';
import '../assets/css/reports.css';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../api/config';
import ReactDOM from 'react-dom/client';

// Default theme colors in case CSS variables are not loaded
const defaultTheme = {
  primaryColor: '#2196f3',
  textColor: '#333',
  textSecondary: '#666',
  backgroundColor: '#fff',
  backgroundSecondary: '#f5f5f5',
  backgroundTertiary: '#eaeaea',
  borderColor: '#ddd',
  hoverColor: '#f0f0f0'
};

// Helper to get CSS variable or fall back to default
const getCssVar = (varName, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return value && value.trim() ? value.trim() : fallback;
};

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nmapReports, setNmapReports] = useState([]);
  const [amassReports, setAmassReports] = useState([]);
  const [expandedReportIndex, setExpandedReportIndex] = useState(null);
  const [expandedReportData, setExpandedReportData] = useState(null);
  const [loadingReportData, setLoadingReportData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState({
    details: true,
    hosts: true,
    vulnerabilities: true
  });
  const [activeTab, setActiveTab] = useState('nmap');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [metasploitWarnings, setMetasploitWarnings] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(null);
  const [success, setSuccess] = useState('');
  
  // Funzioni per gestire i messaggi di feedback
  const setErrorMsg = (message) => {
    setError(message);
    setSuccess(''); // Pulisci i successi quando c'è un errore
    setTimeout(() => setError(''), 5000); // Auto-pulisci dopo 5 secondi
  };
  
  const setSuccessMsg = (message) => {
    setSuccess(message);
    setError(''); // Pulisci gli errori quando c'è un successo
    setTimeout(() => setSuccess(''), 5000); // Auto-pulisci dopo 5 secondi
  };
  
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const toolParam = queryParams.get('tool');
    const reportParam = queryParams.get('report');
    const scanCompleted = queryParams.get('scan_completed');
    const projectIdParam = queryParams.get('project_id');
    
    // Store project ID if available
    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
    
    // Se ci sono parametri nella query, seleziona il tool appropriato
    if (toolParam) {
      if (toolParam === 'nmap' || toolParam === 'amass') {
        setActiveTab(toolParam);
      }
    }
    
    // If a scan was just completed, refresh reports
    if (scanCompleted === 'true') {
      fetchReports().then(() => {
        // If we have a project ID, ensure the project progress is updated
        if (projectIdParam) {
          // Update project info in localStorage
          localStorage.setItem('scan_completed_for_project', projectIdParam);
          
          // Clean up the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('scan_completed');
          newUrl.searchParams.delete('project_id');
          navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
      });
    }
    
    // Se c'è un report specifico da visualizzare
    if (reportParam && (nmapReports.length > 0 || amassReports.length > 0)) {
      const targetReports = toolParam === 'amass' ? amassReports : nmapReports;
      
      // Trova l'indice del report
      const reportIndex = targetReports.findIndex(report => 
        report.path === reportParam || 
        report.path.includes(reportParam)
      );
      
      // Se troviamo il report, espandiamolo
      if (reportIndex !== -1) {
        toggleExpandReport(toolParam, reportIndex);
      }
    }
  }, [nmapReports, amassReports, navigate]); // Esegui quando i report sono caricati

  // Apply default theme if CSS variables not available
  useEffect(() => {
    const applyFallbackStyles = () => {
      const root = document.documentElement;
      if (!getCssVar('--primary-color', '').length) {
        root.style.setProperty('--primary-color', defaultTheme.primaryColor);
        root.style.setProperty('--text-color', defaultTheme.textColor);
        root.style.setProperty('--text-secondary', defaultTheme.textSecondary);
        root.style.setProperty('--background-color', defaultTheme.backgroundColor);
        root.style.setProperty('--background-secondary', defaultTheme.backgroundSecondary);
        root.style.setProperty('--background-tertiary', defaultTheme.backgroundTertiary);
        root.style.setProperty('--border-color', defaultTheme.borderColor);
        root.style.setProperty('--hover-color', defaultTheme.hoverColor);
      }
      setThemeLoaded(true);
    };
    
    applyFallbackStyles();
  }, []);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the utility function for both API calls
      await Promise.all([
        handleApiResponse(
          api.reconnaissance.getNmapReports,
          (response) => setNmapReports(response.reports || []),
          'Failed to fetch nmap reports'
        ),
        handleApiResponse(
          api.reconnaissance.getAmassReports,
          (response) => setAmassReports(response.reports || []),
          'Failed to fetch amass reports'
        )
      ]);
    } catch (err) {
      setError(err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
    
    return true;
  };

  // Add this utility function for handling API responses
  const handleApiResponse = async (apiCall, successHandler, errorMessage) => {
    try {
      const response = await apiCall();
      if (response.status === 'success') {
        successHandler(response);
        return true;
      } else {
        throw new Error(response.message || errorMessage);
      }
    } catch (err) {
      console.error(errorMessage, err);
      throw err;
    }
  };

  // Handle API errors and messaging
  const handleApiError = (error, customMessage = '') => {
    const errorMessage = customMessage || 
                         (error?.message || 'Si è verificato un errore imprevisto');
    console.error(errorMessage, error);
    setErrorMsg(errorMessage);
    return error;
  };
  
  const handleApiSuccess = (message) => {
    setSuccessMsg(message);
    return true;
  };
  
  // Unified feedback message handlers
  const showFeedback = (isSuccess, message) => {
    if (isSuccess) {
      handleApiSuccess(message);
    } else {
      handleApiError(null, message);
    }
  };

  // Aggiungi un effetto per chiudere il report espanso quando si cambia tab
  useEffect(() => {
    // Se c'è un report espanso, chiudilo quando cambia la tab
    if (expandedReportIndex !== null) {
      setExpandedReportIndex(null);
      setExpandedReportData(null);
    }
  }, [activeTab]);

  // Define fetchReportDetails with useCallback before using it in useEffect
  const fetchReportDetails = useCallback(async (toolParam, foundReport) => {
    try {
      // Controlla se il report ha un ID numerico o un path
      const reportIdentifier = foundReport.id ? foundReport.id : foundReport.path;
      
      console.log(`Caricamento dettagli report usando identificatore: ${reportIdentifier}`);
      
      let response;
      if (toolParam === 'nmap') {
        response = await api.reconnaissance.getNmapReportDetail(reportIdentifier);
      } else {
        response = await api.reconnaissance.getAmassReportDetail(reportIdentifier);
      }
      
      if (response.status === 'success') {
        // Preserva il path e l'id originale del report nei dati espansi
        const detailedReportWithIdentifiers = {
          ...response.report,
          path: foundReport.path, // Mantieni il path originale
          id: foundReport.id      // Mantieni l'id originale (se presente)
        };
        
        console.log('Report espanso da URL con identificatore:', reportIdentifier);
        setExpandedReportData(detailedReportWithIdentifiers);
      } else {
        throw new Error(response.message || 'Failed to load report details');
      }
    } catch (err) {
      console.error('Error loading report details:', err);
      setError('Failed to load report details: ' + (err.message || ''));
    } finally {
      setLoadingReportData(false);
    }
  }, []);

  // Effetto per caricare un report specifico se specificato nell'URL
  useEffect(() => {
    // Solo se abbiamo caricato i report e non c'è errore
    if (!loading && !error) {
      // Ottieni i parametri dall'URL
      const params = new URLSearchParams(window.location.search);
      const toolParam = params.get('tool');
      const pathParam = params.get('path');
      const idParam = params.get('id');
      const reportParam = params.get('report');
      
      // Usa report come fallback per retrocompatibilità
      const reportIdentifier = idParam || pathParam || reportParam;
      
      // Procedi solo se abbiamo almeno tool e un identificatore
      if (toolParam && reportIdentifier) {
        console.log(`Parametri URL: tool=${toolParam}, id=${idParam}, path=${pathParam}, report=${reportParam}`);
        
        // Setta il tab attivo in base al tool
        setActiveTab(toolParam);
        
        // Cerca il report per id, path o report
        let foundReport = null;
        let foundIndex = -1;
        
        // Determina quali report controllare
        const reportsToCheck = toolParam === 'nmap' ? nmapReports : amassReports;
        
        // Cerca il report per ID (prioritario), poi path o report
        for (let i = 0; i < reportsToCheck.length; i++) {
          const report = reportsToCheck[i];
          
          if ((report.id && report.id.toString() === reportIdentifier) || 
              (report.path && (report.path === reportIdentifier || report.path.includes(reportIdentifier)))) {
            foundIndex = i;
            foundReport = report;
            break;
          }
        }
        
        if (foundIndex !== -1 && foundReport) {
          console.log(`Report trovato all'indice ${foundIndex}, espando: ${foundReport.path || foundReport.id}`);
          // Espandiamo direttamente il report
          setExpandedReportIndex(foundIndex);
          
          // Carichiamo i dettagli del report
          setLoadingReportData(true);
          fetchReportDetails(toolParam, foundReport);
        } else {
          console.log('Report non trovato nel set di report disponibili');
        }
      }
    }
  }, [nmapReports, amassReports, loading, error, fetchReportDetails]);

  // Sposta l'useEffect qui, DOPO la dichiarazione delle funzioni che utilizza
  useEffect(() => {
    if (expandedReportData && activeTab === 'nmap') {
      console.log('Report data expanded:', expandedReportData);
    }
  }, [expandedReportData, activeTab]);

  const toggleSection = (section) => {
    setExpandedSection({
      ...expandedSection,
      [section]: !expandedSection[section]
    });
  };

  const toggleExpandReport = async (toolType, index) => {
    // If this is the currently expanded report, collapse it
    if (expandedReportIndex === index && toolType === activeTab) {
      setExpandedReportIndex(null);
      setExpandedReportData(null);
      return;
    }
    
    // Set the active tab if not already set
    if (activeTab !== toolType) {
      setActiveTab(toolType);
    }
    
    // Load the report data
    setExpandedReportIndex(index);
    setLoadingReportData(true);
    setExpandedReportData(null);
    
    try {
      // Get the correct report based on tool type
      const report = toolType === 'nmap' 
                     ? nmapReports[index] 
                     : toolType === 'amass' 
                       ? amassReports[index] 
                       : null;
      
      if (!report) {
        console.error('Report not found for', toolType, 'at index', index);
        setLoadingReportData(false);
        return;
      }
      
      console.log(`Loading ${toolType} report:`, report);
      
      // Check if the report has detailed data already (in-memory report)
      if (report.data || report.details || report.hosts || report.domains) {
        console.log(`${toolType} report has detailed data already:`, report);
        
        // Assicurati che il report abbia un ID o path per riferimenti futuri
        if (!report.path && report.file) {
          report.path = report.file;
        }
        
        setExpandedReportData({...report});
      } 
      // Load from backend if we need to fetch the detailed report
      else if (report.path || report.id || report.file) {
        const reportIdentifier = report.path || report.id || report.file;
        console.log(`Fetching ${toolType} report details from backend using identifier:`, reportIdentifier);
        
        try {
          let response;
          
          if (toolType === 'nmap') {
            response = await api.reconnaissance.getNmapReportDetail(reportIdentifier);
            console.log('Nmap report response:', response);
          } else if (toolType === 'amass') {
            response = await api.reconnaissance.getAmassReportDetail(reportIdentifier);
            console.log('Amass report response:', response);
          } else {
            throw new Error('Unsupported tool type');
          }
          
          if (response.status === 'success' && response.report) {
            console.log(`${toolType} report details loaded successfully:`, response.report);
            
            // Assicurati che il report dettagliato abbia tutti i metadati necessari 
            // copiando quelli dal report originale
            const enhancedReport = {
              ...response.report,
              path: report.path || response.report.path || reportIdentifier,
              id: report.id || response.report.id,
              metadata: {
                ...(response.report.metadata || {}),
                ...(report.metadata || {})
              }
            };
            
            // For Amass reports, make sure the domains data is accessible
            if (toolType === 'amass') {
              if (!enhancedReport.domains && !enhancedReport.details?.domains && enhancedReport.results?.domains) {
                enhancedReport.domains = enhancedReport.results.domains;
              }
            }
            
            // For Nmap reports, make sure hosts data is in the correct structure
            if (toolType === 'nmap') {
              // Se il report ha i dati degli host ma non li presenta nella struttura standard
              if (!enhancedReport.hosts && !enhancedReport.details?.hosts && enhancedReport.data?.hosts) {
                enhancedReport.hosts = enhancedReport.data.hosts;
              }
              
              // Se non ci sono host, crea un array vuoto per evitare errori
              if (!enhancedReport.hosts && !enhancedReport.details?.hosts) {
                enhancedReport.hosts = [];
              }
            }
            
            console.log('Setting expanded report data:', enhancedReport);
            setExpandedReportData(enhancedReport);
          } else {
            throw new Error(response.message || `Failed to load ${toolType} report details`);
          }
        } catch (err) {
          console.error(`Failed to load ${toolType} report details:`, err);
          handleApiError(err, `Errore nel caricamento del report: ${err.message}`);
        }
      } else {
        console.error(`${toolType} report has no path or ID to load details from:`, report);
        handleApiError(null, 'Impossibile caricare i dettagli del report: identificatore mancante');
      }
    } catch (error) {
      console.error(`Error loading ${toolType} report:`, error);
      handleApiError(error, `Errore nel caricamento del report: ${error.message}`);
    } finally {
      setLoadingReportData(false);
    }
  };

  // Modifica la funzione downloadReport per generare report HTML formattati
  const downloadReport = async (report, format) => {
    // Verifica che il report esista e sia valido
    if (!report || !report.metadata) {
      return handleApiError(null, 'Report non valido o dati mancanti');
    }

    try {
      // Determina il tipo di tool dal report in modo più accurato
      // Considera anche la tab attiva come fonte di informazione
      let toolType;
      
      // Verifica se il report ha un tipo esplicito
      if (report.metadata.tool) {
        toolType = report.metadata.tool;
      }
      // Se ha l'indicatore scanner nmap
      else if (report.metadata.scanner === 'nmap') {
        toolType = 'nmap';
      }
      // Se ha un dominio, probabilmente è amass
      else if (report.metadata.hasOwnProperty('domain')) {
        toolType = 'amass';
      }
      // Controlla la struttura dei dati
      else if (report.hosts || report.details?.hosts) {
        toolType = 'nmap';
      }
      else if (report.domains || report.details?.domains || report.subdomains || report.details?.subdomains) {
        toolType = 'amass';
      }
      // Se tutto fallisce, usa la tab attiva
      else {
        toolType = activeTab;
      }
      
      console.log(`Scaricando report di tipo ${toolType}:`, report);
      
      // Se il tipo di tool non è riconosciuto, mostra un errore
      if (toolType !== 'nmap' && toolType !== 'amass') {
        return handleApiError(null, 'Tipo di report non riconosciuto');
      }

      // Ottieni l'identificatore del report
      const reportId = report.id || report.path || report.file || 
                      (report.metadata.timestamp ? 
                       report.metadata.timestamp.toString().replace(/[ :.]/g, '') : 
                       Date.now().toString());

      // Carica i dati del report in base al tipo di tool
      const apiCall = toolType === 'nmap' ? 
                     api.reconnaissance.getNmapReportDetail : 
                     api.reconnaissance.getAmassReportDetail;
      
      console.log(`Chiamando API per dettagli ${toolType} con ID:`, reportId);
      const response = await apiCall(reportId);
      
      if (!response || response.status !== 'success') {
        throw new Error(response?.message || 'Impossibile caricare i dati del report');
      }
      
      const reportData = response.report;
      console.log(`Dati report ricevuti:`, reportData);

      // Se non ci sono dati, mostra un errore
      if (!reportData) {
        return handleApiError(null, 'Impossibile caricare i dati del report');
      }

      // Genera un nome file per il download
      let fileName = `${toolType}_report_`;
      
      // Aggiungi target al nome file se disponibile
      if (reportData.metadata.target || reportData.metadata.domain) {
        fileName += (reportData.metadata.target || reportData.metadata.domain).replace(/[^a-z0-9]/gi, '_') + '_';
      }
      
      // Aggiungi timestamp al nome file
      if (reportData.metadata.timestamp) {
        fileName += reportData.metadata.timestamp.toString().replace(/[ :.]/g, '-');
      } else {
        fileName += new Date().toISOString().replace(/[:.]/g, '-');
      }

      // Crea contenuto in base al formato richiesto
      let blob, contentType;
      
      if (format === 'json') {
        // Per JSON, manteniamo il comportamento esistente
        blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        contentType = 'application/json';
      } else if (format === 'html') {
        // Per HTML, usiamo l'interfaccia renderizzata
        
        // Crea temporaneamente un contenitore dove renderizzare il report
        const tempDiv = document.createElement('div');
        document.body.appendChild(tempDiv);
        
        // Determina quale funzione di rendering usare
        let reportElement;
        if (toolType === 'nmap') {
          reportElement = renderNmapReport({ data: reportData });
        } else if (toolType === 'amass') {
          reportElement = renderAmassReport({ data: reportData });
        }
        
        // Renderizza il report nel contenitore temporaneo
        const root = ReactDOM.createRoot(tempDiv);
        root.render(reportElement);
        
        // Attendiamo che il rendering sia completato
        setTimeout(() => {
          try {
            // Crea uno stile CSS per il report
            const styles = `
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .report-header, .report-summary, .host-card, .vulnerability-section, .cve-list-container { 
                background-color: #fff; 
                padding: 15px; 
                margin-bottom: 15px; 
                border-radius: 5px; 
                box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
              }
              svg, svg path, .svg-inline--fa { 
                width: 1em !important; 
                height: 1em !important; 
                max-width: 16px !important; 
                max-height: 16px !important; 
                font-size: 16px !important;
                vertical-align: middle;
              }
              a svg, button svg, .icon { 
                display: inline-block; 
                width: 16px !important; 
                height: 16px !important; 
                margin-right: 5px;
              }
              h3 { color: #2196f3; margin-top: 0; }
              h4, h5, h6 { margin-top: 10px; margin-bottom: 5px; }
              .summary-cards { display: flex; gap: 15px; }
              .summary-card { flex: 1; text-align: center; background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
              .summary-card h4 { margin: 0 0 5px 0; color: #666; font-size: 14px; }
              .summary-card p { margin: 0; font-size: 20px; font-weight: bold; color: #2196f3; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              .timestamp { color: #666; font-size: 14px; }
              .vulnerability-script-item, .cve-item { margin-bottom: 10px; }
              .cve-id { font-weight: bold; color: #e74c3c; }
              .script-name { margin-bottom: 5px; color: #2196f3; }
              pre, .script-output { white-space: pre-wrap; background-color: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; }
            `;
            
            // Ottieni l'HTML dal contenitore temporaneo
            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${toolType.toUpperCase()} Report: ${reportData.metadata.target || reportData.metadata.domain || 'Scan'}</title>
                <style>${styles}</style>
              </head>
              <body>
                ${tempDiv.innerHTML}
              </body>
              </html>
            `;
            
            // Crea il blob per il download
            blob = new Blob([htmlContent], { type: 'text/html' });
            contentType = 'text/html';
            
            // Pulizia: rimuovi il contenitore temporaneo
            document.body.removeChild(tempDiv);
            
            // Scarica il file
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            handleApiSuccess(`Report scaricato con successo in formato ${format.toUpperCase()}`);
          } catch (error) {
            document.body.removeChild(tempDiv);
            throw error;
          }
        }, 100);
        
        return; // Uscita anticipata perché il download è gestito nel setTimeout
      } else {
        return handleApiError(null, `Formato non supportato: ${format}`);
      }
      
      // Questo codice viene eseguito solo per il formato JSON
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return handleApiSuccess(`Report scaricato con successo in formato ${format.toUpperCase()}`);
    } catch (error) {
      return handleApiError(error, `Errore durante il download: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  // Function to delete a report
  const deleteReport = async (report) => {
    try {
      // Confirm deletion
      if (!window.confirm('Sei sicuro di voler eliminare questo report? Questa operazione non può essere annullata.')) {
        return;
      }

      const reportId = report.id;
      
      // Call the API to delete the report
      const response = await fetch(`/api/reports/${reportId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': localStorage.getItem('api_key') || ''
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        handleApiSuccess('Report eliminato con successo');
        // Refresh the reports list
        fetchReports();
      } else {
        handleApiError(null, data.message || 'Errore durante l\'eliminazione del report');
      }
    } catch (error) {
      handleApiError(error, 'Errore durante l\'eliminazione del report');
    }
  };

  // Function to render host details for Nmap reports
  const renderNmapHostDetails = (data) => {
    console.log('Rendering Nmap host details with data:', data);
    
    // Verifica che i dati esistano e siano nel formato corretto
    if (!data) {
      console.error('No data provided to renderNmapHostDetails');
      return <div className="no-hosts">Nessun dato disponibile per questo report</div>;
    }
    
    // Cerca i dati degli host in diverse possibili strutture
    let hosts = [];
    
    if (Array.isArray(data.details?.hosts)) {
      hosts = data.details.hosts;
    } else if (Array.isArray(data.hosts)) {
      hosts = data.hosts;
    } else if (Array.isArray(data.data?.hosts)) {
      hosts = data.data.hosts;
    } else if (data.details?.results?.hosts) {
      hosts = data.details.results.hosts;
    } else if (data.results?.hosts) {
      hosts = data.results.hosts;
    }
    
    // Se ancora non abbiamo host validi
    if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
      console.warn('No hosts found in the report data:', data);
      return <div className="no-hosts">Nessun host rilevato in questa scansione</div>;
    }
    
    console.log(`Found ${hosts.length} hosts to render`);
    
    // Funzione di utilità per ottenere informazioni complete sul servizio
    const getServiceInfo = (port) => {
      if (!port) return '-';
      
      let info = port.service?.name || port.service || '-';
      
      // Aggiungi informazioni sul prodotto se disponibili
      if (port.service?.product) {
        info += ` (${port.service.product}`;
        
        // Aggiungi versione se disponibile
        if (port.service?.version) {
          info += ` ${port.service.version}`;
        }
        
        // Aggiungi extra info se disponibili
        if (port.service?.extrainfo) {
          info += ` - ${port.service.extrainfo}`;
        }
        
        info += ')';
      } else if (port.service?.version) {
        // Se c'è solo la versione senza prodotto
        info += ` ${port.service.version}`;
      }
      
      return info;
    };

    return (
      <div className="host-details-container">
        <h4>
          Host rilevati
          <span className="host-count">
            {hosts.length}
          </span>
        </h4>
        
        {hosts.map((host, hostIndex) => (
          <div key={hostIndex} className="host-card">
            <div className="host-header">
              <h5>
                {host.addresses && host.addresses.length > 0 
                  ? host.addresses.map(addr => addr.addr).join(', ') 
                  : 'Host sconosciuto'}
              </h5>
              <span className={`host-status ${host.status?.state === 'up' ? 'up' : 'down'}`}>
                {host.status?.state === 'up' ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {host.hostnames && host.hostnames.length > 0 && (
              <div className="host-names">
                <strong>Nomi:</strong> {host.hostnames.map(name => name.name).join(', ')}
              </div>
            )}
            
            {host.os && host.os.matches && host.os.matches.length > 0 && (
              <div className="host-os">
                <strong>Sistema operativo:</strong> {host.os.matches[0].name} (Accuratezza: {host.os.matches[0].accuracy}%)
              </div>
            )}
            
            {host.ports && host.ports.length > 0 ? (
              <div className="ports-section">
                <h6>Porte ({host.ports.length})</h6>
                <div className="ports-table-container">
                  <table className="ports-table">
                    <thead>
                      <tr>
                        <th>Porta</th>
                        <th>Protocollo</th>
                        <th>Stato</th>
                        <th>Servizio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {host.ports.map((port, portIndex) => (
                        <tr key={portIndex}>
                          <td>{port.portid || port.port}</td>
                          <td>{port.protocol}</td>
                          <td className={port.state?.state === 'open' ? 'port-open' : 'port-closed'}>
                            {port.state?.state || port.state}
                          </td>
                          <td>{getServiceInfo(port)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="no-ports">Nessuna porta aperta trovata</p>
            )}
            
            {/* Sezione vulnerabilità */}
            {host.ports && host.ports.some(port => port.scripts && port.scripts.length > 0) && (
              <div className="vulnerability-section">
                <h6>Vulnerabilità rilevate</h6>
                {host.ports
                  .filter(port => port.scripts && port.scripts.length > 0)
                  .map((port, portIndex) => (
                    <div key={`vuln-${portIndex}`} className="vulnerability-item">
                      <h6 className="vulnerability-port">Porta {port.portid || port.port} ({port.service?.name || port.service || 'servizio sconosciuto'})</h6>
                      <div className="vulnerability-scripts">
                        {port.scripts.map((script, scriptIndex) => (
                          <div key={`script-${scriptIndex}`} className="script-result">
                            <h6 className="script-name">{script.id || 'Script'}</h6>
                            
                            {/* Aggiungi sezione specifica per CVE dallo script vulners */}
                            {script.id === 'vulners' && (
                              <div className="cve-list-container">
                                <h6>Vulnerabilità trovate:</h6>
                                <ul className="cve-list">
                                  {script.output && script.output.split('\n')
                                    .filter(line => line.trim())
                                    .map((line, lineIdx) => {
                                      // Verifica se la linea contiene un CVE o un ID di exploit
                                      const cveMatch = line.match(/\b(CVE-\d{4}-\d+)\b/);
                                      const exploitMatch = line.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}|PACKETSTORM:\d+|1337DAY-ID-\d+).*\*EXPLOIT\*/);
                                      const cvssMatch = line.match(/\b(\d+\.\d+)\b/); // Trova punteggio CVSS
                                      
                                      // Estrai l'ID della vulnerabilità dalla linea
                                      let vulnId = null;
                                      if (cveMatch) {
                                        vulnId = cveMatch[1];
                                      } else if (exploitMatch) {
                                        vulnId = exploitMatch[1];
                                      }
                                      
                                      if (vulnId) {
                                        // Ottieni il link a Vulners
                                        const vulnersLink = getVulnersLink(vulnId);
                                        
                                        return (
                                          <li key={`vuln-line-${lineIdx}`} className="cve-item">
                                            <div className="vuln-info-container">
                                              <div className="vuln-info-left">
                                                <span className="cve-id">{vulnId}</span>
                                                {cvssMatch && (
                                                  <span className="cve-cvss">CVSS: {cvssMatch[1]}</span>
                                                )}
                                              </div>
                                              <div className="vuln-actions">
                                                {line.includes('*EXPLOIT*') && (
                                                  <span className="exploit-tag">EXPLOIT</span>
                                                )}
                                                <a 
                                                  href={vulnersLink} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  className="vulners-link-btn"
                                                  title="Visualizza su Vulners"
                                                >
                                                  <FontAwesomeIcon icon={faExternalLinkAlt} /> Vulners
                                                </a>
                                              </div>
                                            </div>
                                          </li>
                                        );
                                      }
                                      return null;
                                    })
                                    .filter(item => item !== null)
                                  }
                                </ul>
                              </div>
                            )}
                            
                            <div className="script-output" style={{ whiteSpace: 'pre-wrap' }}>
                              {script.output}
                            </div>
                            
                            {script.tables && script.tables.length > 0 && (
                              <div className="vuln-tables">
                                {script.tables.map((table, tableIndex) => (
                                  <div key={`table-${tableIndex}`} className="vuln-table">
                                    <h6>{table.key || 'Dettagli'}</h6>
                                    <table className="vulnerability-details-table">
                                      <tbody>
                                        {table.elements && table.elements.map((element, elemIndex) => (
                                          <tr key={`elem-${elemIndex}`}>
                                            {Object.entries(element).map(([key, value], keyIndex) => (
                                              <React.Fragment key={`key-${keyIndex}`}>
                                                <td><strong>{key}</strong></td>
                                                <td>
                                                  {value}
                                                  {/* Badge Metasploit solo nel dettaglio tabella */}
                                                </td>
                                              </React.Fragment>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Function to render domain results for Amass reports
  const renderAmassResults = (data) => {
    console.log("Rendering Amass domains with data:", data);
    
    // Check all possible structures to get subdomains
    const subdomains = data.details?.subdomains || 
                       data.details?.domains || 
                       data.domains || 
                       data.data?.domains || 
                       data.data?.subdomains || 
                       data.results?.domains || 
                       data.results?.subdomains || 
                       [];
    
    if (!subdomains || subdomains.length === 0) {
      return <div className="no-domains">Nessun sottodominio trovato</div>;
    }
    
    // Calcola il numero totale di IP unici
    const uniqueIpAddresses = new Set();
    subdomains.forEach(domain => {
      const addresses = domain.addresses || domain.ip_addresses || domain.ips || [];
      if (Array.isArray(addresses)) {
        addresses.forEach(addr => {
          if (typeof addr === 'string') uniqueIpAddresses.add(addr);
          else if (addr && addr.ip) uniqueIpAddresses.add(addr.ip);
          else if (addr && addr.addr) uniqueIpAddresses.add(addr.addr);
        });
      }
    });
    
    // Calcola il numero totale di fonti uniche
    const uniqueSources = new Set();
    subdomains.forEach(domain => {
      if (domain.source) uniqueSources.add(domain.source);
      else if (domain.sources && Array.isArray(domain.sources)) {
        domain.sources.forEach(source => uniqueSources.add(source));
      }
    });
    
    console.log(`Trovati ${subdomains.length} sottodomini, ${uniqueIpAddresses.size} IP unici, ${uniqueSources.size} fonti`);

    return (
      <div className="domains-container">
        <h4>
          Sottodomini trovati
          <span className="domain-count">
            {subdomains.length}
          </span>
        </h4>
        
        <div className="domains-table-container">
          <table className="domains-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Indirizzi IP</th>
                <th>Fonti</th>
              </tr>
            </thead>
            <tbody>
              {subdomains.map((subdomain, index) => {
                // Ottieni il nome del dominio
                const name = subdomain.name || subdomain.domain || (typeof subdomain === 'string' ? subdomain : 'N/A');
                
                // Ottieni tutti gli indirizzi IP
                let addresses = [];
                if (subdomain.addresses && Array.isArray(subdomain.addresses)) {
                  addresses = subdomain.addresses;
                } else if (subdomain.ip_addresses && Array.isArray(subdomain.ip_addresses)) {
                  addresses = subdomain.ip_addresses;
                } else if (subdomain.ips && Array.isArray(subdomain.ips)) {
                  addresses = subdomain.ips;
                }
                
                // Formatta gli indirizzi IP per la visualizzazione
                const formattedAddresses = addresses.map((addr, i) => {
                  let ipAddress = 'N/A';
                  if (typeof addr === 'object' && addr.ip) {
                    ipAddress = addr.ip;
                  } else if (typeof addr === 'string') {
                    ipAddress = addr;
                  } else if (typeof addr === 'object' && addr.addr) {
                    ipAddress = addr.addr;
                  }
                  return <div key={i}>{ipAddress}</div>;
                });
                
                // Ottieni le fonti
                let sources = [];
                if (subdomain.sources && Array.isArray(subdomain.sources)) {
                  sources = subdomain.sources;
                } else if (subdomain.source) {
                  sources = [subdomain.source];
                }
                
                // Formatta le fonti per la visualizzazione
                const formattedSources = sources.length > 0 ? sources.join(', ') : 'N/A';
                
                return (
                  <tr key={index}>
                    <td>{name}</td>
                    <td>
                      {formattedAddresses.length > 0 ? formattedAddresses : '-'}
                    </td>
                    <td>{formattedSources}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Command used section */}
        {(data.metadata?.command || data.metadata?.command_used || data.scan_info?.command_used || data.details?.command_used) && (
          <div className="command-used">
            <h5>Comando utilizzato</h5>
            <div className="command-box">
              {data.metadata?.command || data.metadata?.command_used || data.scan_info?.command_used || data.details?.command_used}
            </div>
          </div>
        )}
      </div>
    );
  };



  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Try different timestamp formats
      const dateRegex = /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/;
      if (dateRegex.test(timestamp)) {
        const match = timestamp.match(dateRegex);
        // Crea una data in ora locale usando i componenti estratti
        const localDate = new Date(
          parseInt(match[1]), // anno
          parseInt(match[2]) - 1, // mese (0-based)
          parseInt(match[3]), // giorno
          parseInt(match[4]), // ore
          parseInt(match[5]), // minuti
          parseInt(match[6])  // secondi
        );
        return localDate.toLocaleString();
      }
      
      // If it's already a date string or ISO format
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
      
      return timestamp;
    } catch (e) {
      return timestamp;
    }
  };

  // Filter reports based on search term
  const filteredNmapReports = nmapReports.filter(report => {
    const target = report.metadata?.target || '';
    const fileName = report.path ? report.path.split('/').pop() : '';
    return target.toLowerCase().includes(searchTerm.toLowerCase()) || 
           fileName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredAmassReports = amassReports.filter(report => {
    const domain = report.metadata?.target || report.metadata?.domain || '';
    const fileName = report.path ? report.path.split('/').pop() : '';
    return domain.toLowerCase().includes(searchTerm.toLowerCase()) || 
           fileName.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  // Add renderNmapReport function before renderReportContent function
  const renderNmapReport = (report) => {
    if (!report || !report.data) {
      return <div className="no-data">No report data available</div>;
    }
    
    const reportData = report.data;
    
    return (
      <div className="nmap-report">
        <div className="report-header">
          <h3>Nmap Scan Report: {reportData.metadata?.target || "Unknown Target"}</h3>
          <div className="timestamp">
            {formatTimestamp(reportData.metadata?.timestamp)}
          </div>
        </div>
        
        {reportData.summary && (
          <div className="report-summary">
            <div className="summary-cards">
              <div className="summary-card">
                <h4>Total Hosts</h4>
                <p>{reportData.summary.total_hosts || 0}</p>
              </div>
              <div className="summary-card">
                <h4>Hosts Up</h4>
                <p>{reportData.summary.hosts_up || 0}</p>
              </div>
              <div className="summary-card">
                <h4>Total Ports</h4>
                <p>{reportData.summary.total_ports || 0}</p>
              </div>
              <div className="summary-card">
                <h4>Vulnerabilities</h4>
                <p>{reportData.summary.vulnerabilities_found || 0}</p>
              </div>
            </div>
          </div>
        )}
        
        {renderNmapHostDetails(reportData)}
      </div>
    );
  };

  // Add renderAmassReport function 
  const renderAmassReport = (report) => {
    if (!report || !report.data) {
      return <div className="no-data">No report data available</div>;
    }
    
    console.log("Rendering Amass report with raw data:", report);
    
    const reportData = report.data;
    
    // Extract domain name directly from metadata
    const domainName = reportData.metadata?.target || 
                       reportData.metadata?.domain || 
                       'N/A';
    
    // Read the domains array from the correct path
    const domains = reportData.details?.subdomains || 
                    reportData.details?.domains || 
                    reportData.domains || 
                    [];
    
    console.log("Found subdomains:", domains.length);
    
    // ESTREMAMENTE SEMPLICE: Leggi i valori e assicurati che non siano mai zero
    // Se i domini esistono, allora ci deve essere almeno 1 IP e 1 fonte
    let totalDomains = reportData.summary?.total_subdomains || 
                       reportData.summary?.total_domains || 
                       domains.length || 0;
    
    // Prendi il valore degli IP dalla summary, se è zero usa 1
    let totalIps = reportData.summary?.unique_ips || 0;
    if (totalIps === 0 && totalDomains > 0) {
      totalIps = 1;
    }
    
    // Prendi il valore delle fonti, se è zero usa 1
    let totalSources = 0;
    if (reportData.summary?.sources && Array.isArray(reportData.summary.sources)) {
      totalSources = reportData.summary.sources.length;
    } else {
      totalSources = reportData.summary?.total_sources || 0;
    }
    if (totalSources === 0 && totalDomains > 0) {
      totalSources = 1;
    }
    
    console.log("VALORI FINALI - Domini:", totalDomains, "IP:", totalIps, "Fonti:", totalSources);
    
    return (
      <div className="amass-report">
        <div className="report-header">
          <h3>Amass Scan Report: {domainName}</h3>
          <div className="timestamp">
            {formatTimestamp(reportData.metadata?.timestamp || reportData.scan_info?.timestamp)}
          </div>
        </div>
        
        {/* Create a summary section using values from the summary section */}
        <div className="report-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Sottodomini</h4>
              <p>{totalDomains}</p>
            </div>
            <div className="summary-card">
              <h4>Dominio principale</h4>
              <p>{domainName}</p>
            </div>
            <div className="summary-card">
              <h4>Indirizzi IP</h4>
              <p>{totalIps}</p>
            </div>
            <div className="summary-card">
              <h4>Fonti</h4>
              <p>{totalSources}</p>
            </div>
          </div>
        </div>
        
        {renderAmassResults(reportData)}
      </div>
    );
  };

  // Function to go back to project
  const goToProject = () => {
    if (projectId) {
      navigate(`/projects/${projectId}?phase=tracking`);
    }
  };

  // Add a function to render report list
  const renderReportList = (reports, toolType, columns) => {
    return reports.length > 0 ? (
      <div className="reports-list">
        <table>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i}>{col.header}</th>
              ))}
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report, index) => (
              <React.Fragment key={index}>
                <tr 
                  className={expandedReportIndex === index ? 'expanded-row' : ''}
                  onClick={() => toggleExpandReport(toolType, index)}
                >
                  {columns.map((col, i) => (
                    <td key={i}>{col.accessor(report)}</td>
                  ))}
                  <td className="actions-cell">
                    <button 
                      className="download-btn json"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReport(report, 'json');
                      }}
                      title="Scarica JSON"
                    >
                      <FontAwesomeIcon icon={faFileCode} />
                    </button>
                    <button 
                      className="download-btn html"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReport(report, 'html');
                      }}
                      title="Scarica HTML"
                    >
                      <FontAwesomeIcon icon={faFilePdf} />
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReport(report);
                      }}
                      title="Elimina Report"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                    <button 
                      className="expand-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpandReport(toolType, index);
                      }}
                    >
                      <FontAwesomeIcon icon={expandedReportIndex === index ? faChevronUp : faChevronDown} />
                    </button>
                  </td>
                </tr>
                {expandedReportIndex === index && (
                  <tr className="report-details-row">
                    <td colSpan={columns.length + 1}>
                      <div className="report-details">
                        {loadingReportData ? (
                          <div className="loading-report-data">
                            <div className="loading-spinner"></div>
                            <p>Caricamento dettagli in corso...</p>
                          </div>
                        ) : expandedReportData ? (
                          toolType === 'nmap' ? (
                            <>
                              <div className="report-details-header">
                                <h3>Dettagli della scansione {report.metadata?.target}</h3>
                                <span className="timestamp">{formatTimestamp(report.metadata?.timestamp)}</span>
                              </div>
                              
                              {expandedReportData.summary && (
                                <div className="report-summary">
                                  <div className="summary-cards">
                                    <div className="summary-card">
                                      <h4>Host totali</h4>
                                      <p>{expandedReportData.summary.total_hosts || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Host attivi</h4>
                                      <p>{expandedReportData.summary.hosts_up || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Porte</h4>
                                      <p>{expandedReportData.summary.total_ports || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Vulnerabilità</h4>
                                      <p>{expandedReportData.summary.vulnerabilities_found || 0}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {renderNmapHostDetails(expandedReportData)}
                            </>
                          ) : (
                            <>
                              <div className="report-details-header">
                                <h3>Dettagli della scansione {expandedReportData.metadata?.target || expandedReportData.metadata?.domain}</h3>
                                <span className="timestamp">{formatTimestamp(expandedReportData.metadata?.timestamp)}</span>
                              </div>
                              
                              {expandedReportData.summary && (
                                <div className="report-summary">
                                  <div className="summary-cards">
                                    <div className="summary-card">
                                      <h4>Sottodomini trovati</h4>
                                      <p>{expandedReportData.summary.total_domains || expandedReportData.summary.total_subdomains || 
                                         (expandedReportData.details?.domains || expandedReportData.domains || expandedReportData.details?.results?.subdomains || []).length || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Dominio principale</h4>
                                      <p>{expandedReportData.metadata?.target || expandedReportData.metadata?.domain || 'N/A'}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>IP unici</h4>
                                      <p>{(() => {
                                        // Get domains to check if they exist
                                        const domains = expandedReportData.details?.domains || 
                                                       expandedReportData.domains || 
                                                       expandedReportData.details?.subdomains || 
                                                       expandedReportData.subdomains || [];
                                        // Get IP count from summary
                                        let totalIps = expandedReportData.summary.total_ips || expandedReportData.summary.unique_ips || 0;
                                        // If we have domains but no IPs, set to at least 1
                                        if (totalIps === 0 && domains.length > 0) {
                                          totalIps = 1;
                                        }
                                        return totalIps;
                                      })()}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Fonti</h4>
                                      <p>{(() => {
                                        // Get domains to check if they exist
                                        const domains = expandedReportData.details?.domains || 
                                                       expandedReportData.domains || 
                                                       expandedReportData.details?.subdomains || 
                                                       expandedReportData.subdomains || [];
                                        // Get sources count from summary
                                        let totalSources = expandedReportData.summary.total_sources || 0;
                                        // If we have domains but no sources, set to at least 1
                                        if (totalSources === 0 && domains.length > 0) {
                                          totalSources = 1;
                                        }
                                        return totalSources;
                                      })()}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {renderAmassResults(expandedReportData)}
                            </>
                          )
                        ) : (
                          <div className="no-data">Impossibile caricare i dettagli del report</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="no-reports">Nessun report {toolType === 'nmap' ? 'Nmap' : 'Amass'} trovato</div>
    );
  };

  // Utility functions for data extraction
  const getReportTarget = (report) => {
    return report.metadata?.target || 
           report.metadata?.domain || 
           'N/A';
  };

  const getReportTimestamp = (report) => {
    return formatTimestamp(report.metadata?.timestamp || 
           report.scan_info?.timestamp || 
           'N/A');
  };

  const getAmassDomainsCount = (report) => {
    return report.summary?.total_domains || 
           report.summary?.total_subdomains || 
           (report.details?.domains?.length || 
            report.domains?.length || 
            report.details?.results?.subdomains?.length || 
            0);
  };

  const getNmapHostsCount = (report) => {
    return report.summary?.total_hosts || 
           report.details?.hosts?.length || 
           report.hosts?.length || 
           0;
  };

  const getNmapPortsCount = (report) => {
    return report.summary?.total_ports || 
           report.details?.ports?.length || 
           ((report.details?.hosts || report.hosts || [])
             .reduce((count, host) => count + (host.ports?.length || 0), 0)) || 
           0;
  };

  // Funzione per creare il link a Vulners per un ID vulnerabilità
  const getVulnersLink = (vulnId) => {
    if (vulnId.startsWith('CVE-')) {
      return `https://vulners.com/cve/${vulnId}`;
    } else if (vulnId.startsWith('PACKETSTORM:')) {
      return `https://vulners.com/packetstorm/${vulnId}`;
    } else if (vulnId.startsWith('1337DAY-ID-')) {
      return `https://vulners.com/zdt/${vulnId}`;
    } else {
      // Per altri ID, prova un link generico a Vulners
      return `https://vulners.com/search?query=${encodeURIComponent(vulnId)}`;
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Reconnaissance Reports</h1>
        
        {projectId && (
          <button 
            className="btn-back-to-project"
            onClick={goToProject}
          >
            Return to Project Dashboard
          </button>
        )}
        
        <div className="search-box">
          <input
            type="text"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {metasploitWarnings && (
        <div className="warning-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
          <span>{metasploitWarnings}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Caricamento reports...</p>
        </div>
      ) : (
        <div className="reports-content">
          <div className="tool-tabs">
            <button 
              className={`tab-button ${activeTab === 'nmap' ? 'active' : ''}`}
              onClick={() => {
                // Forza la chiusura della tabella espansa quando si cambia tab
                if (activeTab !== 'nmap') {
                  setExpandedReportIndex(null);
                  setExpandedReportData(null);
                }
                setActiveTab('nmap');
              }}
            >
              Nmap Reports ({filteredNmapReports.length})
            </button>
            <button 
              className={`tab-button ${activeTab === 'amass' ? 'active' : ''}`}
              onClick={() => {
                // Forza la chiusura della tabella espansa quando si cambia tab
                if (activeTab !== 'amass') {
                  setExpandedReportIndex(null);
                  setExpandedReportData(null);
                }
                setActiveTab('amass');
              }}
            >
              Amass Reports ({filteredAmassReports.length})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'nmap' && (
              <div className="tool-reports nmap-reports">
                {renderReportList(filteredNmapReports, 'nmap', [
                  { header: 'Data', accessor: (report) => getReportTimestamp(report) },
                  { header: 'Target', accessor: (report) => getReportTarget(report) },
                  { header: 'Tipo', accessor: (report) => report.metadata?.scan_type || 'N/A' },
                  { header: 'Host', accessor: (report) => getNmapHostsCount(report) },
                  { header: 'Porte', accessor: (report) => getNmapPortsCount(report) }
                ])}
              </div>
            )}
            
            {activeTab === 'amass' && (
              <div className="tool-reports amass-reports">
                {renderReportList(filteredAmassReports, 'amass', [
                  { header: 'Data', accessor: (report) => getReportTimestamp(report) },
                  { header: 'Dominio', accessor: (report) => getReportTarget(report) },
                  { header: 'Tipo', accessor: (report) => report.metadata?.scan_type || 'N/A' },
                  { header: 'Domini trovati', accessor: (report) => getAmassDomainsCount(report) }
                ])}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 
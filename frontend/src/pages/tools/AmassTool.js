import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import '../../assets/css/AmassTool.css';
import SystemLogs from '../../components/SystemLogs';

const AmassTool = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    domain: '',
    scan_type: 'passive',
    timeout: 1800
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [scanTypes, setScanTypes] = useState({});
  const [fetchingScanTypes, setFetchingScanTypes] = useState(true);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [expandedReportIndex, setExpandedReportIndex] = useState(null);
  const [expandedReportData, setExpandedReportData] = useState(null);
  const [loadingExpandedData, setLoadingExpandedData] = useState(false);
  const [showScanInfo, setShowScanInfo] = useState(false);

  useEffect(() => {
    // Recupera i tipi di scansione disponibili
    const initializeTool = async () => {
      try {
        setFetchingScanTypes(true);
        
        // Recupera tipi di scansione disponibili
        try {
          const scanTypesResponse = await api.reconnaissance.getAmassScanTypes();
          if (scanTypesResponse.status === 'success') {
            setScanTypes(scanTypesResponse.scan_types);
          } else {
            console.error('Errore nel recupero dei tipi di scansione');
            setError('Impossibile recuperare i tipi di scansione disponibili');
          }
        } catch (err) {
          console.error('Errore API scan types:', err);
          setError('Errore durante il recupero dei tipi di scansione');
        }

        // Controlla se c'è un target salvato in localStorage (aggiunto da ProjectDetail)
        const selectedTarget = localStorage.getItem('selected_target');
        if (selectedTarget) {
          try {
            const targetData = JSON.parse(selectedTarget);
            if (targetData && targetData.address) {
              console.log('Target trovato in localStorage:', targetData);
              
              // Impostiamo il dominio nel form
              setFormData(prev => ({
                ...prev,
                domain: targetData.address
              }));
              
              // Avvia automaticamente la scansione
              setTimeout(() => {
                runAmassScan({
                  domain: targetData.address,
                  scanType: formData.scan_type,
                  setResults,
                  setLoading,
                  setError
                });
              }, 500);
              
              // Puliamo localStorage dopo averlo utilizzato
              localStorage.removeItem('selected_target');
            }
          } catch (err) {
            console.error('Errore nel parsing del target da localStorage:', err);
          }
        }
      } catch (err) {
        console.error('Errore durante l\'inizializzazione dello strumento:', err);
        setError('Impossibile inizializzare lo strumento amass');
      } finally {
        setFetchingScanTypes(false);
      }
    };

    initializeTool();
  }, []);

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const response = await api.reconnaissance.getAmassReports();
      if (response.status === 'success') {
        const reportsData = response.reports || [];
        setReports(reportsData);
      } else {
        console.error('Errore nel recupero dei report');
        setError('Impossibile recuperare i report');
      }
    } catch (err) {
      console.error('Errore durante il recupero dei report:', err);
      setError('Errore durante il recupero dei report');
    } finally {
      setLoadingReports(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'timeout' ? parseInt(value, 10) || 1800 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.domain.trim()) {
      setError('Inserisci un dominio valido');
      return;
    }
    
    await runAmassScan({ domain: formData.domain, scanType: formData.scan_type, setResults, setLoading, setError });
  };

  const toggleReports = () => {
    if (!showReports) {
      fetchReports();
    }
    setShowReports(!showReports);
    // Chiudi il report espanso quando si nasconde la lista
    if (showReports) {
      setExpandedReportIndex(null);
    }
  };

  const toggleExpandReport = async (index) => {
    if (expandedReportIndex === index) {
      setExpandedReportIndex(null);
      setExpandedReportData(null);
    } else {
      setExpandedReportIndex(index);
      const report = reports[index];
      
      // Prima controlliamo se il report ha già dati completi (per reports locali)
      if (report.data || report.details || report.domains) {
        // Se il report ha già i dati completi (reports locali), li usiamo direttamente
        setExpandedReportData(report);
      }
      // Se il report ha un percorso file, carica il JSON completo dal backend
      else if (report.path) {
        setLoadingExpandedData(true);
        try {
          // Richiedi il file JSON completo
          const response = await api.reconnaissance.getAmassReportDetail(report.path);
          if (response.status === 'success' && response.report) {
            setExpandedReportData(response.report);
          } else {
            console.error('Errore nel caricamento del report completo');
          }
        } catch (err) {
          console.error('Errore durante il caricamento del report completo:', err);
        } finally {
          setLoadingExpandedData(false);
        }
      }
      // Se non ha né dati né percorso file, proviamo a caricarlo tramite ID
      else if (report.id) {
        setLoadingExpandedData(true);
        try {
          // Richiedi il report tramite ID
          const response = await api.reconnaissance.getAmassReportDetail(report.id);
          if (response.status === 'success' && response.report) {
            setExpandedReportData(response.report);
          } else {
            console.error('Errore nel caricamento del report tramite ID');
          }
        } catch (err) {
          console.error('Errore durante il caricamento del report tramite ID:', err);
        } finally {
          setLoadingExpandedData(false);
        }
      }
    }
  };

  const toggleScanInfo = () => {
    setShowScanInfo(!showScanInfo);
  };

  // Funzione per formattare correttamente il timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
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
        
        // Crea una data in ora locale usando i componenti estratti
        const localDate = new Date(
          parseInt(year),
          parseInt(month) - 1, // Mesi in JavaScript sono 0-based
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds)
        );
        
        return localDate.toLocaleString();
      }
      
      // Verifica se il timestamp è già nel formato corretto: YYYY-MM-DD HH:MM:SS
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
        const [datePart, timePart] = timestamp.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');
        
        // Crea una data in ora locale usando i componenti estratti
        const localDate = new Date(
          parseInt(year),
          parseInt(month) - 1, // Mesi in JavaScript sono 0-based
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        
        return localDate.toLocaleString();
      }
      
      // Se il timestamp è nel formato ISO
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        
        // Usa toLocaleString per formattare in base alla locale del browser
        return date.toLocaleString();
      }
      
      // Tentativo generico di parsing
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        // Usa toLocaleString per formattare in base alla locale del browser
        return date.toLocaleString();
      }
      
      // Fallback: restituisci il timestamp originale
      return timestamp;
    } catch (e) {
      console.error('Errore nella formattazione del timestamp:', e, timestamp);
      return 'Data non valida';
    }
  };

  const runAmassScan = async ({ domain, scanType, setResults, setLoading, setError }) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const startTime = new Date();
      const response = await api.reconnaissance.runAmassScan({
        domain: domain,
        scan_type: scanType
      });
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);

      if (response.status === 'success') {
        // Assicuriamoci che i dati siano nella struttura corretta
        let formattedResults = {
          status: 'success',
          data: {},
          metaData: {
            domain,
            scanType,
            timestamp: startTime.toISOString(),
            duration,
            command: `amass enum -d ${domain} ${scanType === 'passive' ? '-passive' : ''}`
          }
        };

        // Estraiamo i sottodomini dal risultato, controllando tutte le possibili strutture
        const subdomains = response.results?.subdomains || 
                          response.results?.domains || 
                          response.domains || 
                          [];

        // Calcola gli indirizzi IP
        const ipAddresses = new Set();
        if (response.results?.ip_addresses || response.ip_addresses) {
          const ips = response.results?.ip_addresses || response.ip_addresses || [];
          ips.forEach(ip => ipAddresses.add(ip));
        }
        
        // Estrai anche gli IP dai sottodomini quando disponibili
        subdomains.forEach(sub => {
          if (sub.addresses && Array.isArray(sub.addresses)) {
            sub.addresses.forEach(addr => {
              if (typeof addr === 'object' && addr.ip) {
                ipAddresses.add(addr.ip);
              } else if (typeof addr === 'string') {
                ipAddresses.add(addr);
              }
            });
          }
        });

        // Preparare i dati in un formato consistente
        formattedResults.data.subdomains = subdomains.map(sub => {
          if (typeof sub === 'string') {
            return { domain: sub, name: sub };
          } else {
            return sub;
          }
        });
        
        formattedResults.data.ip_addresses = Array.from(ipAddresses);
        formattedResults.summary = {
          total_domains: subdomains.length,
          total_ips: ipAddresses.size
        };
        
        setResults(formattedResults);
        
        // Check if this scan was started from a project
        const projectId = localStorage.getItem('current_scan_project_id');
        if (projectId) {
          // Clear the project ID from localStorage
          localStorage.removeItem('current_scan_project_id');
          
          // Store scan completion information in localStorage
          localStorage.setItem('scan_completed_for_project', projectId);
          
          // Redirect directly to the project's Track & Report section
          setTimeout(() => {
            navigate(`/projects/${projectId}?phase=tracking`);
          }, 2000);
        }
      } else {
        setError(response.message || 'Errore durante la scansione Amass.');
      }
    } catch (error) {
      console.error('Errore durante la scansione Amass:', error);
      setError('Errore durante la scansione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingScanTypes) {
    return (
      <div className="amass-tool">
        <h1>Amass Scanner</h1>
        <div className="loading-container">
          <p>Inizializzazione dello strumento in corso...</p>
          <div className="loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="amass-tool">
      <h1>Amass Scanner</h1>
      <div className="tool-description">
        <p>
          <strong>OWASP Amass</strong> è uno strumento avanzato per la raccolta di informazioni e la mappatura della superficie di attacco. Specializzato nell'enumerazione dei sottodomini.
        </p>
      </div>

      <div className="buttons-container">
        <button 
          className={`report-button ${showReports ? 'active' : ''}`} 
          onClick={toggleReports}
        >
          {showReports ? 'Nascondi Report' : 'Mostra Report'}
        </button>
      </div>

      {showReports && (
        <div className="reports-section">
          <h2>Report Recenti</h2>
          {loadingReports ? (
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="reports-list">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Dominio</th>
                    <th>Tipo</th>
                    <th>Sottodomini</th>
                    <th>IP</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, index) => (
                    <React.Fragment key={index}>
                      <tr 
                        className={expandedReportIndex === index ? 'expanded-row' : ''}
                        onClick={() => toggleExpandReport(index)}
                      >
                        <td>{formatTimestamp(report.metadata?.timestamp)}</td>
                        <td>{report.metadata?.target || 'N/A'}</td>
                        <td>{report.metadata?.scan_type || 'N/A'}</td>
                        <td>{report.summary?.total_domains || report.summary?.total_subdomains || 
                            (report.details?.domains?.length || report.details?.subdomains?.length || 
                            report.domains?.length || 0)}</td>
                        <td>{report.summary?.total_ips || report.summary?.unique_ips || 
                            (report.ip_addresses && report.ip_addresses.length) || 0}</td>
                        <td>
                          <button 
                            className="expand-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandReport(index);
                            }}
                          >
                            {expandedReportIndex === index ? 'Chiudi' : 'Espandi'}
                          </button>
                        </td>
                      </tr>
                      {expandedReportIndex === index && (
                        <tr className="report-details-row">
                          <td colSpan="6">
                            <div className="report-details">
                              <div className="report-details-header">
                                <h3>Dettagli della scansione {report.metadata?.target}</h3>
                                <span className="timestamp">{formatTimestamp(report.metadata?.timestamp)}</span>
                              </div>
                              
                              {report.summary && (
                                <div className="report-summary">
                                  <div className="summary-cards">
                                    <div className="summary-card">
                                      <h4>Sottodomini</h4>
                                      <p>{report.summary.total_domains || report.summary.total_subdomains || 
                                      (report.details?.domains?.length || report.details?.subdomains?.length || 
                                      report.domains?.length || 0)}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Indirizzi IP</h4>
                                      <p>{report.summary.total_ips || report.summary.unique_ips || 
                                      (report.ip_addresses && report.ip_addresses.length) || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Durata</h4>
                                      <p>{report.metadata?.duration 
                                        ? `${Math.round(report.metadata.duration / 60)} min` 
                                        : (report.scan_info?.duration ? `${Math.round(report.scan_info.duration / 60)} min` : 'N/A')}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Mostriamo un indicatore di caricamento se stiamo caricando i dati completi */}
                              {loadingExpandedData && expandedReportIndex === index && (
                                <div className="loading-expanded-data">
                                  <p>Caricamento dei dati completi in corso...</p>
                                  <div className="spinner"></div>
                                </div>
                              )}
                              
                              {/* Visualizziamo i sottodomini dal report completo */}
                              {expandedReportData && expandedReportIndex === index && (
                                (expandedReportData.details?.subdomains || 
                                 expandedReportData.details?.domains || 
                                 expandedReportData.domains || 
                                 expandedReportData.data?.domains || []).length > 0 ? (
                                <div className="subdomains-section">
                                  <h4>
                                    Sottodomini trovati 
                                    <span className="subdomain-count">
                                      {(expandedReportData.details?.subdomains || 
                                        expandedReportData.details?.domains || 
                                        expandedReportData.domains || 
                                        expandedReportData.data?.domains || []).length}
                                    </span>
                                  </h4>
                                  <div className="subdomains-table-container">
                                    <table className="subdomains-table">
                                      <thead>
                                        <tr>
                                          <th>Nome</th>
                                          <th>Indirizzi IP</th>
                                          <th>Fonti</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {/* Gestisce tutti i possibili formati dei report */}
                                        {(expandedReportData.details?.subdomains || 
                                          expandedReportData.details?.domains || 
                                          expandedReportData.domains || 
                                          expandedReportData.data?.domains || []).map((subdomain, sidx) => (
                                          <tr key={sidx}>
                                            <td>{subdomain.name || subdomain.domain || (typeof subdomain === 'string' ? subdomain : 'N/A')}</td>
                                            <td>
                                              {subdomain.addresses && subdomain.addresses.length > 0
                                                ? subdomain.addresses.map((addr, i) => {
                                                    let ipAddress = 'N/A';
                                                    if (typeof addr === 'object' && addr.ip) {
                                                      ipAddress = addr.ip;
                                                    } else if (typeof addr === 'string') {
                                                      ipAddress = addr;
                                                    }
                                                    return <div key={i}>{ipAddress}</div>;
                                                  })
                                                : 'N/A'}
                                            </td>
                                            <td>
                                              {subdomain.sources ? (Array.isArray(subdomain.sources) ? subdomain.sources.join(', ') : subdomain.sources) : (subdomain.source || 'N/A')}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Mostra le informazioni sul comando utilizzato */}
                                  {(expandedReportData.metadata?.command || 
                                    expandedReportData.metadata?.command_used || 
                                    expandedReportData.scan_info?.command_used || 
                                    expandedReportData.details?.command_used) && (
                                    <div className="command-used">
                                      <h5>Comando utilizzato</h5>
                                      <div className="command-box">
                                        {expandedReportData.metadata?.command || 
                                         expandedReportData.metadata?.command_used || 
                                         expandedReportData.scan_info?.command_used || 
                                         expandedReportData.details?.command_used}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                ) : (
                                  <div className="no-subdomains">
                                    <p>Nessun sottodominio trovato in questo report.</p>
                                  </div>
                                )
                              )}
                              
                              {!loadingExpandedData && !expandedReportData && (
                                <div className="no-subdomains">
                                  <p>Impossibile visualizzare i sottodomini. Clicca sul pulsante per caricare il report completo.</p>
                                  {report.path ? (
                                    <button 
                                      className="load-file-button"
                                      onClick={async () => {
                                        try {
                                          const response = await api.reconnaissance.getAmassReportDetail(report.path);
                                          if (response.status === 'success') {
                                            setExpandedReportData(response.report);
                                          }
                                        } catch (err) {
                                          console.error('Errore nel caricamento del file:', err);
                                        }
                                      }}
                                    >
                                      Carica report completo
                                    </button>
                                  ) : report.id && (
                                    <button 
                                      className="load-file-button"
                                      onClick={async () => {
                                        try {
                                          const response = await api.reconnaissance.getAmassReportDetail(report.id);
                                          if (response.status === 'success') {
                                            setExpandedReportData(response.report);
                                          }
                                        } catch (err) {
                                          console.error('Errore nel caricamento del report:', err);
                                        }
                                      }}
                                    >
                                      Carica report completo
                                    </button>
                                  )}
                                </div>
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
            <p>Nessun report disponibile</p>
          )}
        </div>
      )}
      
      <div className="scan-form-container">
        <form onSubmit={handleSubmit} className="scan-form">
          <div className="form-group">
            <label htmlFor="domain">Dominio da scansionare:</label>
            <input
              type="text"
              id="domain"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              placeholder="Esempio: example.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="scan_type">Tipo di scansione:</label>
            <select
              id="scan_type"
              name="scan_type"
              value={formData.scan_type}
              onChange={handleChange}
            >
              {Object.entries(scanTypes).map(([id, description]) => (
                <option key={id} value={id}>{description}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="timeout">Timeout (secondi):</label>
            <input
              type="number"
              id="timeout"
              name="timeout"
              value={formData.timeout}
              onChange={handleChange}
              min="300"
              max="7200"
            />
            <small>Nota: le scansioni più complesse possono richiedere più tempo</small>
          </div>
          
          <div className="scan-info-container">
            <button 
              type="button"
              className="toggle-info-button"
              onClick={toggleScanInfo}
            >
              {showScanInfo ? "Nascondi informazioni sulla scansione" : "Mostra informazioni sulla scansione"}
            </button>
            
            {showScanInfo && (
              <div className="scan-info">
                <h3>Informazioni sui tipi di scansione:</h3>
                <ul>
                  <li><strong>Passiva</strong>: Raccoglie informazioni senza inviare traffico diretto al dominio target.</li>
                  <li><strong>Attiva</strong>: Invia traffico al dominio target per verificare i sottodomini trovati.</li>
                  <li><strong>Intel</strong>: Raccoglie intelligence sul dominio utilizzando varie fonti di dati.</li>
                </ul>
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Scansione in corso...' : 'Avvia scansione'}
          </button>
          
          {error && <div className="error-message">{error}</div>}
        </form>
      </div>

      {loading && (
        <div className="loading-container">
          <p>Scansione in corso... Questa operazione può richiedere diversi minuti in base al dominio e al tipo di scansione.</p>
          <div className="loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      )}

      {results && results.status === 'success' && (
        <div className="results-container">
          <h2>Risultati della Scansione</h2>
          
          <div className="scan-info-panel">
            <h3>Informazioni sulla scansione</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Dominio:</strong>
                <span>{results.metaData.domain || results.scan_info?.domain || 'N/A'}</span>
              </div>
              <div className="info-item">
                <strong>Tipo di scansione:</strong>
                <span>{results.metaData.scanType === 'passive' ? 'Passiva' : 'Attiva'}</span>
              </div>
              <div className="info-item">
                <strong>Data/ora:</strong>
                <span>{formatTimestamp(results.metaData.timestamp || results.scan_info?.timestamp) || 'N/A'}</span>
              </div>
              <div className="info-item">
                <strong>Durata:</strong>
                <span>{results.metaData.duration ? `${Math.round(results.metaData.duration / 60)} minuti` : 'N/A'}</span>
              </div>
              <div className="info-item command-item">
                <strong>Comando utilizzato:</strong>
                <code className="command-code">{results.metaData.command || results.scan_info?.command_used}</code>
              </div>
            </div>
          </div>
          
          {/* Controlliamo se ci sono sottodomini da mostrare in tutte le possibili strutture */}
          {((results.data?.subdomains && results.data.subdomains.length > 0) || 
            (results.domains && results.domains.length > 0) || 
            (results.results?.domains && results.results.domains.length > 0) ||
            (results.results?.subdomains && results.results.subdomains.length > 0)) ? (
            <div className="subdomains-results">
              <h3>Sottodomini trovati ({
                results.data?.subdomains?.length || 
                results.domains?.length || 
                results.results?.domains?.length || 
                results.results?.subdomains?.length || 0})</h3>
              
              <div className="summary-stats">
                <div className="stat-item">
                  <strong>Totale sottodomini:</strong> {
                    results.data?.subdomains?.length || 
                    results.domains?.length || 
                    results.results?.domains?.length || 
                    results.results?.subdomains?.length || 0
                  }
                </div>
                <div className="stat-item">
                  <strong>Indirizzi IP unici:</strong> {
                    (results.data?.ip_addresses?.length || 
                    results.ip_addresses?.length || 
                    results.results?.ip_addresses?.length || 0)
                  }
                </div>
              </div>
              
              <div className="subdomains-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Indirizzi IP</th>
                      <th>Fonti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(results.data?.subdomains || 
                      results.domains || 
                      results.results?.domains || 
                      results.results?.subdomains || []).map((subdomain, index) => (
                      <tr key={index}>
                        <td>{subdomain.name || subdomain.domain || (typeof subdomain === 'string' ? subdomain : 'N/A')}</td>
                        <td>
                          {subdomain.addresses && subdomain.addresses.length > 0
                            ? subdomain.addresses.map((addr, i) => {
                                let ipAddress = 'N/A';
                                if (typeof addr === 'object' && addr.ip) {
                                  ipAddress = addr.ip;
                                } else if (typeof addr === 'string') {
                                  ipAddress = addr;
                                }
                                return <div key={i}>{ipAddress}</div>;
                              })
                            : 'N/A'}
                        </td>
                        <td>{subdomain.sources ? (Array.isArray(subdomain.sources) ? subdomain.sources.join(', ') : subdomain.sources) : (subdomain.source || 'Amass')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="no-results">
              <p>Nessun sottodominio trovato per questo dominio.</p>
            </div>
          )}
        </div>
      )}

      

      {/* Aggiungi il componente SystemLogs per i log di Amass */}
      <div className="tool-logs-section">
        <SystemLogs service="amass" title="Log di Amass" maxLogs={15} height="350px" refreshInterval={3000} />
      </div>
    </div>
  );
};

export default AmassTool; 
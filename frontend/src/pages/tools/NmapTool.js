import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import '../../assets/css/NmapTool.css';
import SystemLogs from '../../components/SystemLogs';

const NmapTool = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    target: '',
    scan_type: '2', // Default al comando 2 (scansione rapida)
    ports: '',
    max_rate: 10 // Valore predefinito per max_rate
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [scanCommands, setScanCommands] = useState({});
  const [isSubnet, setIsSubnet] = useState(false);
  const [fetchingCommands, setFetchingCommands] = useState(true);
  // Aggiungo stati per la gestione dei report
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [expandedReportIndex, setExpandedReportIndex] = useState(null);
  const [expandedReportData, setExpandedReportData] = useState(null);
  const [loadingExpandedData, setLoadingExpandedData] = useState(false);
  // Add a new state to control the scan info visibility
  const [showScanInfo, setShowScanInfo] = useState(false);

  useEffect(() => {
    // Recupera i comandi disponibili
    const initializeTool = async () => {
      try {
        setFetchingCommands(true);
        
        // Recupera comandi di scansione disponibili
        const commandsResponse = await api.reconnaissance.getNmapScanCommands();
        if (commandsResponse.status === 'success') {
          setScanCommands(commandsResponse.commands);
        } else {
          console.error('Errore nel recupero dei comandi di scansione');
        }

        let targetAddress = '';
        let shouldAutostart = false;

        // Controlla se c'è un target salvato in localStorage (aggiunto da ProjectDetail)
        const selectedTarget = localStorage.getItem('selected_target');
        if (selectedTarget) {
          try {
            const targetData = JSON.parse(selectedTarget);
            if (targetData && targetData.address) {
              targetAddress = targetData.address;
              shouldAutostart = true;
              console.log('Target trovato in localStorage:', targetData);
              
              // Puliamo localStorage dopo averlo utilizzato
              localStorage.removeItem('selected_target');
            }
          } catch (err) {
            console.error('Errore nel parsing del target da localStorage:', err);
          }
        }

        // Altrimenti analizza i parametri della query URL
        if (!targetAddress) {
          const searchParams = new URLSearchParams(location.search);
          const targetParam = searchParams.get('target');
          const autostartParam = searchParams.get('autostart');
          
          if (targetParam) {
            targetAddress = targetParam;
            shouldAutostart = autostartParam === 'true';
          }
        }

        // Se abbiamo un target, inizializza il form e avvia la scansione se richiesto
        if (targetAddress) {
          setFormData(prev => ({
            ...prev,
            target: targetAddress
          }));
          
          if (shouldAutostart) {
            // Avvia la scansione con un breve ritardo per assicurarsi che il componente sia completamente montato
            setTimeout(() => {
              runScan(targetAddress);
            }, 500);
          }
        }
      } catch (err) {
        console.error('Errore durante l\'inizializzazione dello strumento:', err);
        setError('Impossibile inizializzare lo strumento nmap');
      } finally {
        setFetchingCommands(false);
      }
    };

    initializeTool();
  }, [location.search]);

  // Funzione per avviare una scansione programmmaticamente
  const runScan = async (targetAddress) => {
    if (!targetAddress.trim()) {
      setError('Inserisci un target valido');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Prepara i dati per la scansione
      const scanData = {
        target: targetAddress,
        scan_type: formData.scan_type,
        ports: formData.ports
      };
      
      // Aggiungi max_rate solo per la scansione stealth (11)
      if (formData.scan_type === '11' && formData.max_rate) {
        scanData.max_rate = parseInt(formData.max_rate);
      }
      
      // Chiamata API per eseguire la scansione Nmap
      const response = await api.reconnaissance.runNmapScan(scanData);
      
      if (response.status === 'success') {
        setResults(response.results);
        
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
        setError(response.message || 'Errore durante la scansione');
      }
    } catch (err) {
      console.error('Errore durante la scansione nmap:', err);
      setError('Si è verificato un errore durante la scansione. Controlla la console per i dettagli.');
    } finally {
      setLoading(false);
    }
  };

  // Funzione per recuperare i report precedenti
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const response = await api.reconnaissance.getNmapReports();
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

  // Verifica se il target è una subnet
  useEffect(() => {
    const checkIfSubnet = () => {
      const target = formData.target.trim();
      if (!target) return false;
      
      // Verifica se è una subnet CIDR (es. 192.168.1.0/24)
      const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      setIsSubnet(subnetRegex.test(target));
    };
    
    checkIfSubnet();
  }, [formData.target]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runScan(formData.target);
  };

  // Funzione per gestire il toggle dei report
  const toggleReports = () => {
    if (!showReports) {
      fetchReports();
    }
    setShowReports(!showReports);
    // Chiudi il report espanso quando si nasconde la lista
    if (showReports) {
      setExpandedReportIndex(null);
      setExpandedReportData(null);
    }
  };

  // Funzione per gestire l'espansione di un report
  const toggleExpandReport = async (index) => {
    if (expandedReportIndex === index) {
      setExpandedReportIndex(null);
      setExpandedReportData(null);
    } else {
      setExpandedReportIndex(index);
      const report = reports[index];
      
      // Prima controlliamo se il report ha già dati completi (per reports locali)
      if (report.data || report.details || report.hosts) {
        // Se il report ha già i dati completi (reports locali), li usiamo direttamente
        setExpandedReportData(report);
      }
      // Se il report ha un percorso file, carica il JSON completo dal backend
      else if (report.path) {
        setLoadingExpandedData(true);
        try {
          // Richiedi il file JSON completo
          const response = await api.reconnaissance.getNmapReportDetail(report.path);
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
          const response = await api.reconnaissance.getNmapReportDetail(report.id);
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

  const isScanTypeAllowedForSubnet = (scanId) => {
    const subnetAllowedScans = [2, 3, 6, 9, 10]; // Comandi permessi su subnet
    return !isSubnet || subnetAllowedScans.includes(Number(scanId));
  };

  // Add a function to toggle scan info visibility
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
      console.error('Errore nella formattazione del timestamp:', e, timestamp);
      return 'Data non valida';
    }
  };

  if (fetchingCommands) {
    return (
      <div className="nmap-tool">
        <h1>Nmap Scanner</h1>
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
    <div className="nmap-tool">
      <h1>Nmap Scanner</h1>
      
      <div className="tool-description">
        <p><strong>Nmap</strong> (Network Mapper) è uno strumento essenziale per l'esplorazione delle reti e l'auditing di sicurezza, sviluppato dalla comunità open source. Permette di:</p>
        <ul>
          <li><strong>Identificare host attivi</strong> su una rete, senza necessità di ping</li>
          <li><strong>Rilevare porte aperte e servizi in esecuzione</strong> su sistemi target</li>
          <li><strong>Determinare il sistema operativo</strong> utilizzato dai dispositivi remoti</li>
          <li><strong>Individuare vulnerabilità potenziali</strong> attraverso script di rilevamento</li>
        </ul>
        <p>Questo strumento è fondamentale nelle fasi di reconnaissance e discovery di un assessment di sicurezza, permettendo di mappare l'infrastruttura di rete e identificare potenziali vettori di attacco.</p>
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
                    <th>Target</th>
                    <th>Tipo</th>
                    <th>Host</th>
                    <th>Porte</th>
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
                        <td>{report.summary?.total_hosts || 0}</td>
                        <td>{report.summary?.total_ports || 0}</td>
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
                                      <h4>Host totali</h4>
                                      <p>{report.summary.total_hosts || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Host attivi</h4>
                                      <p>{report.summary.hosts_up || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Porte</h4>
                                      <p>{report.summary.total_ports || 0}</p>
                                    </div>
                                    <div className="summary-card">
                                      <h4>Vulnerabilità</h4>
                                      <p>{report.summary.vulnerabilities_found || 0}</p>
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
                              
                              {/* Visualizziamo gli host dal report completo */}
                              {expandedReportData && expandedReportIndex === index && (
                                expandedReportData.details?.hosts || expandedReportData.hosts || expandedReportData.data?.open_ports ? (
                                  <div className="host-details-container">
                                    {/* Se abbiamo dati di porte senza host specifici (formato locale) */}
                                    {expandedReportData.data?.open_ports && !expandedReportData.hosts ? (
                                      <>
                                        <h4>
                                          Porte rilevate
                                          <span className="port-count">
                                            ({expandedReportData.data.open_ports.length})
                                          </span>
                                        </h4>
                                        
                                        <div className="ports-table-container">
                                          <table className="ports-table">
                                            <thead>
                                              <tr>
                                                <th>Porta</th>
                                                <th>Protocollo</th>
                                                <th>Stato</th>
                                                <th>Servizio</th>
                                                <th>Versione</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {expandedReportData.data.open_ports.map((port, portIndex) => (
                                                <tr key={portIndex}>
                                                  <td>{port.port}</td>
                                                  <td>{port.protocol}</td>
                                                  <td className={`port-state ${port.state}`}>
                                                    {port.state}
                                                  </td>
                                                  <td>{port.service || 'N/A'}</td>
                                                  <td>{port.version || 'N/A'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    ) : (
                                      // Se abbiamo dati di host (formato backend)
                                      <>
                                        <h4>
                                          Host rilevati 
                                          <span className="host-count">
                                            {(expandedReportData.details?.hosts || expandedReportData.hosts || []).length}
                                          </span>
                                        </h4>
                                        
                                        {(expandedReportData.details?.hosts || expandedReportData.hosts || []).map((host, hostIndex) => (
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
                                                <h6>Porte aperte ({host.ports.length})</h6>
                                                <div className="ports-table-container">
                                                  <table className="ports-table">
                                                    <thead>
                                                      <tr>
                                                        <th>Porta</th>
                                                        <th>Protocollo</th>
                                                        <th>Servizio</th>
                                                        <th>Versione</th>
                                                        <th>Stato</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {host.ports.map((port, portIndex) => (
                                                        <tr key={portIndex}>
                                                          <td>{port.portid}</td>
                                                          <td>{port.protocol}</td>
                                                          <td>{port.service?.name || 'N/A'}</td>
                                                          <td>
                                                            {port.service?.product ? (
                                                              <>
                                                                {port.service.product}
                                                                {port.service.version && ` ${port.service.version}`}
                                                                {port.service.extrainfo && ` (${port.service.extrainfo})`}
                                                              </>
                                                            ) : 'N/A'}
                                                          </td>
                                                          <td className={`port-state ${port.state?.state || ''}`}>
                                                            {port.state?.state || 'N/A'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                                
                                                {/* Mostra eventuali script di vulnerabilità eseguiti */}
                                                {host.ports.some(port => port.scripts && port.scripts.length > 0) && (
                                                  <div className="vulnerability-section">
                                                    <h6>Risultati degli script di vulnerabilità</h6>
                                                    {host.ports.filter(port => port.scripts && port.scripts.length > 0).map((port, scriptIndex) => (
                                                      <div key={scriptIndex} className="vuln-script-result">
                                                        <h7>Porta {port.portid}/{port.protocol}</h7>
                                                        <ul className="script-list">
                                                          {port.scripts.map((script, idx) => (
                                                            <li key={idx}>
                                                              <strong>{script.id}:</strong> {script.output}
                                                            </li>
                                                          ))}
                                                        </ul>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <p className="no-ports">Nessuna porta rilevata su questo host.</p>
                                            )}
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    
                                    {/* Mostra le informazioni sul comando utilizzato */}
                                    {expandedReportData.data?.command && (
                                      <div className="command-used">
                                        <h4>Comando utilizzato</h4>
                                        <div className="command-box">
                                          {expandedReportData.data.command}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="no-data">
                                    <p>Nessun dato host disponibile per questo report.</p>
                                  </div>
                                )
                              )}
                              
                              {!loadingExpandedData && !expandedReportData && (
                                <div className="no-data">
                                  <p>Impossibile visualizzare i dettagli. Clicca sul pulsante per caricare il report completo.</p>
                                  {report.path && (
                                    <button 
                                      className="load-file-button"
                                      onClick={async () => {
                                        try {
                                          const response = await api.reconnaissance.getNmapReportDetail(report.path);
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
            <label htmlFor="target">Target (IP, dominio o subnet):</label>
            <input
              type="text"
              id="target"
              name="target"
              value={formData.target}
              onChange={handleChange}
              placeholder="Esempio: example.com, 192.168.1.1 o 192.168.1.0/24"
              required
            />
            {isSubnet && (
              <div className="info-badge subnet-badge">
                Rilevata subnet - Alcune scansioni non saranno disponibili
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="scan_type">Tipo di scansione:</label>
            <select
              id="scan_type"
              name="scan_type"
              value={formData.scan_type}
              onChange={handleChange}
            >
              {Object.entries(scanCommands).map(([id, description]) => (
                <option 
                  key={id} 
                  value={id} 
                  disabled={!isScanTypeAllowedForSubnet(id)}
                >
                  {description}
                  {!isScanTypeAllowedForSubnet(id) ? ' (non disponibile per subnet)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          {/* Mostra il campo max_rate solo per la scansione stealth (tipo 11) */}
          {formData.scan_type === '11' && (
            <div className="form-group">
              <label htmlFor="max_rate">Velocità massima di pacchetti al secondo:</label>
              <input
                type="number"
                id="max_rate"
                name="max_rate"
                value={formData.max_rate}
                onChange={handleChange}
                min="1"
                max="1000"
                placeholder="Esempio: 10 (valore predefinito)"
              />
              <div className="info-badge stealth-rate">
                Un valore più basso riduce la probabilità di essere rilevati ma aumenta la durata della scansione
              </div>
            </div>
          )}
          
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
                <h3>Tipi di scansione disponibili:</h3>
                <ul>
                  <li><strong>Scansione rapida (-F):</strong> Esamina solo le 100 porte più comuni invece delle 1000 predefinite. Riduce significativamente i tempi di scansione mantenendo una buona copertura dei servizi più diffusi.</li>
                  <li><strong>Scansione completa (Normale):</strong> Esamina tutte le porte TCP comuni (1-1000). Fornisce un buon equilibrio tra completezza e tempo di esecuzione, ideale per la maggior parte degli audit di sicurezza standard.</li>
                  <li><strong>Scansione completa tutte le porte:</strong> Analizza tutte le 65535 porte TCP. È la scansione più completa ma richiede molto più tempo. Utile quando è necessario un inventario completo di tutti i servizi esposti.</li>
                  <li><strong>Scansione UDP:</strong> Individua servizi su porte UDP spesso trascurate nelle verifiche di sicurezza. Può rilevare servizi critici come DNS, SNMP e VPN che funzionano su UDP.</li>
                  <li><strong>Scansione silenziosa (SYN):</strong> Utilizza pacchetti SYN per una scansione meno intrusiva che non completa le connessioni TCP. Genera meno rumore di rete e ha minori probabilità di essere rilevata dai sistemi di monitoraggio.</li>
                  <li><strong>Scansione OS e servizi:</strong> Combina l'identificazione del sistema operativo con il rilevamento preciso della versione dei servizi. Fondamentale per identificare vulnerabilità specifiche legate a particolari versioni.</li>
                  <li><strong>Scansione aggressiva:</strong> Modalità completa che include rilevamento OS, versioni, script e traceroute. Più rumorosa e facilmente rilevabile, ma fornisce il massimo delle informazioni disponibili.</li>
                  <li><strong>Scansione vulnerabilità:</strong> Esegue script specializzati per rilevare vulnerabilità conosciute nei servizi identificati. Offre un primo livello di valutazione della sicurezza senza tentare exploit.</li>
                  <li><strong>Scansione evasiva:</strong> Utilizza tecniche di frammentazione e temporizzazione per aggirare sistemi di rilevamento delle intrusioni. Utile in scenari dove è richiesta maggiore discrezione.</li>
                  <li><strong>Scansione rete completa:</strong> Progettata per mappare intere subnet, identificando tutti gli host attivi e i servizi disponibili. Ideale per l'inventario di rete e la documentazione dell'infrastruttura.</li>
                </ul>
                <p className="warning">⚠️ <strong>Avvertenza importante:</strong> Esegui scansioni solo su sistemi e reti di tua proprietà o per cui disponi di esplicita autorizzazione scritta. Le scansioni non autorizzate possono costituire reato e violare la legislazione sulla sicurezza informatica con gravi conseguenze legali.</p>
              </div>
            )}
          </div>
          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? "Scansione in corso..." : "Avvia scansione"}
          </button>
        </form>
      </div>
      
      {loading && (
        <div className="loading-container">
          <p>Scansione in corso... Questa operazione può richiedere diversi minuti in base al tipo di scansione e al target.</p>
          <div className="loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <h3>Errore:</h3>
          <p>{error}</p>
        </div>
      )}
      
      {results && (
        <div className="results-container">
          <h2>Risultati della scansione</h2>
          
          <div className="scan-info-panel">
            <h3>Informazioni sulla scansione</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Target:</strong>
                <span>{results.scan_info?.target}</span>
              </div>
              <div className="info-item">
                <strong>Tipo target:</strong>
                <span className={results.scan_info?.target_type === 'subnet' ? 'subnet-badge' : ''}>
                  {results.scan_info?.target_type === 'subnet' ? 'Subnet' : 'IP singolo'}
                </span>
              </div>
              <div className="info-item">
                <strong>Tipo scansione:</strong>
                <span>{scanCommands[results.scan_info?.scan_type] || results.scan_info?.scan_type}</span>
              </div>
              <div className="info-item">
                <strong>Data/ora:</strong>
                <span>{formatTimestamp(results.scan_info?.timestamp)}</span>
              </div>
              <div className="info-item">
                <strong>Comando utilizzato:</strong>
                <code className="command-code">{results.scan_info?.command_used}</code>
              </div>
            </div>
          </div>
          
          {results.hosts && results.hosts.length > 0 ? (
            <div className="hosts-results">
              <h3>Host trovati ({results.hosts.length})</h3>
              
              {results.hosts.map((host, hostIndex) => (
                <div key={hostIndex} className="host-card">
                  <div className="host-header">
                    <h4>Host {hostIndex + 1}</h4>
                    <span className={`status-badge ${host.status?.state === 'up' ? 'up' : 'down'}`}>
                      {host.status?.state === 'up' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  {host.addresses && host.addresses.length > 0 && (
                    <div className="host-addresses">
                      <h5>Indirizzi:</h5>
                      <ul>
                        {host.addresses.map((addr, addrIndex) => (
                          <li key={addrIndex}>
                            <strong>{addr.addrtype}:</strong> {addr.addr}
                            {addr.vendor && <span className="vendor-info">({addr.vendor})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {host.hostnames && host.hostnames.length > 0 && (
                    <div className="host-names">
                      <h5>Nomi host:</h5>
                      <ul>
                        {host.hostnames.map((hostname, hostnameIndex) => (
                          <li key={hostnameIndex}>
                            <strong>{hostname.type}:</strong> {hostname.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {host.ports && host.ports.length > 0 ? (
                    <div className="ports-section">
                      <h5>Porte aperte e servizi ({host.ports.length})</h5>
                      <div className="ports-table-container">
                        <table className="ports-table">
                          <thead>
                            <tr>
                              <th>Porta</th>
                              <th>Protocollo</th>
                              <th>Stato</th>
                              <th>Servizio</th>
                              <th>Versione</th>
                              <th>Dettagli</th>
                            </tr>
                          </thead>
                          <tbody>
                            {host.ports.map((port, portIndex) => (
                              <tr key={portIndex}>
                                <td>{port.portid}</td>
                                <td>{port.protocol}</td>
                                <td>
                                  <span className={`port-state ${port.state?.state}`}>
                                    {port.state?.state}
                                  </span>
                                </td>
                                <td>
                                  {port.service?.name || '-'}
                                  {port.service?.product && (
                                    <span className="product-info">
                                      ({port.service.product})
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {port.service?.version || '-'}
                                  {port.service?.extrainfo && (
                                    <span className="extra-info">
                                      ({port.service.extrainfo})
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {port.service?.ostype && (
                                    <div className="service-details">
                                      <strong>OS:</strong> {port.service.ostype}
                                    </div>
                                  )}
                                  {port.service?.method && (
                                    <div className="service-details">
                                      <strong>Metodo:</strong> {port.service.method}
                                    </div>
                                  )}
                                  {port.service?.conf && (
                                    <div className="service-details">
                                      <strong>Confidenza:</strong> {port.service.conf}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {host.ports.some(port => port.scripts && port.scripts.length > 0) && (
                        <div className="vulnerability-results">
                          <h5>Risultati degli script di vulnerabilità</h5>
                          {host.ports.filter(port => port.scripts && port.scripts.length > 0).map((port, portIndex) => (
                            <div key={`vuln-${portIndex}`} className="port-vulnerability">
                              <h6>Porta {port.portid} ({port.protocol}):</h6>
                              {port.scripts.map((script, scriptIndex) => (
                                <div key={`script-${scriptIndex}`} className="script-result">
                                  <div className="script-header">
                                    <strong>{script.id}:</strong>
                                    <span className="script-severity">
                                      {script.id.toLowerCase().includes('high') ? 'Alta' :
                                       script.id.toLowerCase().includes('medium') ? 'Media' :
                                       script.id.toLowerCase().includes('low') ? 'Bassa' : 'Info'}
                                    </span>
                                  </div>
                                  <pre className="script-output">{script.output}</pre>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="no-ports">Nessuna porta aperta trovata</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <p>Nessun host trovato o target non raggiungibile.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Aggiungi il componente SystemLogs per i log di Nmap */}
      <div className="tool-logs-section">
        <SystemLogs service="nmap" title="Log di Nmap" maxLogs={15} height="350px" refreshInterval={3000} />
      </div>
    </div>
  );
};

export default NmapTool; 
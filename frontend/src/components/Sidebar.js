import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import '../assets/css/Sidebar.css';

const toolsConfig = {
  nmap: {
    displayName: 'Nmap',
    logo: '/tool-logos/nmap-logo.png'
  },
  amass: {
    displayName: 'Amass',
    logo: '/tool-logos/amass-logo.png'
  },
  metasploit: {
    displayName: 'Metasploit',
    logo: '/tool-logos/metasploit-logo.png'
  },
  linpeas: {
    displayName: 'LinPEAS',
    logo: null
  },
  winpeas: {
    displayName: 'WinPEAS',
    logo: null
  }
};

// Dati locali per le fasi
const phases = [
  {
    id: 'projects',  // Nuova sezione progetti
    name: 'Progetti',
    description: 'Gestisci i progetti di assessment',
    isSpecial: true  // Flag per indicare che non è una fase standard
  },
  {
    id: 'library',  // Nuova sezione libreria dei report
    name: 'Library',
    description: 'Accedi alla libreria dei report',
    isSpecial: true  // Flag per indicare che non è una fase standard
  },
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    description: 'Information gathering about the target',
    tools: ['nmap', 'amass']
  },
  {
    id: 'exploitation',
    name: 'Exploitation',
    description: 'Exploiting vulnerabilities in the target',
    tools: ['metasploit']
  }
];

const Sidebar = () => {
  const [expandedPhase, setExpandedPhase] = useState(null);

  const togglePhase = useCallback((phaseId) => {
    if (expandedPhase === phaseId) {
      setExpandedPhase(null);
    } else {
      setExpandedPhase(phaseId);
    }
  }, [expandedPhase]);

  const handlePhaseClick = useCallback((e, phaseId, isSpecial) => {
    try {
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      
      // Se è una sezione speciale, non espanderla ma naviga direttamente
      if (isSpecial) {
        return;
      }
      
      togglePhase(phaseId);
    } catch (error) {
      console.error('Error handling phase click:', error);
    }
  }, [togglePhase]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="logo-link">
          <img src="/logo.png" alt="Red Teaming Toolkit" className="sidebar-logo" />
        </Link>
      </div>
      <div className="sidebar-content">
        <ul className="phase-list">
          {phases.map(phase => {
            if (!phase || typeof phase !== 'object' || !phase.id) {
              return null;
            }
            
            const phaseName = phase.name || 'Unnamed Phase';
            const isSpecial = phase.isSpecial || false;
            
            // Se è la sezione progetti, utilizza un markup diverso
            if (isSpecial && phase.id === 'projects') {
              return (
                <li key={phase.id} className="phase-item special-item">
                  <Link to="/projects" className="special-link">
                    <div className="phase-header special-header">
                      <span className="phase-name">{phaseName}</span>
                      <span className="special-icon">📋</span>
                    </div>
                  </Link>
                </li>
              );
            }
            
            // Se è la sezione libreria, utilizza un markup simile ai progetti
            if (isSpecial && phase.id === 'library') {
              return (
                <li key={phase.id} className="phase-item special-item">
                  <Link to="/library" className="special-link">
                    <div className="phase-header special-header">
                      <span className="phase-name">{phaseName}</span>
                      <span className="special-icon">📚</span>
                    </div>
                  </Link>
                </li>
              );
            }
            
            return (
              <li key={phase.id} className="phase-item">
                <div 
                  className={`phase-header ${expandedPhase === phase.id ? 'expanded' : ''}`}
                  onClick={(e) => handlePhaseClick(e, phase.id, isSpecial)}
                >
                  <span className="phase-name">{phaseName}</span>
                  <span className="phase-icon">{expandedPhase === phase.id ? '▼' : '▶'}</span>
                </div>
                
                {expandedPhase === phase.id && (
                  <div className="phase-tools">
                    {phase.tools && Array.isArray(phase.tools) && phase.tools.length > 0 ? (
                      <ul className="tool-list">
                        {phase.tools.map(tool => {
                          if (!tool) return null;
                          const toolConfig = toolsConfig[tool];
                          if (!toolConfig?.logo) return null;
                          
                          return (
                            <li key={tool} className="tool-item">
                              <Link 
                                to={`/${phase.id}/${tool}`}
                                onClick={(e) => {
                                  try {
                                    if (e && typeof e.stopPropagation === 'function') {
                                      e.stopPropagation();
                                    }
                                  } catch (err) {
                                    console.error('Error in link click handler:', err);
                                  }
                                }}
                                className="tool-link"
                              >
                                <img src={toolConfig.logo} alt={`${toolConfig.displayName} logo`} className="tool-logo" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="no-tools">No tools available</div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default React.memo(Sidebar); 
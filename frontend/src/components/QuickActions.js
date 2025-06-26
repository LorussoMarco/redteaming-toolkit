import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../assets/css/QuickActions.css';
import api from '../api/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faChartBar } from '@fortawesome/free-solid-svg-icons';

const QuickActions = () => {
  return (
    <div className="quick-actions">
      <h2 className="actions-title">Strumenti Principali</h2>
      
      <div className="quick-actions-container">
        <div className="tool-shortcuts">
          <div className="tools-grid">
            <Link to="/reconnaissance/nmap" className="tool-card">
              <div className="tool-icon">🔍</div>
              <span className="tool-name">Nmap</span>
            </Link>
            <Link to="/reconnaissance/amass" className="tool-card">
              <div className="tool-icon">🌐</div>
              <span className="tool-name">Amass</span>
            </Link>
            <Link to="/exploitation/metasploit" className="tool-card">
              <div className="tool-icon">🛠️</div>
              <span className="tool-name">Metasploit</span>
            </Link>
            <Link to="/reports" className="tool-card reports-shortcut">
              <div className="tool-icon">
                <FontAwesomeIcon icon={faFileAlt} />
              </div>
              <span className="tool-name">Reports</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions; 
import React, { useState, useEffect } from 'react';
import '../assets/css/Dashboard.css';
import ActivityTimeline from '../components/ActivityTimeline';
import QuickActions from '../components/QuickActions';
import ProjectsStatus from '../components/ProjectsStatus';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard Red Teaming Toolkit</h1>
        <p>Portale di gestione delle attività di penetration testing</p>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-main">
          <QuickActions />
          <ProjectsStatus />
        </div>
        
        <div className="dashboard-sidebar">
          <ActivityTimeline />
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
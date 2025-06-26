/**
 * Configurazione dell'API client
 */

// Base URL per le API
export const API_URL = process.env.REACT_APP_API_URL || 'https://localhost:5000/api';

// Costanti per gli stati dei progetti
export const PROJECT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed'
};

// Costanti per le fasi dei progetti
export const PROJECT_PHASES = {
  DISCOVERY: 'discovery',
  ASSESSMENT: 'assessment',
  TRACKING: 'tracking'
};

// Costanti per i tipi di target
export const TARGET_TYPES = {
  HOST: 'host',
  SUBNET: 'subnet',
  DOMAIN: 'domain'
};

// Costanti per gli stati dei target
export const TARGET_STATUS = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  SCANNED: 'scanned'
};

// Costanti per i tipi di risorse
export const RESOURCE_TYPES = {
  IMAGE: 'image',
  DIAGRAM: 'diagram',
  DOCUMENT: 'document'
};

// Costanti per i tipi di tool
export const TOOL_TYPES = {
  NMAP: 'nmap',
  AMASS: 'amass',
  METASPLOIT: 'metasploit' // Kept for routing, will be implemented in the future
};

// Costanti per i livelli di severità
export const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  NONE: 'NONE'
}; 
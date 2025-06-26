from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
import re

from .models import ScanReport, Project
from ..utils.logger import get_module_logger
from ..config import TIMEZONE

logger = get_module_logger('report_repository')

class ReportRepository:
    """
    Repository per la gestione dei report nel database.
    """
    
    def __init__(self, db: Session):
        """
        Inizializza il repository
        
        Args:
            db: Sessione del database
        """
        self.db = db
        logger.info("ReportRepository inizializzato")
    
    def save_report(self, tool: str, scan_type: str, data: Dict[str, Any], target: Optional[str] = None,
                  project_id: Optional[int] = None, target_id: Optional[int] = None) -> int:
        """
        Salva un report nel database
        
        Args:
            tool: Nome del tool ('amass' o 'nmap')
            scan_type: Tipo di scansione
            data: Dizionario completo con i dati del report
            target: Target della scansione (opzionale, stringa)
            project_id: ID del progetto associato (opzionale)
            target_id: ID del target associato (opzionale)
            
        Returns:
            int: ID del report salvato
        """
        try:
            # Crea un nuovo report con timestamp nel timezone configurato
            report = ScanReport(
                tool=tool,
                scan_type=scan_type,
                target=target,
                timestamp=datetime.now(TIMEZONE),
                project_id=project_id,
                target_id=target_id,
                stored_on_fs=False,
                fs_path=None
            )
            report.set_data(data)
            
            # Salva nel database
            self.db.add(report)
            self.db.commit()
            self.db.refresh(report)
            
            logger.info(f"Report {tool}/{scan_type} salvato con ID: {report.id}")
            return report.id
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nel salvataggio del report {tool}/{scan_type}: {str(e)}")
            raise
    
    def get_report_by_id(self, report_id: int) -> Optional[Dict[str, Any]]:
        """
        Recupera un report completo dal database
        
        Args:
            report_id: ID del report
            
        Returns:
            Dict o None: Il report completo o None se non trovato
        """
        try:
            report = self.db.query(ScanReport).filter(ScanReport.id == report_id).first()
            
            if not report:
                logger.warning(f"Report con ID {report_id} non trovato")
                return None
                
            # Restituisci il dizionario completo
            return report.get_data()
            
        except Exception as e:
            logger.error(f"Errore nel recupero del report {report_id}: {str(e)}")
            return None
    
    def get_report_tool_type(self, report_id: int) -> Optional[str]:
        """
        Recupera il tipo di tool di un report
        
        Args:
            report_id: ID del report
            
        Returns:
            str o None: Il tipo di tool o None se non trovato
        """
        try:
            report = self.db.query(ScanReport).filter(ScanReport.id == report_id).first()
            
            if not report:
                logger.warning(f"Report con ID {report_id} non trovato")
                return None
                
            return report.tool
            
        except Exception as e:
            logger.error(f"Errore nel recupero del tipo di tool per il report {report_id}: {str(e)}")
            return None
    
    def list_reports(self, tool: Optional[str] = None, project_id: Optional[int] = None,
                   target_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Lista tutti i report disponibili, opzionalmente filtrati
        
        Args:
            tool: Nome del tool per filtrare i report ('amass' o 'nmap')
            project_id: ID del progetto per filtrare i report
            target_id: ID del target per filtrare i report
            limit: Numero massimo di report da restituire
            
        Returns:
            Lista di dizionari con i report (senza i dettagli completi)
        """
        try:
            # Query base
            query = self.db.query(ScanReport)
            
            # Applica filtri se specificati
            if tool:
                query = query.filter(ScanReport.tool == tool)
                
            if project_id is not None:
                query = query.filter(ScanReport.project_id == project_id)
                
            if target_id is not None:
                query = query.filter(ScanReport.target_id == target_id)
                
            # Ordina per data decrescente (più recenti prima)
            query = query.order_by(desc(ScanReport.timestamp))
            
            # Limitare i risultati
            query = query.limit(limit)
            
            # Converti in dizionari
            reports = [report.to_dict() for report in query.all()]
            
            filter_msg = []
            if tool:
                filter_msg.append(f"tool={tool}")
            if project_id is not None:
                filter_msg.append(f"project_id={project_id}")
            if target_id is not None:
                filter_msg.append(f"target_id={target_id}")
                
            logger.info(f"Recuperati {len(reports)} report" + (f" con filtri: {', '.join(filter_msg)}" if filter_msg else ""))
            return reports
            
        except Exception as e:
            logger.error(f"Errore nel recupero dei report: {str(e)}")
            return []

    def delete_report(self, report_id: int) -> bool:
        """
        Elimina un report dal database
        
        Args:
            report_id: ID del report da eliminare
            
        Returns:
            bool: True se l'eliminazione è riuscita, False altrimenti
        """
        try:
            # Trova il report
            report = self.db.query(ScanReport).filter(ScanReport.id == report_id).first()
            
            if not report:
                logger.warning(f"Report con ID {report_id} non trovato per l'eliminazione")
                return False
            
            # Elimina il report
            self.db.delete(report)
            self.db.commit()
            
            logger.info(f"Report con ID {report_id} eliminato con successo")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'eliminazione del report {report_id}: {str(e)}")
            return False
    
    def save_nmap_report(self, scan_results: Dict[str, Any], scan_type: str, 
                        project_id: Optional[int] = None, target_id: Optional[int] = None) -> int:
        """
        Salva un report di scansione nmap
        
        Args:
            scan_results: Risultati della scansione
            scan_type: Tipo di scansione eseguita
            project_id: ID del progetto associato (opzionale)
            target_id: ID del target associato (opzionale)
        
        Returns:
            int: ID del report salvato
        """
        try:
            target = scan_results.get('scan_info', {}).get('target')
            command_used = scan_results.get('scan_info', {}).get('command_used')
            
            # Genera un timestamp formattato nel timezone configurato
            timestamp = datetime.now(TIMEZONE).strftime('%Y%m%d_%H%M%S')
            
            # Migliore rilevamento delle vulnerabilità
            vulnerability_count = 0
            vulnerability_details = []
            
            # Analizziamo ogni host e ogni porta per trovare vulnerabilità
            for host in scan_results.get('hosts', []):
                host_ip = None
                if host.get('addresses'):
                    for addr in host.get('addresses', []):
                        if addr.get('addrtype') == 'ipv4':
                            host_ip = addr.get('addr')
                            break
                
                for port in host.get('ports', []):
                    port_id = port.get('portid')
                    service_name = port.get('service', {}).get('name', '')
                    service_version = port.get('service', {}).get('version', '')
                    service_product = port.get('service', {}).get('product', '')
                    
                    # 1. Controlla gli script di vulnerabilità
                    for script in port.get('scripts', []):
                        script_id = script.get('id', '')
                        output = script.get('output', '')
                        
                        # Vulnerabilità specifiche dallo script vulners
                        if script_id == 'vulners':
                            cve_matches = re.findall(r'CVE-\d{4}-\d+', output)
                            unique_cves = set(cve_matches)
                            
                            # Aggiunge ogni CVE alle vulnerabilità
                            for cve in unique_cves:
                                # Trova il CVSS score se disponibile
                                cvss_match = re.search(r'{}.*?(\d+\.\d+)'.format(re.escape(cve)), output)
                                cvss_score = cvss_match.group(1) if cvss_match else None
                                
                                vulnerability_details.append({
                                    'id': cve,
                                    'host': host_ip,
                                    'port': port_id,
                                    'service': service_name,
                                    'severity': cvss_score,
                                    'type': 'cve',
                                    'script': script_id,
                                    'details': output
                                })
                            
                            vulnerability_count += len(unique_cves)
                            
                        # Altri script di vulnerabilità
                        elif 'vuln' in script_id:
                            vulnerability_count += 1
                            vulnerability_details.append({
                                'id': script_id,
                                'host': host_ip,
                                'port': port_id,
                                'service': service_name,
                                'type': 'script',
                                'details': output
                            })
                    
                    # 2. Controlla anche servizi con versioni vulnerabili note
                    if service_product and service_version:
                        # Alcuni esempi di software con vulnerabilità note
                        vulnerable_software = {
                            'apache': ['2.2.', '2.4.0', '2.4.1'],
                            'openssh': ['4.', '5.', '6.0', '6.1', '6.2', '6.3', '6.4', '6.5', '6.6'],
                            'nginx': ['1.3.', '1.4.0'],
                            'vsftp': ['2.'],
                            'proftpd': ['1.3.3'],
                            'mysql': ['5.0', '5.1'],
                            'tomcat': ['6.', '7.0'],
                            'wordpress': ['3.', '4.0', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7']
                        }
                        
                        for software, vulnerable_versions in vulnerable_software.items():
                            if software.lower() in service_product.lower():
                                for version in vulnerable_versions:
                                    if service_version.startswith(version):
                                        vulnerability_count += 1
                                        vulnerability_details.append({
                                            'id': f'potential-{software}-{version}',
                                            'host': host_ip,
                                            'port': port_id,
                                            'service': service_name,
                                            'type': 'version',
                                            'details': f"Potentially vulnerable {service_product} version {service_version}"
                                        })
                                        break
            
            # Prepara il report
            report = {
                'metadata': {
                    'tool': 'nmap',
                    'scan_type': scan_type,
                    'timestamp': timestamp,
                    'target': target,
                    'target_type': scan_results.get('scan_info', {}).get('target_type'),
                    'command_used': command_used
                },
                'summary': {
                    'total_hosts': len(scan_results.get('hosts', [])),
                    'hosts_up': sum(1 for h in scan_results.get('hosts', []) 
                                   if h.get('status', {}).get('state') == 'up'),
                    'total_ports': sum(len(h.get('ports', [])) 
                                     for h in scan_results.get('hosts', [])),
                    'vulnerabilities_found': vulnerability_count
                },
                'details': {
                    'hosts': scan_results.get('hosts', [])
                }
            }
            
            # Aggiungi i dettagli delle vulnerabilità se ce ne sono
            if vulnerability_details:
                report['vulnerabilities'] = vulnerability_details
            
            # Salva il report usando il metodo generico
            report_id = self.save_report('nmap', scan_type, report, target, project_id, target_id)
            
            # Aggiorna il conteggio delle vulnerabilità anche nel record del DB
            if vulnerability_count > 0:
                report_obj = self.db.query(ScanReport).filter(ScanReport.id == report_id).first()
                if report_obj:
                    report_obj.vulnerability_count = vulnerability_count
                    self.db.commit()
            
            return report_id
            
        except Exception as e:
            logger.error(f"Errore nel salvataggio del report Nmap: {str(e)}")
            raise
    
    def save_amass_report(self, scan_results: Dict[str, Any], scan_type: str, 
                        project_id: Optional[int] = None, target_id: Optional[int] = None) -> int:
        """
        Salva un report di scansione amass
        
        Args:
            scan_results: Risultati della scansione
            scan_type: Tipo di scansione eseguita
            project_id: ID del progetto associato (opzionale)
            target_id: ID del target associato (opzionale)
        
        Returns:
            int: ID del report salvato
        """
        try:
            target = scan_results.get('scan_info', {}).get('domain') or scan_results.get('scan_info', {}).get('target')
            command_used = scan_results.get('scan_info', {}).get('command_used')
            
            # Genera un timestamp formattato nel timezone configurato
            timestamp = datetime.now(TIMEZONE).strftime('%Y%m%d_%H%M%S')
            
            # Estrai i dati che ci interessano
            subdomains = scan_results.get('results', {}).get('subdomains', []) or scan_results.get('domains', [])
            
            # Raccoglie gli indirizzi IP unici
            ip_addresses = set()
            for subdomain in subdomains:
                if isinstance(subdomain, dict):
                    addresses = subdomain.get('addresses', []) 
                    for addr in addresses:
                        if isinstance(addr, dict) and 'ip' in addr:
                            ip_addresses.add(addr['ip'])
            
            # Raccoglie le fonti
            sources = set()
            for subdomain in subdomains:
                if isinstance(subdomain, dict) and 'sources' in subdomain:
                    for src in subdomain['sources']:
                        sources.add(src)
            
            # Prepara il report
            report = {
                'metadata': {
                    'tool': 'amass',
                    'scan_type': scan_type,
                    'timestamp': timestamp,
                    'target': target,
                    'command_used': command_used
                },
                'summary': {
                    'total_subdomains': len(subdomains),
                    'unique_ips': len(ip_addresses),
                    'sources': list(sources)
                },
                'details': {
                    'subdomains': subdomains
                }
            }
            
            # Salva il report usando il metodo generico
            report_id = self.save_report('amass', scan_type, report, target, project_id, target_id)
            return report_id
            
        except Exception as e:
            logger.error(f"Errore nel salvataggio del report Amass: {str(e)}")
            raise
    
    def get_nmap_reports(self, project_id: Optional[int] = None, target_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Recupera i report Nmap, opzionalmente filtrati per progetto o target
        
        Args:
            project_id: ID del progetto da filtrare (opzionale)
            target_id: ID del target da filtrare (opzionale)
            limit: Numero massimo di report da restituire
            
        Returns:
            Lista di dizionari con i report Nmap
        """
        return self.list_reports(tool='nmap', project_id=project_id, target_id=target_id, limit=limit)
    
    def get_amass_reports(self, project_id: Optional[int] = None, target_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Recupera i report Amass, opzionalmente filtrati per progetto o target
        
        Args:
            project_id: ID del progetto da filtrare (opzionale)
            target_id: ID del target da filtrare (opzionale)
            limit: Numero massimo di report da restituire
            
        Returns:
            Lista di dizionari con i report Amass
        """
        return self.list_reports(tool='amass', project_id=project_id, target_id=target_id, limit=limit)
import subprocess
import re
from datetime import datetime
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple, Set
from ..utils.logger import get_module_logger
from ..reporting.report_manager import ReportManager
import os
from ..config import Config, TIMEZONE

logger = get_module_logger('nmap_scan')
report_manager = ReportManager()

def is_subnet(target: str) -> bool:
    """Verifica se il target è una subnet (es. 192.168.1.0/24)"""
    subnet_pattern = r'^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$'
    is_subnet = bool(re.match(subnet_pattern, target))
    logger.info(f"Target {target} is {'a subnet' if is_subnet else 'a single IP'}")
    return is_subnet

def get_scan_commands() -> Dict[str, str]:
    """Restituisce i comandi di scansione disponibili"""
    commands = {
        '1': 'Scansione TCP completa (Tutte le porte)',
        '2': 'Scansione rapida delle porte più note',
        '3': 'Scansione UDP delle porte più note',
        '4': 'Scansione TCP con rilevamento servizi',
        '5': 'Scansione TCP con rilevamento OS',
        '6': 'Scansione TCP con rilevamento servizi e OS',
        '7': 'Scansione TCP con rilevamento vulnerabilità base',
        '8': 'Scansione TCP con rilevamento vulnerabilità avanzato',
        '9': 'Scansione subnet rapida',
        '10': 'Scansione subnet completa',
        '11': 'Scansione stealth (limite velocità per evitare rilevamento)'
    }
    logger.info("Retrieved available scan commands")
    return commands

def get_nmap_command(scan_type: str, target: str, sudo_password: Optional[str] = None, max_rate: Optional[int] = None) -> Tuple[List[str], bool]:
    """Genera il comando nmap appropriato in base al tipo di scansione"""
    logger.info(f"Generating nmap command for scan type: {scan_type}, target: {target}")
    
    base_command = ['nmap', '-oX', '-', '-sV', '--version-intensity', '5']
    needs_sudo = False
    
    scan_commands = {
        '1': ['-p-', '-sS'],  # TCP completo
        '2': ['-F', '-sS'],   # Scansione rapida
        '3': ['-sU', '-F'],   # UDP rapido
        '4': ['-sS', '-sV'],  # TCP + servizi
        '5': ['-sS', '-O'],   # TCP + OS
        '6': ['-sS', '-sV', '-O'],  # TCP + servizi + OS
        '7': ['-sS', '-sV', '--script', 'default,vuln'],  # TCP + vuln base
        '8': ['-sS', '-sV', '--script', 'default,vuln,auth,exploit'],  # TCP + vuln avanzato
        '9': ['-sn', '-PE', '-PS80,443'],  # Subnet rapida
        '10': ['-sS', '-sV', '-O', '--script', 'default,vuln'],  # Subnet completa
        '11': ['-sS', '-T2', '--max-rate', '10', '-P0', '--randomize-hosts']  # Scansione stealth
    }
    
    if scan_type in scan_commands:
        base_command.extend(scan_commands[scan_type])
        
        # Se è una scansione stealth e max_rate è specificato, sostituisci il valore predefinito
        if scan_type == '11' and max_rate is not None:
            # Trova l'indice di '--max-rate' e sostituisci il valore successivo
            try:
                max_rate_index = base_command.index('--max-rate')
                if max_rate_index + 1 < len(base_command):
                    base_command[max_rate_index + 1] = str(max_rate)
                    logger.debug(f"Custom max-rate set to: {max_rate}")
            except ValueError:
                # Se '--max-rate' non è presente, aggiungilo
                base_command.extend(['--max-rate', str(max_rate)])
                logger.debug(f"Added custom max-rate: {max_rate}")
        
        if scan_type in ['1', '3', '5', '6', '8', '10', '11']:
            needs_sudo = True
            logger.info(f"Scan type {scan_type} requires sudo privileges")
    
    base_command.append(target)
    logger.debug(f"Generated nmap command: {' '.join(base_command)}")
    return base_command, needs_sudo

def run(target: str, scan_type: str = '2', sudo_password: Optional[str] = None, max_rate: Optional[int] = None) -> Dict:
    """Esegue una scansione nmap sul target specificato"""
    logger.info(f"Starting nmap scan on target: {target}, scan type: {scan_type}")
    
    try:
        target_is_subnet = is_subnet(target)
        logger.debug(f"Target identificato come {'subnet' if target_is_subnet else 'indirizzo singolo'}")
        
        # Per le scansioni di subnet, aggiungiamo parametri di ottimizzazione
        if target_is_subnet and scan_type in ['2', '3', '6', '9', '10']:
            logger.info(f"Subnet detected for scan type {scan_type}, using appropriate parameters")
            
            # Otteniamo il comando nmap di base
            nmap_command, needs_sudo = get_nmap_command(scan_type, target, sudo_password, max_rate)
            
            # Aggiungiamo parametri di ottimizzazione per subnet
            if '-T' not in ' '.join(nmap_command):
                nmap_command.insert(-1, '-T4')  # Velocità di scansione più alta
            
            # Per scansioni non di tipo ping, aggiungiamo altri parametri di ottimizzazione
            if scan_type != '9':
                if '--min-hostgroup' not in ' '.join(nmap_command):
                    nmap_command.insert(-1, '--min-hostgroup')
                    nmap_command.insert(-1, '64')  # Raggruppa gli host per scansioni più efficienti
                
                if '--min-rate' not in ' '.join(nmap_command):
                    nmap_command.insert(-1, '--min-rate')
                    nmap_command.insert(-1, '100')  # Imposta un tasso minimo di pacchetti al secondo
        else:
            # Per target singoli, usa il comando standard
            nmap_command, needs_sudo = get_nmap_command(scan_type, target, sudo_password, max_rate)
        
        logger.debug(f"Comando nmap finale: {' '.join(nmap_command)}")
        
        # Aggiungiamo informazioni sul max_rate alla risposta finale per il frontend
        scan_info = {
            'target': target,
            'scan_type': scan_type,
            'target_type': 'subnet' if target_is_subnet else 'single_ip',
            'timestamp': datetime.now(TIMEZONE).strftime('%Y-%m-%d %H:%M:%S'),
            'command_used': ' '.join(nmap_command)
        }
        
        if scan_type == '11' and max_rate is not None:
            scan_info['max_rate'] = max_rate
        
        # Esecuzione del comando nmap
        try:
            if needs_sudo and sudo_password:
                logger.debug("Esecuzione nmap con privilegi sudo")
                command = ['sudo', '-S'] + nmap_command
                process = subprocess.Popen(
                    command,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = process.communicate(input=f"{sudo_password}\n")
            else:
                logger.debug("Esecuzione nmap senza privilegi sudo")
                process = subprocess.Popen(
                    nmap_command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = process.communicate()
            
            logger.debug(f"Nmap process returncode: {process.returncode}")
            
            if stderr:
                logger.warning(f"Nmap stderr output: {stderr}")
            
            if process.returncode != 0:
                logger.error(f"Nmap scan failed with return code: {process.returncode}, stderr: {stderr}")
                return {"status": "error", "message": f"Scansione Nmap fallita (codice {process.returncode}): {stderr}"}
            
            # Analisi dei risultati
            try:
                if not stdout:
                    logger.error("Nmap ha restituito un output vuoto")
                    return {"status": "error", "message": "Nmap ha restituito un output vuoto"}
                    
                logger.debug("Parsing dell'output XML di nmap")
                root = ET.fromstring(stdout)
                results = parse_nmap_xml(root)
                
                # Verifica se sono stati trovati host
                if not results["hosts"]:
                    logger.warning(f"No active hosts found in target {target}")
                    if target_is_subnet:
                        return {"status": "warning", "message": f"Nessun host attivo trovato nella subnet {target}"}
                    else:
                        return {"status": "warning", "message": f"Host {target} non attivo o non raggiungibile"}
                
                # Aggiungi informazioni di scansione
                results['scan_info'] = scan_info
                
                if target_is_subnet:
                    results['scan_info']['active_hosts_count'] = len(results["hosts"])
                
                # Salva il report
                try:
                    report_path = report_manager.save_nmap_report(results, scan_type)
                    results['report_id'] = os.path.basename(report_path)
                    logger.info(f"Saved scan report to: {report_path}")
                except Exception as report_err:
                    logger.error(f"Errore nel salvataggio del report: {str(report_err)}")
                    results['report_error'] = str(report_err)
                
                logger.info(f"Successfully completed nmap scan on {target}")
                return {"status": "success", "results": results}
                
            except ET.ParseError as xml_err:
                logger.error(f"Errore nel parsing XML: {str(xml_err)}")
                logger.debug(f"XML problematico: {stdout[:500]}...")
                return {"status": "error", "message": f"Errore nel parsing dell'output di nmap: {str(xml_err)}"}
                
        except subprocess.SubprocessError as proc_err:
            logger.error(f"Errore del subprocess: {str(proc_err)}")
            return {"status": "error", "message": f"Errore nell'esecuzione del comando nmap: {str(proc_err)}"}
            
    except Exception as e:
        logger.error(f"Errore generale durante la scansione nmap: {str(e)}", exc_info=True)
        return {"status": "error", "message": f"Errore durante la scansione: {str(e)}"}

def parse_nmap_xml(root: ET.Element) -> Dict:
    """Parsa l'output XML di nmap in un dizionario strutturato"""
    logger.debug("Starting to parse nmap XML output")
    
    results = {'hosts': []}
    
    for host in root.findall('.//host'):
        host_data = {
            'status': {},
            'addresses': [],
            'hostnames': [],
            'ports': []
        }
        
        # Stato dell'host
        status = host.find('status')
        if status is not None:
            host_data['status'] = {
                'state': status.get('state'),
                'reason': status.get('reason'),
                'reason_ttl': status.get('reason_ttl')
            }
            logger.debug(f"Host status: {host_data['status']}")
        
        # Indirizzi e hostnames
        for addr in host.findall('address'):
            host_data['addresses'].append({
                'addrtype': addr.get('addrtype'),
                'addr': addr.get('addr'),
                'vendor': addr.get('vendor')
            })
            logger.debug(f"Found address: {addr.get('addr')} ({addr.get('addrtype')})")
        
        for hostname in host.findall('hostnames/hostname'):
            host_data['hostnames'].append({
                'name': hostname.get('name'),
                'type': hostname.get('type')
            })
            logger.debug(f"Found hostname: {hostname.get('name')} ({hostname.get('type')})")
        
        # Porte e servizi
        for port in host.findall('.//port'):
            port_data = {
                'portid': port.get('portid'),
                'protocol': port.get('protocol'),
                'state': {},
                'service': {}
            }
            
            state = port.find('state')
            if state is not None:
                port_data['state'] = {
                    'state': state.get('state'),
                    'reason': state.get('reason'),
                    'reason_ttl': state.get('reason_ttl')
                }
            
            service = port.find('service')
            if service is not None:
                port_data['service'] = {
                    'name': service.get('name'),
                    'product': service.get('product'),
                    'version': service.get('version'),
                    'extrainfo': service.get('extrainfo'),
                    'ostype': service.get('ostype'),
                    'method': service.get('method'),
                    'conf': service.get('conf')
                }
            
            scripts = []
            for script in port.findall('script'):
                script_data = {
                    'id': script.get('id'),
                    'output': script.get('output')
                }
                scripts.append(script_data)
                logger.debug(f"Found vulnerability script: {script.get('id')}")
            
            if scripts:
                port_data['scripts'] = scripts
            
            host_data['ports'].append(port_data)
            logger.debug(f"Found port: {port.get('portid')}/{port.get('protocol')}")
        
        results['hosts'].append(host_data)
    
    logger.info(f"Parsed {len(results['hosts'])} hosts from nmap output")
    return results
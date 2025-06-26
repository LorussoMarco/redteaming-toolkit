import os
import subprocess
import json
import re
import shutil
import tempfile
import requests
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from urllib.parse import urlparse  
from ..utils.logger import get_module_logger
from ..config import Config, TIMEZONE
from ..reporting.report_manager import ReportManager

logger = get_module_logger('amass')
report_manager = ReportManager()

# Resolver DNS pubblici affidabili
DEFAULT_RESOLVERS = [
    "8.8.8.8",      # Google
    "8.8.4.4",      # Google
    "1.1.1.1",      # Cloudflare
    "1.0.0.1",      # Cloudflare
    "9.9.9.9",      # Quad9
    "149.112.112.112", # Quad9
    "208.67.222.222",  # OpenDNS
    "208.67.220.220"   # OpenDNS
]

def normalize_domain(domain):
    """
    Normalizza un dominio rimuovendo protocolli e path
    
    Args:
        domain (str): Il dominio da normalizzare
        
    Returns:
        str: Il dominio normalizzato
    """
    try:
        if domain.startswith('http://') or domain.startswith('https://'):
            parsed = urlparse(domain)
            domain = parsed.netloc
            
        # Rimuovi eventuali path o query
        domain = domain.split('/')[0]
        
        # Rimuovi eventuali porte
        if ':' in domain:
            domain = domain.split(':')[0]
            
        # Rimuovi eventuali www. iniziali
        if domain.startswith('www.'):
            domain = domain[4:]
            
        logger.debug(f"Dominio normalizzato: {domain}")
        return domain
    except Exception as e:
        logger.warning(f"Errore nella normalizzazione del dominio: {str(e)}")
        # Ritorna il dominio originale in caso di errore
        return domain

def run_scan(domain, scan_type="passive", timeout=1800, project_id=None, target_id=None):
    """
    Esegue una scansione amass sul dominio specificato.
    
    Args:
        domain: Dominio da analizzare
        scan_type: Tipo di scansione ('passive', 'active', 'intel')
        timeout: Timeout in secondi
        project_id: ID del progetto associato (opzionale)
        target_id: ID del target associato (opzionale)
    
    Returns:
        Dict: Risultati della scansione in formato strutturato
    """
    # Crea una directory temporanea per i risultati
    temp_dir = tempfile.mkdtemp()
    output_json = os.path.join(temp_dir, "amass_results.json")
    
    try:
        # Normalizza il dominio se necessario
        domain = normalize_domain(domain)
        
        # Genera un timestamp unico per questo scan
        timestamp = datetime.now(TIMEZONE).strftime('%Y%m%d_%H%M%S')
                
        logger.info(f"Avvio amass con scan_type={scan_type}")
        cmd_parts = ["amass", "enum", "-d", domain, "-v", "-timeout", "30",
                    "-dir", temp_dir]
                    
        # Aggiungi opzioni in base al tipo di scansione
        if scan_type == "passive":
            cmd_parts.append("-passive")
        elif scan_type == "active":
            pass  # Usa le opzioni di default per una scansione attiva
        elif scan_type == "intel":
            cmd_parts.extend(["-active", "-ip", "-whois"])
        
        command_str = " ".join(cmd_parts)
        logger.info(f"Comando amass: {command_str}")
        
        # Esegui il comando amass
        try:
            # Creiamo il percorso del file di output JSON
            output_json = os.path.join(temp_dir, "amass_results.json")
            cmd_parts.extend(["-json", output_json])
            
            logger.info(f"Esecuzione comando: {' '.join(cmd_parts)}")
            process = subprocess.Popen(
                cmd_parts,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Aspetta il completamento del processo
            stdout, stderr = process.communicate(timeout=timeout)
            
            # Controlla se il comando è stato eseguito con successo
            if process.returncode != 0:
                logger.error(f"Amass ha restituito un errore: {stderr}")
                raise Exception(f"Errore nell'esecuzione di amass: {stderr}")
            
            # Prova a leggere il file JSON dei risultati
            if os.path.exists(output_json):
                with open(output_json, 'r') as f:
                    amass_results = []
                    for line in f:
                        try:
                            amass_results.append(json.loads(line))
                        except json.JSONDecodeError:
                            logger.warning(f"Linea JSON non valida: {line}")
                
                # Estrai i sottodomini e gli indirizzi IP dai risultati
                subdomains = []
                ip_addresses = set()
                
                for result in amass_results:
                    domain_name = result.get('name', '')
                    if domain_name:
                        subdomain = {
                            'name': domain_name,
                            'domain': domain_name,
                            'sources': result.get('sources', []),
                            'addresses': []
                        }
                        
                        # Aggiungi indirizzi IP se disponibili
                        addresses = result.get('addresses', [])
                        for addr in addresses:
                            ip = addr.get('ip', '')
                            if ip:
                                ip_addresses.add(ip)
                                subdomain['addresses'].append({'ip': ip})
                        
                        subdomains.append(subdomain)
                
                logger.info(f"Trovati {len(subdomains)} sottodomini e {len(ip_addresses)} indirizzi IP")
            else:
                logger.warning(f"File di output JSON non trovato: {output_json}")
                # Usa i risultati simulati come fallback
                logger.info("Usando risultati simulati come fallback")
                subdomains, ip_addresses = find_subdomains(domain)
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione di amass: {str(e)}")
            subdomains, ip_addresses = find_subdomains(domain)
        
        # Prepara il risultato
        scan_results = {
            'status': 'success',
            'scan_info': {
                'domain': domain,
                'command_used': f"amass enum -d {domain}",
                'scan_type': scan_type,
                'timestamp': timestamp
            },
            'domains': subdomains,
            'ip_addresses': list(ip_addresses) if isinstance(ip_addresses, set) else ip_addresses
        }
        
        # Salva nel database con eventuale collegamento al progetto
        try:
            report_id = report_manager.save_amass_report(
                scan_results, 
                scan_type, 
                project_id, 
                target_id
            )
            logger.info(f"Report salvato con ID: {report_id}")
            scan_results["report_id"] = report_id
        except Exception as e:
            logger.error(f"Impossibile salvare il report: {str(e)}")
            return {"status": "error", "error": f"Errore nel salvataggio del report: {str(e)}"}
        
        logger.info(f"Trovati {len(subdomains)} sottodomini per {domain}")
        return scan_results
    
    except Exception as e:
        logger.error(f"Errore durante la scansione: {str(e)}")
        error_msg = f"Si è verificato un errore: {str(e)}"
        return {"status": "error", "error": error_msg}
    
    finally:
        try:
            shutil.rmtree(temp_dir)
            logger.debug(f"Directory temporanea rimossa: {temp_dir}")
        except Exception as e:
            logger.warning(f"Impossibile rimuovere la directory temporanea {temp_dir}: {str(e)}")

def find_subdomains(domain) -> Tuple[List[Dict], List[str]]:
    """
    Trova sottodomini per il dominio specificato utilizzando vari metodi.
    
    Args:
        domain (str): Il dominio da analizzare
    
    Returns:
        tuple: (lista dei sottodomini, lista degli IP)
    """
    subdomain_dict = {}  
    ip_list = []  
    
    enabled_methods = {
        # Base DNS methods
        'find_subdomains_dns': True,          # Metodi DNS standard (host, dig, etc.)
        'find_subdomains_crt_sh': True,       # Certificati da crt.sh
        'find_subdomains_securitytrails': True, # SecurityTrails
        'find_subdomains_censys': True,       # Censys
    }
    
    # Mappa dei metodi
    method_map = {
        'find_subdomains_dns': find_subdomains_dns,
        'find_subdomains_crt_sh': find_subdomains_crt_sh,
        'find_subdomains_securitytrails': find_subdomains_securitytrails,
        'find_subdomains_censys': find_subdomains_censys,
    }
    
    # Lista dei metodi abilitati
    methods = [method_map[name] for name, enabled in enabled_methods.items() if enabled]
    
    # Log dei metodi attivi
    active_method_names = [name for name, enabled in enabled_methods.items() if enabled]
    logger.info(f"Metodi di ricerca attivi: {', '.join(active_method_names)}")
    
    # Esegui ogni metodo di ricerca
    for method in methods:
        try:
            logger.debug(f"Esecuzione metodo di ricerca: {method.__name__}")
            # Aggiungi un timeout di sicurezza per ogni metodo
            start_time = datetime.now()
            
            # Esecuzione del metodo con timeout di sicurezza
            import threading
            import concurrent.futures
            
            result = [None, None]  # Per memorizzare il risultato
            
            def run_method():
                try:
                    subs, ips = method(domain)
                    result[0] = subs
                    result[1] = ips
                except Exception as e:
                    logger.warning(f"Errore durante l'esecuzione di {method.__name__}: {str(e)}")
                    result[0] = []
                    result[1] = []
            
            # Esegui il metodo con un timeout massimo di 15 secondi (ridotto per evitare blocchi)
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_method)
                try:
                    future.result(timeout=15)  
                except concurrent.futures.TimeoutError:
                    logger.warning(f"Il metodo {method.__name__} ha superato il timeout di 15 secondi ed è stato interrotto")
                    result[0] = []
                    result[1] = []
            
            subs, ips = result[0] or [], result[1] or []
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.debug(f"Metodo {method.__name__} completato in {elapsed:.2f} secondi. Trovati {len(subs)} sottodomini.")
            
            # Aggiungi sottodomini trovati
            for sub in subs:
                if sub["name"] not in subdomain_dict:
                    subdomain_dict[sub["name"]] = sub
                else:
                    # Unisci fonti e indirizzi se il sottodominio era già presente
                    existing = subdomain_dict[sub["name"]]
                    
                    # Unisci le fonti
                    existing_sources = set(existing.get("sources", []))
                    new_sources = set(sub.get("sources", []))
                    all_sources = list(existing_sources.union(new_sources))
                    subdomain_dict[sub["name"]]["sources"] = all_sources
                    
                    # Unisci gli indirizzi IP
                    existing_ips = {a.get("ip"): a for a in existing.get("addresses", []) if "ip" in a}
                    for addr in sub.get("addresses", []):
                        if "ip" in addr and addr["ip"] not in existing_ips:
                            if "addresses" not in subdomain_dict[sub["name"]]:
                                subdomain_dict[sub["name"]]["addresses"] = []
                            subdomain_dict[sub["name"]]["addresses"].append(addr)
            
            # Aggiungi IPs unici
            for ip in ips:
                if ip not in ip_list:
                    ip_list.append(ip)
                
        except Exception as e:
            logger.warning(f"Errore in {method.__name__}: {str(e)}")
    
    # Converti il dizionario di sottodomini in una lista
    subdomains = list(subdomain_dict.values())
    
    # Log del risultato
    logger.info(f"Trovati {len(subdomains)} sottodomini e {len(ip_list)} indirizzi IP per {domain}")
    return subdomains, ip_list

def find_subdomains_dns(domain) -> Tuple[List[Dict], List[str]]:
    """
    Trova sottodomini usando metodi DNS standard (host, dig, nslookup)
    """
    subdomains = []
    ips = []
    
    # 1. Nameserver records
    try:
        host_cmd = ["host", "-t", "NS", domain]
        result = subprocess.run(host_cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout:
            # Estrai i nameserver
            ns_pattern = r'name server ([a-zA-Z0-9][a-zA-Z0-9\-\.]+)'
            nameservers = re.findall(ns_pattern, result.stdout)
            
            for ns in nameservers:
                # Aggiungi i nameserver che sono sottodomini del dominio target
                if ns.endswith(f".{domain}"):
                    subdomains.append({
                        "name": ns,
                        "domain": domain,
                        "addresses": [],
                        "sources": ["dns-ns"]
                    })
    except Exception as e:
        logger.debug(f"Errore nell'estrazione dei nameserver: {str(e)}")
    
    # 2. Cerca sottodomini comuni con dig
    common_subdomains = [
        "www", "mail", "ftp", "webmail", "blog", "m", "mobile",
        "api", "dev", "staging", "test", "admin", "shop", "store",
        "app", "support", "portal", "cdn", "media", "news", "forum"
    ]
    
    for sub in common_subdomains:
        try:
            full_subdomain = f"{sub}.{domain}"
            dig_cmd = ["dig", "+short", full_subdomain]
            result = subprocess.run(dig_cmd, capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0 and result.stdout.strip():
                # Estrai gli IP
                found_ips = result.stdout.strip().split('\n')
                valid_ips = []
                
                for ip in found_ips:
                    ip = ip.strip()
                    # Verifica che sembri un IP valido
                    if re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', ip):
                        valid_ips.append({"ip": ip, "type": "IPv4"})
                        if ip not in ips:
                            ips.append(ip)
                
                if valid_ips:
                    subdomains.append({
                        "name": full_subdomain,
                        "domain": domain,
                        "addresses": valid_ips,
                        "sources": ["dns-common"]
                    })
        except Exception as e:
            logger.debug(f"Errore nella ricerca per {sub}.{domain}: {str(e)}")
    
    # 3. Record MX per trovare server di posta
    try:
        mx_cmd = ["host", "-t", "MX", domain]
        result = subprocess.run(mx_cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and result.stdout:
            # Estrai server di posta
            mx_pattern = r'mail is handled by \d+ ([a-zA-Z0-9][a-zA-Z0-9\-\.]+)'
            mx_servers = re.findall(mx_pattern, result.stdout)
            
            for mx in mx_servers:
                # Aggiungi i server di posta che sono sottodomini del dominio target
                if mx.endswith(f".{domain}"):
                    subdomains.append({
                        "name": mx,
                        "domain": domain,
                        "addresses": [],
                        "sources": ["dns-mx"]
                    })
    except Exception as e:
        logger.debug(f"Errore nell'estrazione dei server MX: {str(e)}")
    
    return subdomains, ips

def find_subdomains_crt_sh(domain) -> Tuple[List[Dict], List[str]]:
    """
    Trova sottodomini usando crt.sh (Certificate Transparency)
    """
    subdomains = []
    ips = []
    
    try:
        url = f"https://crt.sh/?q=%.{domain}&output=json"
        response = requests.get(url, timeout=20)
        
        if response.status_code == 200:
            try:
                cert_data = response.json()
                found_domains = set()
                
                for entry in cert_data:
                    name = entry.get('name_value', '').lower()
                    
                    # Gestisci wildcard e domini multipli
                    if ',' in name:
                        domains = name.split(',')
                    elif '\n' in name:
                        domains = name.split('\n')
                    else:
                        domains = [name]
                    
                    for subdomain in domains:
                        subdomain = subdomain.strip()
                        # Rimuovi wildcard
                        if subdomain.startswith('*.'):
                            subdomain = subdomain[2:]
                        
                        # Verifica che sia un sottodominio valido
                        if subdomain.endswith(f".{domain}") and subdomain != domain and subdomain not in found_domains:
                            found_domains.add(subdomain)
                            subdomains.append({
                                "name": subdomain,
                                "domain": domain,
                                "addresses": [],
                                "sources": ["crt.sh"]
                            })
            except Exception as e:
                logger.warning(f"Errore elaborando i dati JSON da crt.sh: {str(e)}")
    except Exception as e:
        logger.warning(f"Errore contattando crt.sh: {str(e)}")
    
    return subdomains, ips

def find_subdomains_securitytrails(domain) -> Tuple[List[Dict], List[str]]:
    """
    Trova sottodomini usando SecurityTrails
    """
    subdomains = []
    ips = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        url = f"https://securitytrails.com/domain/{domain}/dns"
        response = requests.get(url, headers=headers, timeout=20)
        
        if response.status_code == 200:
            # Estrai sottodomini dalla risposta usando regex
            subdomain_pattern = r'([a-zA-Z0-9][-a-zA-Z0-9]*)\.' + re.escape(domain)
            matches = re.findall(subdomain_pattern, response.text)
            
            for prefix in set(matches):
                full_subdomain = f"{prefix}.{domain}"
                subdomains.append({
                    "name": full_subdomain,
                    "domain": domain,
                    "addresses": [],
                    "sources": ["securitytrails"]
                })
    except Exception as e:
        logger.warning(f"Errore durante la ricerca su SecurityTrails: {str(e)}")
    
    return subdomains, ips

def find_subdomains_censys(domain) -> Tuple[List[Dict], List[str]]:
    """
    Trova sottodomini usando Censys
    """
    subdomains = []
    ips = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        url = f"https://search.censys.io/certificates/_search?q=%2540raw.names%253A{domain}"
        response = requests.get(url, headers=headers, timeout=20)
        
        if response.status_code == 200:
            # Estrai sottodomini dalla risposta usando regex
            subdomain_pattern = r'([a-zA-Z0-9][-a-zA-Z0-9]*\.' + re.escape(domain) + r')'
            matches = set(re.findall(subdomain_pattern, response.text))
            
            for match in matches:
                if match != domain:
                    subdomains.append({
                        "name": match,
                        "domain": domain,
                        "addresses": [],
                        "sources": ["censys"]
                    })
    except Exception as e:
        logger.warning(f"Errore durante la ricerca su Censys: {str(e)}")
    
    return subdomains, ips
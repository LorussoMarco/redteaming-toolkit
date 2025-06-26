from flask import Blueprint, request, jsonify, current_app
import os
import sys
import logging
from ..utils import require_api_key

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, project_root)

from backend.modules.reconnaissance.nmap_scan import get_scan_commands, run
from backend.modules.reconnaissance.amass import run_scan
from backend.modules.reporting.report_manager import ReportManager
from app.routes.system import add_system_log, add_activity

recon_bp = Blueprint('reconnaissance', __name__, url_prefix='/api/reconnaissance')
report_manager = ReportManager()
logger = logging.getLogger(__name__)

@recon_bp.route('/nmap/scan-commands', methods=['GET'])
def nmap_commands():
    """Restituisce i comandi di scansione disponibili per Nmap"""
    try:
        commands = get_scan_commands()
        return jsonify({"status": "success", "commands": commands})
    except Exception as e:
        error_msg = f"Errore durante il recupero dei comandi Nmap: {str(e)}"
        add_system_log('error', 'nmap', error_msg)
        return jsonify({"status": "error", "message": error_msg})

@recon_bp.route('/nmap/scan', methods=['POST'])
def nmap_scan():
    """Esegue una scansione Nmap sul target specificato"""
    try:
        data = request.json
        if not data or 'target' not in data:
            return jsonify({"status": "error", "message": "Target mancante"})

        target = data.get('target')
        scan_type = data.get('scan_type', 'quick')
        options = data.get('options', '')
        project_id = data.get('project_id')
        store_on_fs = data.get('store_on_fs', False)
        max_rate = data.get('max_rate')

        # Aggiungi log per l'inizio della scansione
        add_system_log('info', 'nmap', f"Avvio scansione {scan_type} su {target}")
        add_activity('nmap', 'in_progress', target, f"Scansione {scan_type}")

        # Log dettagliato per debug
        logger.info(f"Avviando run() con parametri: target={target}, scan_type={scan_type}, options={options}, project_id={project_id}, max_rate={max_rate}")

        try:
            # Esegui la scansione con il parametro max_rate
            result = run(target, scan_type, options, max_rate=max_rate)
            
            # Aggiorna log e attività in base al risultato
            if result.get("status") == "success":
                report_id = result.get("report_id", "")
                report_path = result.get("report_path", "")
                
                add_system_log('info', 'nmap', f"Scansione completata con successo su {target}")
                add_activity('nmap', 'completed', target, f"Scansione {scan_type}", report_id)
                logger.info(f"Scansione Nmap completata con successo: {result}")
                
                # If project_id is provided, associate report with project
                if project_id and report_path:
                    try:
                        # Import here to avoid circular imports
                        from app.routes.projects import associate_report_with_project
                        
                        # Associate report with project
                        associate_result = associate_report_with_project(
                            report_path, 
                            'nmap', 
                            project_id, 
                            target_address=target
                        )
                        
                        logger.info(f"Report association result: {associate_result}")
                        
                        # Include association info in the result
                        result['project_association'] = associate_result
                    except Exception as e:
                        logger.error(f"Error associating report with project: {str(e)}")
                        # Don't fail the whole request if this part fails
                        result['project_association'] = {
                            "status": "error", 
                            "message": f"Failed to associate with project: {str(e)}"
                        }
                
                # Salva il report nel filesystem se richiesto
                if store_on_fs:
                    try:
                        # Inizializza il ReportManager con supporto filesystem se richiesto
                        report_manager = ReportManager(
                            Config.PROJECTS_FS_PATH if store_on_fs else None
                        )
                        
                        # Salva il report collegandolo al progetto
                        results['report_id'] = report_manager.save_nmap_report(
                            result, 
                            scan_type, 
                            project_id,
                            target_id=target,
                            store_on_fs=store_on_fs
                        )
                    except Exception as e:
                        logger.error(f"Error saving report to filesystem: {str(e)}")
                        result['project_association'] = {
                            "status": "error", 
                            "message": f"Failed to save report to filesystem: {str(e)}"
                        }
                
                return jsonify(result)
            else:
                error_msg = result.get("message", "Errore sconosciuto durante la scansione")
                logger.error(f"Errore ritornato da run(): {error_msg}")
                add_system_log('error', 'nmap', f"Errore durante la scansione su {target}: {error_msg}")
                add_activity('nmap', 'failed', target, f"Scansione {scan_type} fallita")
                return jsonify(result)
                
        except Exception as e:
            logger.error(f"Eccezione durante l'esecuzione di run(): {str(e)}", exc_info=True)
            error_msg = f"Errore durante l'esecuzione di Nmap: {str(e)}"
            add_system_log('error', 'nmap', error_msg)
            return jsonify({"status": "error", "message": error_msg})
            
    except Exception as e:
        logger.error(f"Errore generale nella route nmap_scan: {str(e)}", exc_info=True)
        error_msg = f"Errore durante l'esecuzione della scansione Nmap: {str(e)}"
        add_system_log('error', 'nmap', error_msg)
        return jsonify({"status": "error", "message": error_msg})

@recon_bp.route('/nmap/reports', methods=['GET'])
def list_nmap_reports():
    """
    Elenca tutti i report delle scansioni Nmap disponibili.
    
    Returns:
        JSON: Lista di report Nmap disponibili o messaggio di errore.
    """
    try:
        # Ottieni la lista dei report Nmap
        nmap_reports = report_manager.get_nmap_reports()
        
        if not nmap_reports:
            return jsonify({
                "status": "success",
                "reports": []
            })
        
        return jsonify({
            "status": "success",
            "reports": nmap_reports
        })
    except Exception as e:
        logger.error(f"Errore durante il recupero dei report Nmap: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Errore durante il recupero dei report Nmap: {str(e)}"
        }), 500

@recon_bp.route('/nmap/report-detail', methods=['GET'])
def get_nmap_report_detail():
    """
    Ottiene i dettagli di un report Nmap specifico.
    
    Query Parameters:
        id (str): ID del report nel database.
    
    Returns:
        JSON: Dettagli del report Nmap o messaggio di errore.
    """
    try:
        # Ottieni il parametro id dalla query
        report_id = request.args.get("id")
        
        if not report_id or report_id == "undefined":
            return jsonify({
                "status": "error",
                "message": "Parametro 'id' mancante o non valido"
            }), 400
        
        logger.info(f"Richiesto report Nmap con ID: {report_id}")
        
        # Carica il report completo
        report = report_manager.load_nmap_report_file(report_id)
        
        if not report:
            return jsonify({
                "status": "error",
                "message": f"Impossibile caricare il report con ID: {report_id}"
            }), 404
        
        return jsonify({
            "status": "success",
            "report": report
        })
    except Exception as e:
        logger.error(f"Errore durante il recupero dei dettagli del report Nmap: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Errore durante il recupero dei dettagli del report Nmap: {str(e)}"
        }), 500

@recon_bp.route('/amass/scan', methods=['POST'])
def amass_scan():
    """Esegue una scansione Amass sul dominio specificato"""
    try:
        data = request.json
        if not data or 'domain' not in data:
            return jsonify({"status": "error", "message": "Dominio mancante"})

        domain = data.get('domain')
        scan_type = data.get('scan_type', 'passive')
        options = data.get('options', '')
        project_id = data.get('project_id')
        store_on_fs = data.get('store_on_fs', False)

        # Aggiungi log per l'inizio della scansione
        add_system_log('info', 'amass', f"Avvio scansione {scan_type} su {domain}")
        add_activity('amass', 'in_progress', domain, f"Scansione {scan_type}")

        # Esegui la scansione
        result = run_scan(domain, scan_type, options)
        
        # Aggiorna log e attività in base al risultato
        if result.get("status") == "success":
            report_id = result.get("report_id", "")
            report_path = result.get("report_path", "")
            
            add_system_log('info', 'amass', f"Scansione completata con successo su {domain}")
            add_activity('amass', 'completed', domain, f"Scansione {scan_type}", report_id)
            
            # If project_id is provided, associate report with project
            if project_id and report_path:
                try:
                    # Import here to avoid circular imports
                    from app.routes.projects import associate_report_with_project
                    
                    # Associate report with project
                    associate_result = associate_report_with_project(
                        report_path, 
                        'amass', 
                        project_id, 
                        target_address=domain
                    )
                    
                    logger.info(f"Report association result: {associate_result}")
                    
                    # Include association info in the result
                    result['project_association'] = associate_result
                except Exception as e:
                    logger.error(f"Error associating report with project: {str(e)}")
                    # Don't fail the whole request if this part fails
                    result['project_association'] = {
                        "status": "error", 
                        "message": f"Failed to associate with project: {str(e)}"
                    }
            
            # Salva il report nel filesystem se richiesto
            if store_on_fs:
                try:
                    # Inizializza il ReportManager con supporto filesystem se richiesto
                    report_manager = ReportManager(
                        Config.PROJECTS_FS_PATH if store_on_fs else None
                    )
                    
                    # Salva il report collegandolo al progetto
                    results['report_id'] = report_manager.save_amass_report(
                        result, 
                        scan_type, 
                        project_id,
                        target_id=domain,
                        store_on_fs=store_on_fs
                    )
                except Exception as e:
                    logger.error(f"Error saving report to filesystem: {str(e)}")
                    result['project_association'] = {
                        "status": "error", 
                        "message": f"Failed to save report to filesystem: {str(e)}"
                    }
            
            return jsonify(result)
        else:
            error_msg = result.get("message", "Errore sconosciuto durante la scansione")
            add_system_log('error', 'amass', f"Errore durante la scansione su {domain}: {error_msg}")
            add_activity('amass', 'failed', domain, f"Scansione {scan_type} fallita")
            return jsonify(result)
            
    except Exception as e:
        error_msg = f"Errore durante l'esecuzione della scansione Amass: {str(e)}"
        add_system_log('error', 'amass', error_msg)
        return jsonify({"status": "error", "message": error_msg})

@recon_bp.route('/amass/reports', methods=['GET'])
def list_amass_reports():
    """Lista tutti i report amass disponibili"""
    try:
        reports = report_manager.list_reports('amass')
        return jsonify({'status': 'success', 'reports': reports})
    except Exception as e:
        logger.error(f"Error in list_amass_reports route: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@recon_bp.route('/amass/scan-types', methods=['GET'])
def get_amass_scan_types():
    """Restituisce i tipi di scansione amass disponibili"""
    try:
        scan_types = {
            'passive': 'Scansione passiva (non invia traffico al dominio target)',
            'active': 'Scansione attiva (invia traffico al dominio target)',
            'intel': 'Intelligence gathering sul dominio'
        }
        return jsonify({'status': 'success', 'scan_types': scan_types})
    except Exception as e:
        logger.error(f"Error in get_amass_scan_types route: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@recon_bp.route('/amass/report-detail', methods=['GET'])
def get_amass_report_detail():
    """
    Ottiene i dettagli di un report Amass specifico.
    
    Query Parameters:
        id (str): ID del report nel database.
        path (str): Percorso del report (alternativo all'ID).
    
    Returns:
        JSON: Dettagli del report Amass o messaggio di errore.
    """
    try:
        # Ottieni il parametro id o path dalla query
        report_id = request.args.get("id")
        report_path = request.args.get("path")
        
        if not report_id and not report_path:
            return jsonify({
                "status": "error",
                "message": "Parametro 'id' o 'path' mancante o non valido"
            }), 400
        
        # Usa il path se disponibile, altrimenti l'id
        report_identifier = report_path if report_path else report_id
        
        logger.info(f"Richiesto report Amass con identificatore: {report_identifier}")
        
        # Carica il report completo
        report = report_manager.load_report_file(report_identifier)
        
        if not report:
            return jsonify({
                "status": "error",
                "message": f"Impossibile caricare il report con identificatore: {report_identifier}"
            }), 404
        
        return jsonify({
            "status": "success",
            "report": report
        })
    except Exception as e:
        logger.error(f"Errore durante il recupero dei dettagli del report Amass: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Errore durante il recupero dei dettagli del report Amass: {str(e)}"
        }), 500

@recon_bp.route('/api/reconnaissance/nmap', methods=['POST'])
@require_api_key
def run_nmap_scan():
    """Endpoint per avviare una scansione nmap."""
    try:
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Nessun dato fornito'
            }), 400
            
        target = data.get('target')
        scan_type = data.get('scan_type', '2')  
        sudo_password = data.get('sudo_password')
        project_id = data.get('project_id')
        target_id = data.get('target_id')
        
        if not target:
            return jsonify({
                'status': 'error',
                'message': 'Target non specificato'
            }), 400
            
        # Esegui la scansione
        result = nmap_scan.run(target, scan_type, sudo_password)
        
        # Associa al progetto se specificato
        if project_id and result.get('status') != 'error':
            try:
                from modules.reporting.report_manager import ReportManager
                
                # Crea un report manager standard
                report_manager = ReportManager()
                
                # Salva il report e associalo al progetto
                report_id = report_manager.save_nmap_report(
                    result, 
                    scan_type, 
                    project_id, 
                    target_id
                )
                
                # Aggiungi l'ID del report al risultato
                result['report_id'] = report_id
                
                # Aggiungi info sull'associazione al progetto
                result['project_association'] = {
                    "status": "success", 
                    "project_id": project_id,
                    "target_id": target_id
                }
                
            except Exception as e:
                logger.error(f"Errore nell'associazione al progetto: {str(e)}")
                result['project_association'] = {
                    "status": "error", 
                    "message": f"Errore nell'associazione al progetto: {str(e)}"
                }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Errore nella scansione nmap: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nella scansione: {str(e)}"
        }), 500

@recon_bp.route('/api/reconnaissance/amass', methods=['POST'])
@require_api_key
def run_amass_scan():
    """Endpoint per avviare una scansione amass."""
    try:
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'Nessun dato fornito'
            }), 400
            
        domain = data.get('domain')
        scan_type = data.get('scan_type', 'passive')  
        timeout = data.get('timeout', 1800)  
        project_id = data.get('project_id')
        target_id = data.get('target_id')
        
        if not domain:
            return jsonify({
                'status': 'error',
                'message': 'Dominio non specificato'
            }), 400
            
        # Esegui la scansione
        result = amass.run_scan(domain, scan_type, timeout)
        
        # Associa al progetto se specificato
        if project_id and result.get('status') != 'error':
            try:
                from modules.reporting.report_manager import ReportManager
                
                # Crea un report manager standard
                report_manager = ReportManager()
                
                # Salva il report e associalo al progetto
                report_id = report_manager.save_amass_report(
                    result, 
                    scan_type, 
                    project_id, 
                    target_id
                )
                
                # Aggiungi l'ID del report al risultato
                result['report_id'] = report_id
                
                # Aggiungi info sull'associazione al progetto
                result['project_association'] = {
                    "status": "success", 
                    "project_id": project_id,
                    "target_id": target_id
                }
                
            except Exception as e:
                logger.error(f"Errore nell'associazione al progetto: {str(e)}")
                result['project_association'] = {
                    "status": "error", 
                    "message": f"Errore nell'associazione al progetto: {str(e)}"
                }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Errore nella scansione amass: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nella scansione: {str(e)}"
        }), 500 
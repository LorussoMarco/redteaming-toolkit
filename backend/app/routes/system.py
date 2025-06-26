import os
import json
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file, Response

from backend.modules.reporting.report_manager import ReportManager
from backend.modules.database.config import SessionLocal
from backend.modules.database.log_repository import LogRepository
from backend.modules.utils.logger import get_module_logger
from backend.modules.config import TIMEZONE

system_bp = Blueprint('system', __name__)
report_manager = ReportManager()
logger = get_module_logger('system')

# Percorso alla directory backend principale
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

@system_bp.route('/api/system/logs', methods=['GET'])
def get_system_logs():
    """Restituisce i log di sistema esclusivamente dal database"""
    try:
        limit = request.args.get('limit', 10, type=int)
        service = request.args.get('service', None)  # Parametro per filtrare per servizio
        
        # Utilizziamo esclusivamente i log dal database
        logs = []
        
        # Recupera i log dal database
        logger.info(f"Recupero log dal database" + (f" per il servizio {service}" if service else ""))
        db_session = SessionLocal()
        try:
            log_repo = LogRepository(db_session)
            
            # Converti il servizio nel nome del logger corrispondente
            logger_name = None
            if service:
                if service.lower() == 'nmap':
                    logger_name = 'nmap_scan'
                elif service.lower() == 'amass':
                    logger_name = 'amass'
                elif service.lower() == 'system':
                    logger_name = 'system'
                elif service.lower() == 'metasploit':
                    logger_name = 'exploitation'
                elif service.lower() == 'gunicorn':
                    logger_name = 'gunicorn%'  # Utilizziamo LIKE per trovare tutti i log di Gunicorn
                elif service.lower() == 'access':
                    logger_name = 'gunicorn.access%'  # Solo i log di accesso
                elif service.lower() == 'error':
                    logger_name = 'gunicorn.error%'  # Solo i log di errore
            
            # Recupera i log dal repository
            db_logs = log_repo.get_logs(
                logger_name=logger_name,
                limit=limit
            )
            
            # Converti i log nel formato richiesto dal frontend
            for log in db_logs:
                # Determina il servizio dal nome del logger
                current_service = "system"
                if log['logger_name'] == 'nmap_scan':
                    current_service = 'nmap'
                elif log['logger_name'] == 'amass':
                    current_service = 'amass'
                elif log['logger_name'] == 'exploitation':
                    current_service = 'metasploit'
                
                # Assicuriamoci che il timestamp sia nel formato corretto
                timestamp_str = log['timestamp']
                try:
                    # Se il timestamp è già in formato ISO, convertiamolo nel formato desiderato
                    datetime_obj = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    timestamp_str = datetime_obj.strftime('%Y-%m-%d %H:%M:%S')
                except (ValueError, AttributeError):
                    # Usa il timestamp così com'è
                    pass
                
                # Crea il log entry nel formato richiesto dal frontend
                log_entry = {
                    'timestamp': timestamp_str,
                    'level': log['level'].lower(),
                    'service': current_service,
                    'message': log['message']
                }
                logs.append(log_entry)
        
        finally:
            db_session.close()
        
        # Debug dei log per diagnostica
        logger.info(f"Recuperati {len(logs)} log" + (f" per il servizio {service}" if service else ""))
                    
        return jsonify({"status": "success", "logs": logs})
    except Exception as e:
        logger.error(f"Errore durante il recupero dei log di sistema: {str(e)}")
        return jsonify({"status": "error", "message": f"Impossibile recuperare i log di sistema: {str(e)}"})

@system_bp.route('/api/activities/recent', methods=['GET'])
def get_recent_activities():
    """Restituisce le attività recenti basate sui report reali"""
    try:
        limit = request.args.get('limit', 5, type=int)
        activities = []
        
        # Ottieni i report Nmap reali
        try:
            nmap_reports = report_manager.get_nmap_reports()
            for report in nmap_reports:
                if 'metadata' in report and 'target' in report['metadata']:
                    activity = {
                        'timestamp': report['metadata'].get('timestamp', ''),
                        'tool': 'nmap',
                        'status': 'completed',
                        'target': report['metadata'].get('target', ''),
                        'description': f"Scansione Nmap tipo {report['metadata'].get('scan_type', '')}",
                        'report_id': os.path.basename(report.get('path', '')) if 'path' in report else None
                    }
                    activities.append(activity)
        except Exception as e:
            logger.error(f"Errore nel recupero dei report Nmap: {str(e)}")
        
        # Ottieni i report Amass reali
        try:
            amass_reports = report_manager.get_amass_reports()
            for report in amass_reports:
                if 'metadata' in report and ('domain' in report['metadata'] or 'target' in report['metadata']):
                    target = report['metadata'].get('target', report['metadata'].get('domain', ''))
                    activity = {
                        'timestamp': report['metadata'].get('timestamp', ''),
                        'tool': 'amass',
                        'status': 'completed',
                        'target': target,
                        'description': f"Scansione Amass tipo {report['metadata'].get('scan_type', '')}",
                        'report_id': str(report.get('id', '')) if 'id' in report else None
                    }
                    activities.append(activity)
        except Exception as e:
            logger.error(f"Errore nel recupero dei report Amass: {str(e)}")
            
        # Ordina per timestamp (più recenti prima) e limita
        activities = sorted(activities, key=lambda x: x.get('timestamp', ''), reverse=True)[:limit]
        
        return jsonify({"status": "success", "activities": activities})
    except Exception as e:
        logger.error(f"Errore durante il recupero delle attività recenti: {str(e)}")
        return jsonify({"status": "error", "message": f"Impossibile recuperare le attività recenti: {str(e)}"})

@system_bp.route('/api/targets/recent', methods=['GET'])
def get_recent_targets():
    """Estrae i target reali dalle scansioni precedenti"""
    try:
        limit = request.args.get('limit', 5, type=int)
        targets = set()
        
        # Estrai target dai report Nmap reali
        try:
            nmap_reports = report_manager.get_nmap_reports()
            for report in nmap_reports:
                if 'metadata' in report and 'target' in report['metadata']:
                    targets.add(report['metadata']['target'])
        except Exception as e:
            logger.error(f"Errore nell'estrazione dei target da report Nmap: {str(e)}")
        
        # Estrai target dai report Amass reali
        try:
            amass_reports = report_manager.get_amass_reports()
            for report in amass_reports:
                if 'metadata' in report:
                    if 'domain' in report['metadata']:
                        targets.add(report['metadata']['domain'])
                    elif 'target' in report['metadata']:
                        targets.add(report['metadata']['target'])
        except Exception as e:
            logger.error(f"Errore nell'estrazione dei target da report Amass: {str(e)}")
        
        # Converti il set in lista, ordina in base alla lunghezza (per leggibilità) e limita
        targets_list = sorted(list(targets), key=len)[:limit]
        
        return jsonify({"status": "success", "targets": targets_list})
    except Exception as e:
        logger.error(f"Errore durante il recupero dei target recenti: {str(e)}")
        return jsonify({"status": "error", "message": f"Impossibile recuperare i target recenti: {str(e)}"})

@system_bp.route('/api/download', methods=['GET'])
def download_file():
    """Download a file from the database"""
    try:
        report_id = request.args.get('id')
        if not report_id:
            return jsonify({
                "status": "error",
                "message": "Report ID is required"
            }), 400
        
        # Get the report from the database
        report = report_manager.load_report_file(report_id)
        
        if not report:
            return jsonify({
                "status": "error",
                "message": "Report not found"
            }), 404
        
        # Convert report to JSON string
        report_json = json.dumps(report, indent=2)
        
        # Generate a filename from metadata
        tool = report.get('metadata', {}).get('tool', 'report')
        target = report.get('metadata', {}).get('target', '') or report.get('metadata', {}).get('domain', 'unknown')
        timestamp = report.get('metadata', {}).get('timestamp', datetime.now().strftime('%Y%m%d_%H%M%S'))
        filename = f"{tool}_{target}_{timestamp}.json"
        
        # Send the report as a file
        return Response(
            report_json,
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error downloading report: {str(e)}"
        }), 500

@system_bp.route('/api/reports/download-pdf', methods=['GET'])
def download_report_as_pdf():
    """Convert a JSON report from database to HTML/PDF and download it"""
    try:
        # Check if pdfkit is available
        pdfkit_available = False
        try:
            import pdfkit
            pdfkit_available = True
        except ImportError:
            logger.warning("pdfkit module not available, falling back to HTML format")
        
        from tempfile import NamedTemporaryFile
        
        report_id = request.args.get('id')
        if not report_id:
            return jsonify({
                "status": "error",
                "message": "Report ID is required"
            }), 400
        
        # Get the report from the database
        report_data = report_manager.load_report_file(report_id)
        
        if not report_data:
            return jsonify({
                "status": "error",
                "message": "Report not found"
            }), 404
        
        # Generate filename from metadata
        tool = report_data.get('metadata', {}).get('tool', 'report')
        target = report_data.get('metadata', {}).get('target', '') or report_data.get('metadata', {}).get('domain', 'unknown')
        timestamp = report_data.get('metadata', {}).get('timestamp', datetime.now(TIMEZONE).strftime('%Y%m%d_%H%M%S'))
        filename = f"{tool}_{target}_{timestamp}"
        
        # Create a temporary HTML file
        with NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8') as html_file:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Report: {filename}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; }}
                    h1 {{ color: #2196f3; }}
                    h2 {{ color: #333; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }}
                    table {{ border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; }}
                    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                    th {{ background-color: #f2f2f2; }}
                    .metadata {{ background-color: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }}
                    pre {{ background-color: #f9f9f9; padding: 10px; border-radius: 5px; overflow-x: auto; }}
                    .port-open {{ color: #4caf50; font-weight: bold; }}
                    .port-closed {{ color: #f44336; }}
                    .report-timestamp {{ color: #666; font-style: italic; margin-bottom: 20px; }}
                </style>
            </head>
            <body>
                <h1>Report: {filename}</h1>
                
                <div class="report-timestamp">
                    Generated: {datetime.now(TIMEZONE).strftime('%Y-%m-%d %H:%M:%S')}
                </div>
                
                <div class="metadata">
                    <h2>Metadata</h2>
            """
            
            # Add metadata
            if 'metadata' in report_data:
                html_content += "<table>"
                for key, value in report_data['metadata'].items():
                    value_str = str(value) if not isinstance(value, dict) else json.dumps(value)
                    html_content += f"<tr><th>{key}</th><td>{value_str}</td></tr>"
                html_content += "</table>"
            
            # Add summary if available
            if 'summary' in report_data:
                html_content += "<h2>Summary</h2>"
                html_content += "<table>"
                for key, value in report_data['summary'].items():
                    value_str = str(value) if not isinstance(value, dict) else json.dumps(value)
                    html_content += f"<tr><th>{key}</th><td>{value_str}</td></tr>"
                html_content += "</table>"
            
            # Handle specific report types
            tool_name = report_data.get('metadata', {}).get('tool', '').lower()
            
            if tool_name == 'amass':
                if 'results' in report_data and report_data['results']:
                    html_content += "<h2>Domain Results</h2>"
                    if isinstance(report_data['results'], list):
                        html_content += "<table>"
                        html_content += "<tr><th>Name</th><th>Domain</th><th>Addresses</th><th>Type</th><th>Sources</th></tr>"
                        for item in report_data['results']:
                            name = item.get('name', '')
                            domain = item.get('domain', '')
                            addresses = ', '.join([a.get('ip', '') for a in item.get('addresses', [])]) if item.get('addresses') else 'N/A'
                            tag = item.get('tag', '')
                            sources = ', '.join(item.get('sources', [])) if item.get('sources') else 'N/A'
                            html_content += f"<tr><td>{name}</td><td>{domain}</td><td>{addresses}</td><td>{tag}</td><td>{sources}</td></tr>"
                        html_content += "</table>"
            elif tool_name == 'nmap':
                if 'ports' in report_data and report_data['ports']:
                    html_content += "<h2>Open Ports</h2>"
                    html_content += "<table>"
                    html_content += "<tr><th>Port</th><th>Protocol</th><th>State</th><th>Service</th><th>Version</th></tr>"
                    for port in report_data.get('ports', []):
                        port_num = port.get('port', '')
                        protocol = port.get('protocol', '')
                        state = port.get('state', '')
                        state_class = 'port-open' if state.lower() == 'open' else 'port-closed'
                        service = port.get('service', '')
                        version = port.get('version', 'N/A')
                        html_content += f"<tr><td>{port_num}</td><td>{protocol}</td><td class='{state_class}'>{state}</td><td>{service}</td><td>{version}</td></tr>"
                    html_content += "</table>"
                
                if 'hostnames' in report_data and report_data['hostnames']:
                    html_content += "<h2>Hostnames</h2>"
                    html_content += "<table>"
                    html_content += "<tr><th>Name</th><th>Type</th></tr>"
                    for hostname in report_data.get('hostnames', []):
                        name = hostname.get('name', '')
                        type_val = hostname.get('type', '')
                        html_content += f"<tr><td>{name}</td><td>{type_val}</td></tr>"
                    html_content += "</table>"
            
            # Add full JSON at the end
            html_content += """
                <h2>Full JSON Data</h2>
                <pre>
            """
            html_content += json.dumps(report_data, indent=2)
            html_content += """
                </pre>
            </body>
            </html>
            """
            
            html_file.write(html_content)
            html_file_path = html_file.name
        
        # If pdfkit is available, try to convert HTML to PDF
        if pdfkit_available:
            try:
                # Generate PDF from HTML
                pdf_file = NamedTemporaryFile(suffix='.pdf', delete=False)
                pdf_file_path = pdf_file.name
                pdf_file.close()
                
                # Try to generate PDF with pdfkit (requires wkhtmltopdf installed)
                pdfkit.from_file(html_file_path, pdf_file_path)
                
                # Clean up the temporary HTML file
                os.unlink(html_file_path)
                
                # Send the PDF file
                return send_file(
                    pdf_file_path,
                    as_attachment=True,
                    download_name=f"{filename}.pdf",
                    mimetype='application/pdf'
                )
            except Exception as pdf_error:
                logger.error(f"PDF generation failed: {str(pdf_error)}")
                pdfkit_available = False
        
        # If pdfkit is not available or PDF generation failed, send HTML
        with open(html_file_path, 'rb') as f:
            html_content = f.read()
        
        # Clean up temporary HTML file
        os.unlink(html_file_path)
        
        # Return HTML response
        response = Response(html_content, mimetype='text/html')
        response.headers['Content-Disposition'] = f'attachment; filename={filename}.html'
        return response
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error generating report: {str(e)}"
        }), 500

@system_bp.route('/api/system/health', methods=['GET'])
def health_check():
    """
    Endpoint per il controllo dello stato dell'applicazione.
    Usato per l'health check del container.
    """
    try:
        # Verifica la connessione al database
        from backend.modules.database.config import engine
        from sqlalchemy import text
        
        with engine.connect() as conn:
            # Esegui una query semplice per verificare la connessione
            conn.execute(text("SELECT 1"))
            
        return jsonify({
            "status": "ok",
            "message": "Il servizio è operativo",
            "database": "connected"
        })
    except Exception as e:
        # Se il database non è disponibile, il servizio è operativo ma con limitazioni
        return jsonify({
            "status": "warning",
            "message": "Il servizio è operativo in modalità limitata",
            "database": "disconnected",
            "error": str(e)
        }), 200  # Restituiamo 200 anche in caso di errore per non far fallire l'health check

# Funzioni per registrare log direttamente nel database
def add_system_log(level, service, message):
    """Registra un log usando il logger esistente"""
    try:
        log_message = f"{service}: {message}"
        if level == 'info':
            logger.info(log_message)
        elif level == 'warning':
            logger.warning(log_message)
        elif level == 'error':
            logger.error(log_message)
        elif level == 'debug':
            logger.debug(log_message)
        return True
    except Exception as e:
        print(f"Errore durante la registrazione del log: {str(e)}")
        return False

def add_activity(tool, status, target, description=None, report_id=None):
    """Registra un'attività nel log di sistema"""
    try:
        activity_message = f"{tool} - {status} - {target}"
        if description:
            activity_message += f" - {description}"
        if report_id:
            activity_message += f" - report: {report_id}"
        
        logger.info(f"ACTIVITY: {activity_message}")
        return True
    except Exception as e:
        print(f"Errore durante la registrazione dell'attività: {str(e)}")
        return False

@system_bp.route('/api/reports/<int:report_id>/delete', methods=['DELETE'])
def delete_report(report_id):
    """Delete a report from the database"""
    try:
        # Get a report repository instance
        repo, session = report_manager._get_db_repository()
        
        try:
            # Call the delete_report method
            success = repo.delete_report(report_id)
            
            if not success:
                return jsonify({
                    "status": "error",
                    "message": f"Report with ID {report_id} not found or could not be deleted"
                }), 404
            
            return jsonify({
                "status": "success",
                "message": f"Report with ID {report_id} deleted successfully"
            })
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Error deleting report: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error deleting report: {str(e)}"
        }), 500 
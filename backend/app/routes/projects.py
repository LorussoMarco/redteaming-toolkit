from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import uuid

from ..utils import require_api_key
from modules.database.project_repository import ProjectRepository
from modules.utils.logger import get_module_logger

logger = get_module_logger('projects_api')
projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/api/projects', methods=['GET'])
@require_api_key
def list_projects():
    """API per ottenere la lista dei progetti."""
    try:
        # Parametri di query opzionali
        status = request.args.get('status')
        phase = request.args.get('phase')
        sort_by = request.args.get('sort_by', 'updated_at')
        sort_order = request.args.get('sort_order', 'desc')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Ottieni i progetti
        projects = repo.list_projects(
            status=status,
            phase=phase,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'status': 'success',
            'count': len(projects),
            'projects': projects
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero dei progetti: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero dei progetti: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['GET'])
@require_api_key
def get_project(project_id):
    """API per ottenere i dettagli di un progetto specifico."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Ottieni il progetto
        project = repo.get_project_by_id(project_id)
        
        if not project:
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Calcola il rischio
        risk_info = repo.calculate_project_risk(project_id)
        
        # Unisci le informazioni
        project.update(risk_info)
        
        return jsonify({
            'status': 'success',
            'project': project
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero del progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero del progetto: {str(e)}"
        }), 500

@projects_bp.route('/api/projects', methods=['POST'])
@require_api_key
def create_project():
    """API per creare un nuovo progetto."""
    try:
        # Ottieni i dati dalla richiesta
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': "Dati mancanti nella richiesta"
            }), 400
        
        # Valida i dati obbligatori
        if 'name' not in data or not data['name']:
            return jsonify({
                'status': 'error',
                'message': "Il nome del progetto è obbligatorio"
            }), 400
        
        # Istanzia il repository senza supporto filesystem
        repo = ProjectRepository(current_app.db_session)
        
        # Crea il progetto
        project_id = repo.create_project(
            name=data['name'],
            description=data.get('description'),
            phase=data.get('phase', 'discovery'),
            status=data.get('status', 'active'),
            notes=data.get('notes')
        )
        
        if not project_id:
            return jsonify({
                'status': 'error',
                'message': "Errore nella creazione del progetto"
            }), 500
        
        # Recupera il progetto appena creato per avere più informazioni
        project = repo.get_project_by_id(project_id)
        
        return jsonify({
            'status': 'success',
            'message': f"Progetto creato con successo",
            'project_id': project_id,
            'project': project
        }), 201
        
    except Exception as e:
        logger.error(f"Errore nella creazione del progetto: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nella creazione del progetto: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['PUT'])
@require_api_key
def update_project(project_id):
    """API per aggiornare un progetto esistente."""
    try:
        # Ottieni i dati dalla richiesta
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': "Dati mancanti nella richiesta"
            }), 400
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        if not repo.get_project_by_id(project_id):
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Aggiorna il progetto
        success = repo.update_project(
            project_id=project_id,
            name=data.get('name'),
            description=data.get('description'),
            phase=data.get('phase'),
            status=data.get('status'),
            notes=data.get('notes')
        )
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'aggiornamento del progetto"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Progetto aggiornato con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'aggiornamento del progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'aggiornamento del progetto: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['DELETE'])
@require_api_key
def delete_project(project_id):
    """API per eliminare un progetto."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        if not repo.get_project_by_id(project_id):
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Elimina il progetto
        success = repo.delete_project(project_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'eliminazione del progetto"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Progetto eliminato con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'eliminazione del progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'eliminazione del progetto: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/targets', methods=['GET'])
@require_api_key
def list_project_targets(project_id):
    """API per ottenere la lista dei target associati a un progetto specifico."""
    try:
        # Parametri di query opzionali
        target_type = request.args.get('type')
        status = request.args.get('status')
        sort_by = request.args.get('sort_by', 'updated_at')
        sort_order = request.args.get('sort_order', 'desc')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        if not repo.get_project_by_id(project_id):
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Ottieni i target del progetto
        targets = repo.list_targets(
            project_id=project_id,
            target_type=target_type,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'status': 'success',
            'count': len(targets),
            'targets': targets
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero dei target per il progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero dei target: {str(e)}"
        }), 500

# --- Gestione Target ---

@projects_bp.route('/api/targets', methods=['GET'])
@require_api_key
def list_targets():
    """API per ottenere la lista dei target."""
    try:
        # Parametri di query opzionali
        project_id = request.args.get('project_id', type=int)
        target_type = request.args.get('target_type')
        status = request.args.get('status')
        risk_min = request.args.get('risk_min', type=float)
        risk_max = request.args.get('risk_max', type=float)
        sort_by = request.args.get('sort_by', 'updated_at')
        sort_order = request.args.get('sort_order', 'desc')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Ottieni i target
        targets = repo.list_targets(
            project_id=project_id,
            target_type=target_type,
            status=status,
            risk_min=risk_min,
            risk_max=risk_max,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'status': 'success',
            'count': len(targets),
            'targets': targets
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero dei target: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero dei target: {str(e)}"
        }), 500

@projects_bp.route('/api/targets/<int:target_id>', methods=['GET'])
@require_api_key
def get_target(target_id):
    """API per ottenere i dettagli di un target specifico."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Ottieni il target
        target = repo.get_target_by_id(target_id)
        
        if not target:
            return jsonify({
                'status': 'error',
                'message': f"Target con ID {target_id} non trovato"
            }), 404
        
        return jsonify({
            'status': 'success',
            'target': target
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero del target {target_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero del target: {str(e)}"
        }), 500

@projects_bp.route('/api/targets', methods=['POST'])
@require_api_key
def create_target():
    """API per creare un nuovo target."""
    try:
        # Ottieni i dati dalla richiesta
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': "Dati mancanti nella richiesta"
            }), 400
        
        # Valida i dati obbligatori
        if 'address' not in data or not data['address']:
            return jsonify({
                'status': 'error',
                'message': "L'indirizzo del target è obbligatorio"
            }), 400
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Crea il target
        target_id = repo.create_target(
            address=data['address'],
            name=data.get('name'),
            target_type=data.get('target_type', 'host'),
            status=data.get('status', 'pending'),
            notes=data.get('notes'),
            metadata=data.get('metadata')
        )
        
        if not target_id:
            return jsonify({
                'status': 'error',
                'message': "Errore nella creazione del target"
            }), 500
        
        # Se specificato, aggiungi il target al progetto
        if 'project_id' in data and data['project_id']:
            repo.add_target_to_project(data['project_id'], target_id)
        
        return jsonify({
            'status': 'success',
            'message': f"Target creato con successo",
            'target_id': target_id
        }), 201
        
    except Exception as e:
        logger.error(f"Errore nella creazione del target: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nella creazione del target: {str(e)}"
        }), 500

@projects_bp.route('/api/targets/<int:target_id>', methods=['PUT'])
@require_api_key
def update_target(target_id):
    """API per aggiornare un target esistente."""
    try:
        # Ottieni i dati dalla richiesta
        data = request.json
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': "Dati mancanti nella richiesta"
            }), 400
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il target esista
        if not repo.get_target_by_id(target_id):
            return jsonify({
                'status': 'error',
                'message': f"Target con ID {target_id} non trovato"
            }), 404
        
        # Aggiorna il target
        success = repo.update_target(
            target_id=target_id,
            address=data.get('address'),
            name=data.get('name'),
            target_type=data.get('target_type'),
            status=data.get('status'),
            risk_level=data.get('risk_level'),
            notes=data.get('notes'),
            metadata=data.get('metadata')
        )
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'aggiornamento del target"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Target aggiornato con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'aggiornamento del target {target_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'aggiornamento del target: {str(e)}"
        }), 500

@projects_bp.route('/api/targets/<int:target_id>', methods=['DELETE'])
@require_api_key
def delete_target(target_id):
    """API per eliminare un target."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il target esista
        if not repo.get_target_by_id(target_id):
            return jsonify({
                'status': 'error',
                'message': f"Target con ID {target_id} non trovato"
            }), 404
        
        # Elimina il target
        success = repo.delete_target(target_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'eliminazione del target"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Target eliminato con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'eliminazione del target {target_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'eliminazione del target: {str(e)}"
        }), 500

# --- Gestione Relazioni Progetto-Target ---

@projects_bp.route('/api/projects/<int:project_id>/targets/<int:target_id>', methods=['POST'])
@require_api_key
def add_target_to_project(project_id, target_id):
    """API per aggiungere un target a un progetto."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Aggiungi il target al progetto
        success = repo.add_target_to_project(project_id, target_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'aggiunta del target al progetto"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Target aggiunto al progetto con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'aggiunta del target {target_id} al progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'aggiunta del target al progetto: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/targets/<int:target_id>', methods=['DELETE'])
@require_api_key
def remove_target_from_project(project_id, target_id):
    """API per rimuovere un target da un progetto."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Rimuovi il target dal progetto
        success = repo.remove_target_from_project(project_id, target_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nella rimozione del target dal progetto"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Target rimosso dal progetto con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nella rimozione del target {target_id} dal progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nella rimozione del target dal progetto: {str(e)}"
        }), 500

# --- Gestione Report nei Progetti ---

@projects_bp.route('/api/projects/<int:project_id>/reports', methods=['GET'])
@require_api_key
def list_project_reports(project_id):
    """API per ottenere la lista dei report di un progetto."""
    try:
        # Parametri di query opzionali
        tool = request.args.get('tool')
        target_id = request.args.get('target_id', type=int)
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        if not repo.get_project_by_id(project_id):
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Ottieni i report
        reports = repo.list_project_reports(
            project_id=project_id,
            tool=tool,
            target_id=target_id,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'status': 'success',
            'count': len(reports),
            'reports': reports
        })
        
    except Exception as e:
        logger.error(f"Errore nel recupero dei report per il progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel recupero dei report: {str(e)}"
        }), 500

@projects_bp.route('/api/reports/<int:report_id>/project/<int:project_id>', methods=['POST'])
@require_api_key
def assign_report_to_project(report_id, project_id):
    """API per assegnare un report a un progetto."""
    try:
        # Parametri di query opzionali
        target_id = request.args.get('target_id', type=int)
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Assegna il report al progetto
        success = repo.assign_report_to_project(report_id, project_id, target_id)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': "Errore nell'assegnazione del report al progetto"
            }), 500
        
        return jsonify({
            'status': 'success',
            'message': f"Report assegnato al progetto con successo"
        })
        
    except Exception as e:
        logger.error(f"Errore nell'assegnazione del report {report_id} al progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nell'assegnazione del report: {str(e)}"
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/risk', methods=['GET'])
@require_api_key
def get_project_risk(project_id):
    """API per ottenere le informazioni di rischio di un progetto."""
    try:
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        if not repo.get_project_by_id(project_id):
            return jsonify({
                'status': 'error',
                'message': f"Progetto con ID {project_id} non trovato"
            }), 404
        
        # Calcola il rischio
        risk_info = repo.calculate_project_risk(project_id)
        
        return jsonify({
            'status': 'success',
            'project_id': project_id,
            'risk': risk_info
        })
        
    except Exception as e:
        logger.error(f"Errore nel calcolo del rischio per il progetto {project_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Errore nel calcolo del rischio: {str(e)}"
        }), 500

def associate_report_with_project(report_path, tool_type, project_id, target_address=None):
    """
    Associate a report with a project. This function is called when a scan is completed
    from reconnaissance.py.
    
    Args:
        report_path (str): Path to the report file
        tool_type (str): Tool type ('nmap' or 'amass')
        project_id (int or str): Project ID to associate the report with
        target_address (str, optional): Target address to find a matching target
        
    Returns:
        dict: Status and message about the association
    """
    try:
        if not report_path or not tool_type or not project_id:
            logger.error("Missing required parameters to associate report with project")
            return {
                "status": "error",
                "message": "Missing required parameters"
            }
            
        # Convert project_id to integer if it's not
        try:
            project_id = int(project_id)
        except (ValueError, TypeError):
            logger.error(f"Invalid project ID: {project_id}")
            return {
                "status": "error",
                "message": f"Invalid project ID: {project_id}"
            }
        
        # Istanzia il repository
        repo = ProjectRepository(current_app.db_session)
        
        # Verifica che il progetto esista
        project = repo.get_project_by_id(project_id)
        if not project:
            logger.error(f"Project with ID {project_id} not found")
            return {
                "status": "error",
                "message": f"Project with ID {project_id} not found"
            }
            
        # Find the report in the database or register it
        # Import here to avoid circular imports
        from backend.modules.reporting.report_manager import ReportManager
        
        report_manager = ReportManager()
        report_id = None
        
        # Try to find the report ID from the file path
        if tool_type == 'nmap':
            reports = report_manager.get_nmap_reports()
            for report in reports:
                if report.get('path') == report_path:
                    report_id = report.get('id')
                    break
        elif tool_type == 'amass':
            reports = report_manager.list_reports('amass')
            for report in reports:
                if report.get('path') == report_path:
                    report_id = report.get('id')
                    break
                    
        if not report_id:
            logger.error(f"Report with path {report_path} not found in database")
            return {
                "status": "error",
                "message": f"Report not found in database"
            }
            
        # Find target ID if target_address is provided
        target_id = None
        if target_address:
            targets = repo.list_project_targets(project_id)
            for target in targets:
                if target.get('address') == target_address:
                    target_id = target.get('id')
                    break
                    
        # Assign the report to the project
        success = repo.assign_report_to_project(report_id, project_id, target_id)
        
        if success:
            logger.info(f"Report {report_id} assigned to project {project_id} and target {target_id}")
            return {
                "status": "success",
                "message": "Report assigned to project successfully",
                "report_id": report_id,
                "project_id": project_id,
                "target_id": target_id
            }
        else:
            logger.error(f"Failed to assign report {report_id} to project {project_id}")
            return {
                "status": "error",
                "message": "Failed to assign report to project"
            }
    except Exception as e:
        logger.error(f"Error associating report with project: {str(e)}")
        return {
            "status": "error",
            "message": f"Error: {str(e)}"
        } 
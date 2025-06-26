from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, and_, or_

from .models import Project, Target, ScanReport
from ..utils.logger import get_module_logger
from ..utils.project_filesystem import ProjectFilesystem
from ..config import TIMEZONE
import os

logger = get_module_logger('project_repository')

class ProjectRepository:
    """
    Repository per la gestione dei progetti nel database.
    """
    
    def __init__(self, db: Session, project_fs: Optional[ProjectFilesystem] = None):
        """
        Inizializza il repository
        
        Args:
            db: Sessione del database
            project_fs: Istanza del gestore del filesystem dei progetti (opzionale)
        """
        self.db = db
        self.project_fs = project_fs
        logger.info("ProjectRepository inizializzato")
    
    # --- Gestione Progetti ---
    
    def create_project(self, name: str, description: str = None, phase: str = "discovery", 
                      status: str = "active", notes: str = None) -> Optional[int]:
        """
        Crea un nuovo progetto
        
        Args:
            name: Nome del progetto
            description: Descrizione del progetto
            phase: Fase del progetto (discovery, assessment, tracking)
            status: Stato del progetto (active, archived, completed)
            notes: Note aggiuntive
            
        Returns:
            int: ID del progetto creato o None in caso di errore
        """
        try:
            project = Project(
                name=name,
                description=description,
                phase=phase,
                status=status,
                notes=notes,
                created_at=datetime.now(TIMEZONE),
                updated_at=datetime.now(TIMEZONE)
            )
            
            self.db.add(project)
            self.db.commit()
            self.db.refresh(project)
            
            # Se è disponibile il gestore del filesystem, crea la directory del progetto
            if self.project_fs:
                project_path = self.project_fs.create_project_directory(name)
                project.fs_path = project_path
                self.db.commit()
                logger.info(f"Creata directory per il progetto '{name}': {project_path}")
            
            logger.info(f"Progetto '{name}' creato con ID: {project.id}")
            return project.id
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nella creazione del progetto '{name}': {str(e)}")
            return None
    
    def update_project(self, project_id: int, name: str = None, description: str = None, 
                      phase: str = None, status: str = None, notes: str = None) -> bool:
        """
        Aggiorna un progetto esistente
        
        Args:
            project_id: ID del progetto da aggiornare
            name: Nuovo nome del progetto
            description: Nuova descrizione del progetto
            phase: Nuova fase del progetto
            status: Nuovo stato del progetto
            notes: Nuove note
            
        Returns:
            bool: True se l'aggiornamento è riuscito, False altrimenti
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato per l'aggiornamento")
                return False
            
            if name is not None:
                project.name = name
                
            if description is not None:
                project.description = description
                
            if phase is not None:
                project.phase = phase
                
            if status is not None:
                project.status = status
                
            if notes is not None:
                project.notes = notes
                
            project.updated_at = datetime.now(TIMEZONE)
            
            self.db.commit()
            
            logger.info(f"Progetto con ID {project_id} aggiornato con successo")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'aggiornamento del progetto {project_id}: {str(e)}")
            return False
    
    def delete_project(self, project_id: int) -> bool:
        """
        Elimina un progetto
        
        Args:
            project_id: ID del progetto da eliminare
            
        Returns:
            bool: True se l'eliminazione è riuscita, False altrimenti
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato per l'eliminazione")
                return False
            
            # Rimuove le associazioni con i target senza eliminare i target stessi
            project.targets = []
            
            # Disassocia i report da questo progetto senza eliminarli
            reports = self.db.query(ScanReport).filter(ScanReport.project_id == project_id).all()
            for report in reports:
                report.project_id = None
            
            # Se è disponibile il filesystem del progetto, salvare il percorso della directory prima dell'eliminazione
            fs_path = project.fs_path
            
            # Elimina il progetto
            self.db.delete(project)
            self.db.commit()
            
            # Se la directory del progetto esiste, prova a eliminarla
            if fs_path and os.path.exists(fs_path) and self.project_fs:
                try:
                    import shutil
                    shutil.rmtree(fs_path)
                    logger.info(f"Directory del progetto eliminata: {fs_path}")
                except Exception as e:
                    logger.warning(f"Impossibile eliminare la directory del progetto {fs_path}: {str(e)}")
            
            logger.info(f"Progetto con ID {project_id} eliminato con successo")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'eliminazione del progetto {project_id}: {str(e)}")
            return False
    
    def get_project_by_id(self, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Recupera un progetto dal database
        
        Args:
            project_id: ID del progetto
            
        Returns:
            Dict o None: Il progetto o None se non trovato
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return None
                
            return project.to_dict()
            
        except Exception as e:
            logger.error(f"Errore nel recupero del progetto {project_id}: {str(e)}")
            return None
    
    def list_projects(self, status: str = None, phase: str = None, 
                    sort_by: str = "updated_at", sort_order: str = "desc", 
                    limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Lista tutti i progetti disponibili, opzionalmente filtrati
        
        Args:
            status: Filtra per stato del progetto
            phase: Filtra per fase del progetto
            sort_by: Campo per ordinamento
            sort_order: Direzione dell'ordinamento (asc/desc)
            limit: Numero massimo di progetti da restituire
            offset: Offset per la paginazione
            
        Returns:
            Lista di dizionari con i progetti
        """
        try:
            # Query base
            query = self.db.query(Project)
            
            # Applica filtri se specificati
            if status:
                query = query.filter(Project.status == status)
                
            if phase:
                query = query.filter(Project.phase == phase)
                
            # Applica ordinamento
            sort_column = getattr(Project, sort_by, Project.updated_at)
            if sort_order.lower() == "asc":
                query = query.order_by(asc(sort_column))
            else:
                query = query.order_by(desc(sort_column))
                
            # Applica paginazione
            query = query.offset(offset).limit(limit)
            
            # Converti in dizionari
            projects = [project.to_dict() for project in query.all()]
            
            logger.info(f"Recuperati {len(projects)} progetti")
            return projects
            
        except Exception as e:
            logger.error(f"Errore nel recupero dei progetti: {str(e)}")
            return []
    
    # --- Gestione Target ---
    
    def create_target(self, address: str, name: str = None, target_type: str = "host", 
                    status: str = "pending", notes: str = None, metadata: Dict = None) -> Optional[int]:
        """
        Crea un nuovo target
        
        Args:
            address: Indirizzo del target (IP, hostname o subnet)
            name: Nome descrittivo del target
            target_type: Tipo di target (host, subnet, domain)
            status: Stato del target (pending, scanning, scanned)
            notes: Note aggiuntive
            metadata: Metadati aggiuntivi
            
        Returns:
            int: ID del target creato o None in caso di errore
        """
        try:
            target = Target(
                name=name if name else address,
                address=address,
                target_type=target_type,
                status=status,
                notes=notes,
                created_at=datetime.now(TIMEZONE),
                updated_at=datetime.now(TIMEZONE)
            )
            
            if metadata:
                target.set_metadata(metadata)
            
            self.db.add(target)
            self.db.commit()
            self.db.refresh(target)
            
            logger.info(f"Target '{address}' creato con ID: {target.id}")
            return target.id
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nella creazione del target '{address}': {str(e)}")
            return None
    
    def update_target(self, target_id: int, address: str = None, name: str = None, 
                    target_type: str = None, status: str = None, risk_level: float = None, 
                    notes: str = None, metadata: Dict = None) -> bool:
        """
        Aggiorna un target esistente
        
        Args:
            target_id: ID del target da aggiornare
            address: Nuovo indirizzo del target
            name: Nuovo nome del target
            target_type: Nuovo tipo di target
            status: Nuovo stato del target
            risk_level: Nuovo livello di rischio
            notes: Nuove note
            metadata: Nuovi metadati
            
        Returns:
            bool: True se l'aggiornamento è riuscito, False altrimenti
        """
        try:
            target = self.db.query(Target).filter(Target.id == target_id).first()
            
            if not target:
                logger.warning(f"Target con ID {target_id} non trovato per l'aggiornamento")
                return False
            
            if address is not None:
                target.address = address
                
            if name is not None:
                target.name = name
                
            if target_type is not None:
                target.target_type = target_type
                
            if status is not None:
                target.status = status
                
            if risk_level is not None:
                target.risk_level = risk_level
                
            if notes is not None:
                target.notes = notes
                
            if metadata is not None:
                target.set_metadata(metadata)
                
            target.updated_at = datetime.now(TIMEZONE)
            
            self.db.commit()
            
            logger.info(f"Target con ID {target_id} aggiornato con successo")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'aggiornamento del target {target_id}: {str(e)}")
            return False
    
    def delete_target(self, target_id: int) -> bool:
        """
        Elimina un target
        
        Args:
            target_id: ID del target da eliminare
            
        Returns:
            bool: True se l'eliminazione è riuscita, False altrimenti
        """
        try:
            target = self.db.query(Target).filter(Target.id == target_id).first()
            
            if not target:
                logger.warning(f"Target con ID {target_id} non trovato per l'eliminazione")
                return False
            
            # Rimuovere le associazioni con i progetti senza eliminare i progetti
            target.projects = []
            
            # Disassocia i report da questo target senza eliminarli
            reports = self.db.query(ScanReport).filter(ScanReport.target_id == target_id).all()
            for report in reports:
                report.target_id = None
            
            # Elimina il target
            self.db.delete(target)
            self.db.commit()
            
            logger.info(f"Target con ID {target_id} eliminato con successo")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'eliminazione del target {target_id}: {str(e)}")
            return False
    
    def get_target_by_id(self, target_id: int) -> Optional[Dict[str, Any]]:
        """
        Recupera un target dal database
        
        Args:
            target_id: ID del target
            
        Returns:
            Dict o None: Il target o None se non trovato
        """
        try:
            target = self.db.query(Target).filter(Target.id == target_id).first()
            
            if not target:
                logger.warning(f"Target con ID {target_id} non trovato")
                return None
                
            return target.to_dict()
            
        except Exception as e:
            logger.error(f"Errore nel recupero del target {target_id}: {str(e)}")
            return None
    
    def list_targets(self, project_id: int = None, target_type: str = None, status: str = None, 
                    risk_min: float = None, risk_max: float = None, 
                    sort_by: str = "updated_at", sort_order: str = "desc", 
                    limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Lista tutti i target disponibili, opzionalmente filtrati
        
        Args:
            project_id: Filtra per progetto
            target_type: Filtra per tipo di target
            status: Filtra per stato del target
            risk_min: Filtra per rischio minimo
            risk_max: Filtra per rischio massimo
            sort_by: Campo per ordinamento
            sort_order: Direzione dell'ordinamento (asc/desc)
            limit: Numero massimo di target da restituire
            offset: Offset per la paginazione
            
        Returns:
            Lista di dizionari con i target
        """
        try:
            # Query base
            query = self.db.query(Target)
            
            # Applica filtri se specificati
            if project_id is not None:
                project = self.db.query(Project).filter(Project.id == project_id).first()
                if project:
                    query = query.filter(Target.projects.contains(project))
                else:
                    logger.warning(f"Progetto con ID {project_id} non trovato per filtrare i target")
                    return []
                
            if target_type:
                query = query.filter(Target.target_type == target_type)
                
            if status:
                query = query.filter(Target.status == status)
                
            if risk_min is not None:
                query = query.filter(Target.risk_level >= risk_min)
                
            if risk_max is not None:
                query = query.filter(Target.risk_level <= risk_max)
                
            # Applica ordinamento
            sort_column = getattr(Target, sort_by, Target.updated_at)
            if sort_order.lower() == "asc":
                query = query.order_by(asc(sort_column))
            else:
                query = query.order_by(desc(sort_column))
                
            # Applica paginazione
            query = query.offset(offset).limit(limit)
            
            # Converti in dizionari
            targets = [target.to_dict() for target in query.all()]
            
            logger.info(f"Recuperati {len(targets)} target" + (f" per il progetto {project_id}" if project_id else ""))
            return targets
            
        except Exception as e:
            logger.error(f"Errore nel recupero dei target: {str(e)}")
            return []
    
    # --- Associazioni tra Progetti e Target ---
    
    def add_target_to_project(self, project_id: int, target_id: int) -> bool:
        """
        Aggiunge un target a un progetto
        
        Args:
            project_id: ID del progetto
            target_id: ID del target
            
        Returns:
            bool: True se l'operazione è riuscita, False altrimenti
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            target = self.db.query(Target).filter(Target.id == target_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return False
                
            if not target:
                logger.warning(f"Target con ID {target_id} non trovato")
                return False
                
            # Verifica se il target è già presente nel progetto
            if target in project.targets:
                logger.info(f"Target {target_id} già presente nel progetto {project_id}")
                return True
                
            # Aggiunge il target al progetto
            project.targets.append(target)
            project.updated_at = datetime.now(TIMEZONE)
            self.db.commit()
            
            logger.info(f"Target {target_id} aggiunto al progetto {project_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'aggiunta del target {target_id} al progetto {project_id}: {str(e)}")
            return False
    
    def remove_target_from_project(self, project_id: int, target_id: int) -> bool:
        """
        Rimuove un target da un progetto
        
        Args:
            project_id: ID del progetto
            target_id: ID del target
            
        Returns:
            bool: True se l'operazione è riuscita, False altrimenti
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            target = self.db.query(Target).filter(Target.id == target_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return False
                
            if not target:
                logger.warning(f"Target con ID {target_id} non trovato")
                return False
                
            # Verifica se il target è presente nel progetto
            if target not in project.targets:
                logger.info(f"Target {target_id} non presente nel progetto {project_id}")
                return True
                
            # Rimuove il target dal progetto
            project.targets.remove(target)
            project.updated_at = datetime.now(TIMEZONE)
            self.db.commit()
            
            logger.info(f"Target {target_id} rimosso dal progetto {project_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nella rimozione del target {target_id} dal progetto {project_id}: {str(e)}")
            return False
    
    # --- Gestione Report in Progetti ---
    
    def assign_report_to_project(self, report_id: int, project_id: int, target_id: int = None) -> bool:
        """
        Assegna un report a un progetto (e opzionalmente a un target)
        
        Args:
            report_id: ID del report
            project_id: ID del progetto
            target_id: ID del target (opzionale)
            
        Returns:
            bool: True se l'operazione è riuscita, False altrimenti
        """
        try:
            report = self.db.query(ScanReport).filter(ScanReport.id == report_id).first()
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not report:
                logger.warning(f"Report con ID {report_id} non trovato")
                return False
                
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return False
            
            # Assegna il report al progetto
            report.project_id = project_id
            
            # Assegna il report al target se specificato
            if target_id is not None:
                target = self.db.query(Target).filter(Target.id == target_id).first()
                if target:
                    report.target_id = target_id
                    
                    # Verifica che il target sia associato al progetto
                    if target not in project.targets:
                        project.targets.append(target)
                        logger.info(f"Target {target_id} aggiunto automaticamente al progetto {project_id}")
                else:
                    logger.warning(f"Target con ID {target_id} non trovato")
            
            # Aggiorna il timestamp del progetto
            project.updated_at = datetime.now(TIMEZONE)
            
            self.db.commit()
            
            logger.info(f"Report {report_id} assegnato al progetto {project_id}" + 
                       (f" e al target {target_id}" if target_id else ""))
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Errore nell'assegnazione del report {report_id} al progetto {project_id}: {str(e)}")
            return False
    
    def list_project_reports(self, project_id: int, tool: str = None, target_id: int = None, 
                           limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Lista tutti i report di un progetto, opzionalmente filtrati
        
        Args:
            project_id: ID del progetto
            tool: Filtra per tool (amass, nmap, ecc.)
            target_id: Filtra per target specifico
            limit: Numero massimo di report da restituire
            offset: Offset per la paginazione
            
        Returns:
            Lista di dizionari con i report
        """
        try:
            # Verifica che il progetto esista
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return []
                
            # Query base
            query = self.db.query(ScanReport).filter(ScanReport.project_id == project_id)
            
            # Applica filtri se specificati
            if tool:
                query = query.filter(ScanReport.tool == tool)
                
            if target_id is not None:
                query = query.filter(ScanReport.target_id == target_id)
                
            # Ordina per data decrescente (più recenti prima)
            query = query.order_by(desc(ScanReport.timestamp))
            
            # Applica paginazione
            query = query.offset(offset).limit(limit)
            
            # Converti in dizionari
            reports = [report.to_dict() for report in query.all()]
            
            logger.info(f"Recuperati {len(reports)} report per il progetto {project_id}")
            return reports
            
        except Exception as e:
            logger.error(f"Errore nel recupero dei report per il progetto {project_id}: {str(e)}")
            return []
    
    def calculate_project_risk(self, project_id: int) -> Dict[str, Any]:
        """
        Calcola il rischio complessivo di un progetto in base ai target
        
        Args:
            project_id: ID del progetto
            
        Returns:
            Dizionario con informazioni sul rischio
        """
        try:
            project = self.db.query(Project).filter(Project.id == project_id).first()
            
            if not project:
                logger.warning(f"Progetto con ID {project_id} non trovato")
                return {
                    "error": "Progetto non trovato",
                    "avg_risk": 0,
                    "max_risk": 0,
                    "targets_count": 0,
                    "high_risk_targets": 0
                }
            
            # Calcola le statistiche di rischio per i target associati
            targets = project.targets
            
            if not targets:
                return {
                    "avg_risk": 0,
                    "max_risk": 0,
                    "targets_count": 0,
                    "high_risk_targets": 0
                }
            
            risk_levels = [t.risk_level for t in targets]
            avg_risk = sum(risk_levels) / len(risk_levels)
            max_risk = max(risk_levels)
            high_risk_targets = sum(1 for r in risk_levels if r >= 7.0)  # Considera alto rischio >= 7.0
            
            result = {
                "avg_risk": round(avg_risk, 2),
                "max_risk": max_risk,
                "targets_count": len(targets),
                "high_risk_targets": high_risk_targets
            }
            
            logger.info(f"Calcolato rischio per il progetto {project_id}: media={result['avg_risk']}, max={result['max_risk']}")
            return result
            
        except Exception as e:
            logger.error(f"Errore nel calcolo del rischio per il progetto {project_id}: {str(e)}")
            return {
                "error": str(e),
                "avg_risk": 0,
                "max_risk": 0,
                "targets_count": 0,
                "high_risk_targets": 0
            } 
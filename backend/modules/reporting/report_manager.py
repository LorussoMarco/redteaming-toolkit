from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from ..utils.logger import get_module_logger
from ..database.config import SessionLocal
from ..database.report_repository import ReportRepository

logger = get_module_logger('report_manager')

class ReportManager:
    """Gestisce la creazione e il salvataggio dei report nel database"""
    
    def __init__(self):
        """
        Inizializza il manager dei report
        """
        logger.info("ReportManager inizializzato")
    
    def _get_db_repository(self) -> Tuple[ReportRepository, Any]:
        """
        Ottiene un'istanza del repository per i report
        
        Returns:
            Tuple[ReportRepository, Session]: Repository e sessione del database
        """
        session = SessionLocal()
        repo = ReportRepository(session)
        return repo, session
    
    def save_nmap_report(self, scan_results: Dict[str, Any], scan_type: str, 
                       project_id: Optional[int] = None, target_id: Optional[int] = None) -> str:
        """
        Salva un report di scansione nmap nel database
        
        Args:
            scan_results: Risultati della scansione
            scan_type: Tipo di scansione eseguita
            project_id: ID del progetto associato (opzionale)
            target_id: ID del target associato (opzionale)
        
        Returns:
            str: ID del report nel database
        """
        try:
            repo, session = self._get_db_repository()
            try:
                report_id = repo.save_nmap_report(scan_results, scan_type, project_id, target_id)
                logger.info(f"Saved nmap report to database with ID: {report_id}")
                return str(report_id)  # Restituisci l'ID come stringa per compatibilità
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error saving nmap report: {str(e)}")
            raise
    
    def save_amass_report(self, scan_results: Dict[str, Any], scan_type: str, 
                        project_id: Optional[int] = None, target_id: Optional[int] = None) -> str:
        """
        Salva un report di scansione amass nel database
        
        Args:
            scan_results: Risultati della scansione
            scan_type: Tipo di scansione eseguita (passive, active, intel)
            project_id: ID del progetto associato (opzionale)
            target_id: ID del target associato (opzionale)
        
        Returns:
            str: ID del report nel database
        """
        try:
            repo, session = self._get_db_repository()
            try:
                report_id = repo.save_amass_report(scan_results, scan_type, project_id, target_id)
                logger.info(f"Saved amass report to database with ID: {report_id}")
                return str(report_id)  # Restituisci l'ID come stringa per compatibilità
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error saving amass report: {str(e)}")
            raise
    
    def update_report(self, report_id: str, updated_data: Dict[str, Any]) -> bool:
        """
        Aggiorna un report esistente nel database
        
        Args:
            report_id: ID del report da aggiornare
            updated_data: Dati aggiornati del report
            
        Returns:
            bool: True se l'aggiornamento è riuscito, False altrimenti
        """
        try:
            repo, session = self._get_db_repository()
            try:
                # Verifica che il report esista
                report = repo.get_report_by_id(int(report_id))
                if not report:
                    logger.warning(f"Cannot update report with ID {report_id}: Report not found")
                    return False
                
                # Aggiorna il report
                updated = repo.update_report_data(int(report_id), updated_data)
                
                if updated:
                    logger.info(f"Successfully updated report with ID {report_id}")
                    return True
                else:
                    logger.warning(f"Failed to update report with ID {report_id}")
                    return False
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error updating report {report_id}: {str(e)}")
            return False
    
    def get_report_summary(self, report_id: str) -> Dict[str, Any]:
        """
        Recupera un riepilogo di un report esistente dal database
        
        Args:
            report_id: ID del report nel database
        
        Returns:
            Dict contenente il riepilogo del report
        """
        try:
            repo, session = self._get_db_repository()
            try:
                report = repo.get_report_by_id(int(report_id))
                if not report:
                    logger.warning(f"Report with ID {report_id} not found")
                    return {}
                
                return {
                    'metadata': report.get('metadata', {}),
                    'summary': report.get('summary', {})
                }
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error reading report summary: {str(e)}")
            raise
    
    def list_reports(self, tool: str = None) -> List[Dict[str, Any]]:
        """
        Lista tutti i report disponibili dal database, opzionalmente filtrati per tool
        
        Args:
            tool: Nome del tool per filtrare i report
        
        Returns:
            Lista di dizionari contenenti informazioni sui report
        """
        try:
            repo, session = self._get_db_repository()
            try:
                return repo.list_reports(tool)
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error listing reports: {str(e)}")
            raise
    
    def load_report_file(self, report_id: str) -> Dict[str, Any]:
        """
        Carica un report completo dal database.
        
        Args:
            report_id (str): ID numerico o percorso del report.
            
        Returns:
            dict: Il report completo caricato o None in caso di errore.
        """
        try:
            repo, session = self._get_db_repository()
            try:
                # Determina se l'identificatore è un ID numerico o un percorso
                report = None
                if report_id and report_id.isdigit():
                    # Se è un numero, carica per ID
                    report = repo.get_report_by_id(int(report_id))
                else:
                    # Altrimenti, tenta di caricare per path
                    logger.info(f"Attempting to load report using path: {report_id}")
                    # Qui il path è in realtà l'ID del report, estraiamo il numero se possibile
                    try:
                        # Estrae il numero dal percorso (es. "reports/amass/42" -> "42")
                        path_parts = report_id.split('/')
                        if path_parts:
                            potential_id = path_parts[-1]
                            if potential_id.isdigit():
                                report = repo.get_report_by_id(int(potential_id))
                    except:
                        pass
                    
                    # Se non abbiamo ancora trovato il report, proviamo a cercarlo per path esatto
                    if not report:
                        # Implementare la logica per caricare il report per path se necessario
                        # Per ora trattiamo il path come un ID
                        try:
                            last_part = report_id.split('/')[-1]
                            if last_part.isdigit():
                                report = repo.get_report_by_id(int(last_part))
                        except Exception as e:
                            logger.error(f"Failed to parse path {report_id}: {str(e)}")
                
                if not report:
                    logger.warning(f"Report with identifier {report_id} not found")
                    return None
                
                logger.info(f"Successfully loaded report with identifier {report_id}")
                return report
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Error loading report {report_id}: {str(e)}")
            return None
    
    def load_nmap_report_file(self, report_id: str) -> Dict[str, Any]:
        """
        Carica un report Nmap completo dal database.
        
        Args:
            report_id (str): ID del report nel database.
            
        Returns:
            dict: Il report Nmap completo caricato o None in caso di errore.
        """
        return self.load_report_file(report_id)
    
    def get_nmap_reports(self) -> List[Dict[str, Any]]:
        """
        Recupera tutti i report delle scansioni Nmap dal database.
        
        Returns:
            List[Dict[str, Any]]: Lista di report Nmap con i loro metadati.
        """
        try:
            repo, session = self._get_db_repository()
            try:
                return repo.get_nmap_reports()
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Errore nel recupero dei report Nmap: {str(e)}")
            return []
            
    def get_amass_reports(self) -> List[Dict[str, Any]]:
        """
        Recupera tutti i report delle scansioni Amass dal database.
        
        Returns:
            List[Dict[str, Any]]: Lista di report Amass con i loro metadati.
        """
        try:
            repo, session = self._get_db_repository()
            try:
                return repo.get_amass_reports()
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Errore nel recupero dei report Amass: {str(e)}")
            return [] 
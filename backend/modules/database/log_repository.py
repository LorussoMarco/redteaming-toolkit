"""
Repository per la gestione dei log nel database.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .models import SystemLog
from ..config import TIMEZONE

# Utilizziamo stampe dirette per evitare di creare cicli di log
def db_debug(message):
    print(f"[LOG_REPO] {message}")

class LogRepository:
    """
    Repository per la gestione dei log nel database.
    """
    
    def __init__(self, db: Session):
        """
        Inizializza il repository
        
        Args:
            db: Sessione del database
        """
        self.db = db
        db_debug("LogRepository inizializzato")
    
    def save_log(self, logger_name: str, level: str, message: str, details: Optional[Dict[str, Any]] = None) -> int:
        """
        Salva un log nel database
        
        Args:
            logger_name: Nome del logger
            level: Livello del log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            message: Messaggio del log
            details: Dizionario con dettagli aggiuntivi (opzionale)
            
        Returns:
            int: ID del log salvato
        """
        try:
            # Crea un nuovo log con timestamp nel timezone configurato
            log_entry = SystemLog(
                logger_name=logger_name,
                level=level,
                message=message,
                timestamp=datetime.now(TIMEZONE)
            )
            
            if details:
                log_entry.set_details(details)
            
            # Salva nel database
            self.db.add(log_entry)
            self.db.commit()
            self.db.refresh(log_entry)
            
            return log_entry.id
            
        except Exception as e:
            self.db.rollback()
            # Non logghiamo qui per evitare ricorsione
            db_debug(f"Errore nel salvataggio del log: {str(e)}")
            return -1
    
    def get_logs(self, 
                logger_name: Optional[str] = None, 
                level: Optional[str] = None, 
                start_time: Optional[datetime] = None,
                end_time: Optional[datetime] = None,
                limit: int = 100) -> List[Dict[str, Any]]:
        """
        Recupera i log dal database
        
        Args:
            logger_name: Filtro per nome del logger (opzionale)
            level: Filtro per livello di log (opzionale)
            start_time: Timestamp di inizio (opzionale)
            end_time: Timestamp di fine (opzionale)
            limit: Numero massimo di log da restituire
            
        Returns:
            List[Dict[str, Any]]: Lista di log
        """
        try:
            query = self.db.query(SystemLog)
            
            # Applica i filtri se specificati
            if logger_name:
                # Controlla se il logger_name contiene un carattere wildcard
                if '%' in logger_name:
                    query = query.filter(SystemLog.logger_name.like(logger_name))
                else:
                    query = query.filter(SystemLog.logger_name == logger_name)
                
            if level:
                query = query.filter(SystemLog.level == level)
                
            if start_time:
                query = query.filter(SystemLog.timestamp >= start_time)
                
            if end_time:
                query = query.filter(SystemLog.timestamp <= end_time)
                
            # Ordina per timestamp decrescente (più recenti prima)
            query = query.order_by(desc(SystemLog.timestamp))
            
            # Limitare i risultati
            query = query.limit(limit)
            
            # Converti in dizionari
            logs = [log.to_dict() for log in query.all()]
            
            return logs
            
        except Exception as e:
            # Non logghiamo qui per evitare ricorsione
            db_debug(f"Errore nel recupero dei log: {str(e)}")
            return [] 
import logging
import os
from datetime import datetime
import inspect
import sys
from ..config import TIMEZONE

# Flag globale per prevenire ricorsione durante l'inizializzazione
_INITIALIZING_DB_HANDLER = False

# Classe formatter personalizzata che applica il timezone configurato
class TimezoneFormatter(logging.Formatter):
    """
    Formatter personalizzato che applica il timezone corretto alle date dei log
    """
    def formatTime(self, record, datefmt=None):
        # Converte il timestamp del record in un datetime con timezone
        dt = datetime.fromtimestamp(record.created).astimezone(TIMEZONE)
        if datefmt:
            return dt.strftime(datefmt)
        else:
            return dt.isoformat()

class DatabaseLogHandler(logging.Handler):
    """
    Handler personalizzato per salvare i log nel database.
    """
    def __init__(self):
        super().__init__()
        self._repository = None
        self._session = None
        self._initialized = False
        self._init_failed = False
    
    def emit(self, record):
        """
        Salva il record di log nel database.
        """
        global _INITIALIZING_DB_HANDLER
        
        # Previene ricorsione infinita - se siamo già in un processo di emit, usa solo la console
        if _INITIALIZING_DB_HANDLER:
            print(f"DB LOG: {record.levelname} - {record.name} - {record.getMessage()}")
            return
            
        # Se l'inizializzazione ha fallito, non riprovare
        if self._init_failed:
            print(f"DB LOG (fallback): {record.levelname} - {record.name} - {record.getMessage()}")
            return
            
        # Lazy initialization del repository per evitare import circolari
        if not self._initialized and not self._init_failed:
            try:
                _INITIALIZING_DB_HANDLER = True
                # Import lazy per evitare dipendenze circolari
                from sqlalchemy import create_engine
                from sqlalchemy.orm import sessionmaker
                
                # Usa direttamente i dettagli del database invece di importare SessionLocal
                from ..database.config import DATABASE_URL
                
                # Crea una sessione dedicata per il logging
                engine = create_engine(DATABASE_URL, echo=False)
                Session = sessionmaker(bind=engine)
                self._session = Session()
                
                # Import esplicito del repository
                from ..database.log_repository import LogRepository
                self._repository = LogRepository(self._session)
                
                self._initialized = True
                print(f">>> DatabaseLogHandler inizializzato con successo")
            except Exception as e:
                print(f">>> Errore nell'inizializzazione del DatabaseLogHandler: {str(e)}")
                self._init_failed = True
            finally:
                _INITIALIZING_DB_HANDLER = False
                
            # Se l'inizializzazione è fallita, termina qui
            if self._init_failed:
                return
        
        try:
            # Controllo aggiuntivo per assicurarsi che il repository sia inizializzato
            if not self._initialized or not self._repository:
                print(f"DB LOG (non inizializzato): {record.levelname} - {record.name} - {record.getMessage()}")
                return
                
            # Estrai le informazioni dal record
            logger_name = record.name
            level = record.levelname
            message = self.format(record)
            
            # Estrai eventuali dettagli aggiuntivi
            details = {
                'pathname': record.pathname,
                'lineno': record.lineno,
                'funcName': record.funcName
            }
            
            # Aggiungi eccezione se presente
            if record.exc_info:
                details['exc_info'] = str(record.exc_info[1])
            
            # Salva nel database
            self._repository.save_log(logger_name, level, message, details)
            
        except Exception as e:
            # Evita di generare un'altra eccezione durante la gestione dell'eccezione
            print(f">>> Errore nel salvataggio del log nel database: {str(e)}")

def setup_logger(name):
    """
    Configura un logger professionale che utilizza solo il database e la console
    
    Args:
        name (str): Nome del logger
    
    Returns:
        logging.Logger: Logger configurato
    """
    # Crea il logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # Se il logger ha già degli handler, restituiscilo direttamente
    if logger.handlers:
        return logger
    
    # Formato del log con timezone configurato
    formatter = TimezoneFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler per la console (sempre abilitato)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Aggiungi handler per il database
    try:
        db_handler = DatabaseLogHandler()
        db_handler.setLevel(logging.DEBUG)
        db_handler.setFormatter(formatter)
        logger.addHandler(db_handler)
    except Exception as e:
        print(f">>> Errore nell'aggiunta del DatabaseLogHandler: {str(e)}")
    
    return logger

def get_module_logger(module_name):
    """
    Crea un logger specifico per un modulo che utilizza solo database e console.
    
    Args:
        module_name (str): Nome del modulo (es. 'nmap_scan', 'amass', ecc.)
    
    Returns:
        logging.Logger: Un logger configurato per il modulo specificato
    """
    logger = logging.getLogger(module_name)
    
    # Se il logger è già configurato, restituiscilo direttamente
    if logger.handlers:
        return logger
    
    # Imposta il livello di log
    logger.setLevel(logging.INFO)
    
    # Formato per i messaggi di log con timezone configurato
    formatter = TimezoneFormatter('%(asctime)s - %(levelname)s - %(message)s', '%Y-%m-%d %H:%M:%S')
    
    # Handler per la console (sempre abilitato)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Aggiungi handler per il database
    try:
        db_handler = DatabaseLogHandler()
        db_handler.setLevel(logging.DEBUG)
        db_handler.setFormatter(formatter)
        logger.addHandler(db_handler)
    except Exception as e:
        print(f">>> Errore nell'aggiunta del DatabaseLogHandler per '{module_name}': {str(e)}")
    
    # Evita la propagazione dei log al root logger per evitare duplicati
    logger.propagate = False
    
    return logger 
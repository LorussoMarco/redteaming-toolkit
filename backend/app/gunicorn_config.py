import logging
import os
from datetime import datetime
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from backend.modules.utils.logger import setup_logger, get_module_logger, DatabaseLogHandler, TimezoneFormatter
from backend.modules.config import TIMEZONE

# Configurazione base di Gunicorn
bind = "0.0.0.0:5000"
workers = 3
threads = 2
timeout = 120
preload_app = True
certfile = "/app/backend/certificates/cert.pem"
keyfile = "/app/backend/certificates/key.pem"

# Configurazione del logging
loglevel = os.getenv('LOG_LEVEL', 'info')
accesslog = "-"  
errorlog = "-"  

# Funzioni per integrare il logging di Gunicorn con il DB

class GunicornDatabaseLogHandler(DatabaseLogHandler):
    """Handler personalizzato per i log di Gunicorn verso database"""
    def __init__(self, logger_name="gunicorn"):
        super().__init__()
        self.logger_name = logger_name
    
    def emit(self, record):
        # Modifichiamo il nome del logger per distinguere i log di Gunicorn
        original_name = record.name
        record.name = f"{self.logger_name}.{original_name}"
        
        # Per i log di accesso, formatta il messaggio in modo più leggibile
        if "gunicorn.access" in record.name and hasattr(record, 'msg'):
            # Il formato standard di access log è: %(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"
            # Trasformiamolo in qualcosa di più leggibile
            try:
                msg_parts = str(record.msg).split('"')
                if len(msg_parts) >= 5:
                    # Estrai le parti principali
                    ip_part = msg_parts[0].strip()
                    request_part = msg_parts[1].strip()
                    status_size_part = msg_parts[2].strip().split()[0]
                    referer_part = msg_parts[3].strip() if len(msg_parts) > 3 else "-"
                    user_agent_part = msg_parts[4].strip() if len(msg_parts) > 4 else "-"
                    
                    # Crea un messaggio più leggibile
                    record.msg = f"Access: {ip_part} - \"{request_part}\" {status_size_part} - Referer: {referer_part}"
            except Exception as e:
                print(f"Errore nel formattare il log di accesso: {str(e)}")
        
        super().emit(record)
        # Ripristiniamo il nome originale
        record.name = original_name

def setup_gunicorn_loggers():
    """Configura i logger di Gunicorn per usare anche il database"""
    # Configura i logger principali di Gunicorn
    gunicorn_error_logger = logging.getLogger("gunicorn.error")
    gunicorn_access_logger = logging.getLogger("gunicorn.access")
    
    # Imposta il livello di log
    gunicorn_error_logger.setLevel(logging.INFO)
    gunicorn_access_logger.setLevel(logging.INFO)
    
    # Formato personalizzato per i log
    formatter = TimezoneFormatter('%(asctime)s - %(levelname)s - %(message)s', '%Y-%m-%d %H:%M:%S')
    
    # Aggiungiamo gli handler per il database
    try:
        # Handler per gli errori
        db_error_handler = GunicornDatabaseLogHandler("gunicorn.error")
        db_error_handler.setLevel(logging.INFO)
        db_error_handler.setFormatter(formatter)
        gunicorn_error_logger.addHandler(db_error_handler)
        
        # Handler per gli accessi
        db_access_handler = GunicornDatabaseLogHandler("gunicorn.access")
        db_access_handler.setLevel(logging.INFO)
        db_access_handler.setFormatter(formatter)
        gunicorn_access_logger.addHandler(db_access_handler)
        
        print(">>> Handler di log database configurati per Gunicorn")
    except Exception as e:
        print(f">>> Errore nella configurazione dei logger DB per Gunicorn: {str(e)}")

# Hook per dopo l'inizializzazione dei worker
def post_worker_init(worker):
    """Chiamata dopo l'inizializzazione di ogni worker"""
    setup_gunicorn_loggers()
    print(f"Worker {worker.pid} inizializzato con logger DB")

# Hook per la configurazione dell'app
def on_starting(server):
    """Chiamata quando il server sta per avviarsi"""
    print("Avvio del server Gunicorn con integrazione log database")

# Hook per dopo il fork del worker
def post_fork(server, worker):
    """Chiamata subito dopo il fork di un worker"""
    print(f"Worker {worker.pid} iniziato, configurazione logger in corso...") 
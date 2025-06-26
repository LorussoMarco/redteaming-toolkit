import os
import sys
import time
import ctypes
import logging

# Add the project root to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, os.path.dirname(project_root))

from backend.app import create_app
from backend.modules.database.config import init_db
from backend.modules.utils.logger import setup_logger, get_module_logger
from backend.modules.config import get_config

def setup_directories(logger):
    """
    Crea e configura le directory necessarie per l'applicazione
    
    Args:
        logger: Logger per i messaggi
    """
    try:
        # Ottieni la configurazione attiva
        config = get_config()
        
        # Crea la directory per i progetti se non esiste
        os.makedirs(config.PROJECTS_FS_PATH, exist_ok=True)
        logger.info(f"Directory dei progetti creata/verificata: {config.PROJECTS_FS_PATH}")
        
        # Crea la directory per gli upload se non esiste
        os.makedirs(os.getenv('UPLOADS_FOLDER', '/tmp/uploads'), exist_ok=True)
        logger.info(f"Directory degli upload creata/verificata: {os.getenv('UPLOADS_FOLDER', '/tmp/uploads')}")
        
        # Crea la directory per i certificati SSL se non esiste
        os.makedirs(os.path.join(project_root, 'certificates'), exist_ok=True)
        logger.info(f"Directory dei certificati SSL creata/verificata")
        
        return True
    except Exception as e:
        logger.error(f"Errore nella creazione delle directory: {str(e)}")
        return False

def wait_for_db(logger, max_retries=30, retry_interval=2):
    """
    Attende che il database sia disponibile prima di procedere.
    
    Args:
        logger: Logger per i messaggi
        max_retries: Numero massimo di tentativi
        retry_interval: Intervallo tra i tentativi in secondi
    
    Returns:
        bool: True se il database è disponibile, False altrimenti
    """
    from sqlalchemy import create_engine
    from sqlalchemy.exc import OperationalError
    from backend.modules.database.config import DATABASE_URL
    
    logger.info("Attesa per la disponibilità del database...")
    
    for attempt in range(max_retries):
        try:
            # Tenta una connessione semplice
            engine = create_engine(DATABASE_URL)
            conn = engine.connect()
            conn.close()
            logger.info(f"Database disponibile dopo {attempt + 1} tentativi")
            return True
        except OperationalError as e:
            logger.warning(f"Tentativo {attempt + 1}/{max_retries} fallito: {str(e)}")
            time.sleep(retry_interval)
    
    logger.error(f"Impossibile connettersi al database dopo {max_retries} tentativi")
    return False

def initialize_database(logger, max_retries=3):
    """
    Inizializza il database con meccanismo di retry.
    
    Args:
        logger: Logger per i messaggi
        max_retries: Numero massimo di tentativi
    
    Returns:
        bool: True se l'inizializzazione è riuscita, False altrimenti
    """
    for attempt in range(max_retries):
        try:
            init_db()
            logger.info(f"Database inizializzato con successo al tentativo {attempt + 1}")
            return True
        except Exception as e:
            logger.error(f"Tentativo {attempt + 1}/{max_retries} di inizializzazione del database fallito: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(2)  # Attendi prima di riprovare
    
    logger.error(f"Impossibile inizializzare il database dopo {max_retries} tentativi")
    return False

# Crea l'app Flask - utilizzata sia in modalità standalone che con WSGI server
def create_application():
    """
    Inizializza l'applicazione sia per modalità standalone che per WSGI server (gunicorn)
    """
    # Imposta esplicitamente l'uso del database
    os.environ['STORAGE_MODE'] = 'db'
    
    # Configura il logging base temporaneo per l'avvio
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Logger temporaneo per l'avvio
    startup_logger = logging.getLogger('startup')
    
    # Configura le directory
    setup_directories(startup_logger)
    
    # Inizializza il database con attesa e retry
    if wait_for_db(startup_logger):
        if not initialize_database(startup_logger):
            startup_logger.error("Errore nell'inizializzazione del database")
    else:
        startup_logger.error("Database non disponibile, l'applicazione non può funzionare correttamente")
    
    # Configura il root logger
    root_logger = setup_logger('system')
    
    # Configura i logger specifici per i moduli principali
    nmap_logger = get_module_logger('nmap_scan')
    amass_logger = get_module_logger('amass')
    
    # Crea l'app
    app = create_app()
    return app

# Applicazione per il WSGI server (gunicorn)
application = create_application()

if __name__ == '__main__':
    # Imposta esplicitamente l'uso del database
    os.environ['STORAGE_MODE'] = 'db'
    
    # Determina la modalità di esecuzione (dev o prod)
    if os.getenv('FLASK_ENV', 'production') == 'development':
        os.environ['FLASK_ENV'] = 'development'
        is_dev_mode = True
    else:
        os.environ['FLASK_ENV'] = 'production'
        is_dev_mode = False
    
    print("=" * 80)
    print("AVVIO APPLICAZIONE:")
    print(f"FLASK_ENV: {os.getenv('FLASK_ENV')}")
    print("STORAGE_MODE: db (modalità database forzata)")
    print("=" * 80)
    
    # Configura il logging base temporaneo per l'avvio
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Logger temporaneo per l'avvio
    startup_logger = logging.getLogger('startup')
    
    # Configura le directory
    if not setup_directories(startup_logger):
        startup_logger.error("Errore nella configurazione delle directory")
    
    # Inizializza il database con attesa e retry
    if wait_for_db(startup_logger):
        if not initialize_database(startup_logger):
            startup_logger.error("Errore nell'inizializzazione del database")
    else:
        startup_logger.error("Database non disponibile, l'applicazione non può funzionare correttamente")
    
    # Configura il root logger
    root_logger = setup_logger('system')
    
    # Configura i logger specifici per i moduli principali
    nmap_logger = get_module_logger('nmap_scan')
    amass_logger = get_module_logger('amass')
    
    root_logger.info("Applicazione avviata con salvataggio dei log su database")
    
    # Percorsi dei certificati SSL
    cert_path = os.path.join(project_root, 'certificates', 'cert.pem')
    key_path = os.path.join(project_root, 'certificates', 'key.pem')
    
    # Verifica che i certificati esistano
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        root_logger.error(f"Certificati SSL non trovati in {os.path.dirname(cert_path)}")
        print(f"ERRORE: Certificati SSL non trovati in {os.path.dirname(cert_path)}")
        sys.exit(1)
    
    # Crea l'app e avvia il server Flask con HTTPS
    app = create_app()
    
    # Modalità di avvio appropriata
    if is_dev_mode:
        root_logger.info("Avvio server di sviluppo con HTTPS sulla porta 5000")
        app.run(debug=True, host='0.0.0.0', port=5000, ssl_context=(cert_path, key_path))
    else:
        root_logger.info("Avvio server di produzione con HTTPS sulla porta 5000")
        app.run(debug=False, host='0.0.0.0', port=5000, ssl_context=(cert_path, key_path))
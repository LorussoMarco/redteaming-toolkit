"""
Configurazione per la connessione al database.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..utils.logger import get_module_logger

logger = get_module_logger('database')

# Carica le variabili d'ambiente dal file .env
load_dotenv()

# Configurazione del database
DB_USER = os.environ.get('DB_USER', 'redteam')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'redteampassword')
DB_HOST = os.environ.get('DB_HOST', 'db')  # Nome del servizio in docker-compose
DB_PORT = os.environ.get('DB_PORT', '3306')
DB_NAME = os.environ.get('DB_NAME', 'redteaming')

# URL di connessione SQLAlchemy per MySQL
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Configurazione aggiuntiva per garantire la persistenza
# Questi valori sono importanti per mantenere le connessioni attive
POOL_SIZE = 10
MAX_OVERFLOW = 20
POOL_RECYCLE = 3600  # Ricicla le connessioni dopo un'ora
POOL_TIMEOUT = 30  # Timeout per acquisire una connessione in secondi

# Creazione dell'engine SQLAlchemy con opzioni per la persistenza
engine = create_engine(
    DATABASE_URL, 
    echo=False, 
    pool_pre_ping=True,  # Verifica la connessione prima di utilizzarla
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_recycle=POOL_RECYCLE,
    pool_timeout=POOL_TIMEOUT
)

# Creazione della sessione
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base per la creazione dei modelli
Base = declarative_base()

def get_db():
    """
    Generatore di contesto per ottenere una sessione del database.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Inizializza il database creando tutte le tabelle.
    """
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database inizializzato con successo")
    except Exception as e:
        logger.error(f"Errore durante l'inizializzazione del database: {str(e)}")
        raise 
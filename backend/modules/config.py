"""
Configuration settings for the application.
"""
import os
import sys
import dotenv
from pathlib import Path
import pytz

# Carica le variabili d'ambiente dal file .env se esiste
dotenv.load_dotenv()

# Timezone di sistema
# Utilizzare 'Europe/Rome' per l'ora italiana (UTC+1/+2 con ora legale)
TIMEZONE = pytz.timezone('Europe/Rome')

class Config:
    """Base configuration class."""
    
    # Metasploit RPC Configuration
    MSF_HOST = os.getenv('MSF_HOST', 'localhost')
    MSF_PORT = int(os.getenv('MSF_PORT', 55553))
    MSF_USER = os.getenv('MSF_USER', 'msf')
    MSF_PASSWORD = os.getenv('MSF_PASSWORD', 'msf')  # Change this in production!
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Application Configuration
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')  # Change this in production!
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Tool Paths
    NMAP_PATH = os.getenv('NMAP_PATH', '/usr/local/bin/nmap')
    AMASS_PATH = os.getenv('AMASS_PATH', '/usr/local/bin/amass')
    METASPLOIT_PATH = os.getenv('METASPLOIT_PATH', '/usr/local/bin/msfconsole')
    
    # Project Filesystem Configuration
    PROJECTS_FS_PATH = os.getenv('PROJECTS_FS_PATH', os.path.join(os.path.expanduser('~'), 'redteam-projects'))
    
    # Security settings
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_HTTPONLY = True
    
    # Production Server settings
    PREFERRED_URL_SCHEME = 'https'
    
    # API Configuration
    API_KEY = os.getenv('API_KEY')
    
    # Directory base dell'applicazione
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    
    # Path per i file temporanei
    TEMP_DIR = os.path.join(BASE_DIR, 'temp')
    
    # Path per i log
    LOG_DIR = os.path.join(BASE_DIR, 'logs')
    
    # Database URI
    DB_URI = os.environ.get("DATABASE_URI", f"sqlite:///{os.path.join(BASE_DIR, 'backend', 'redteaming.db')}")
    
    # Configurazione server
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", "5000"))
    
    # Debug mode
    DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "t")
    
    @staticmethod
    def init_app(app):
        """Initialize application configuration."""
        pass

    # Inizializza le directory necessarie
    @classmethod
    def init_dirs(cls):
        """Crea le directory necessarie se non esistono già"""
        os.makedirs(cls.TEMP_DIR, exist_ok=True)
        os.makedirs(cls.PROJECTS_FS_PATH, exist_ok=True)
        
        print(f"Directory inizializzate:")
        print(f" - TEMP_DIR: {cls.TEMP_DIR}")
        print(f" - PROJECTS_FS_PATH: {cls.PROJECTS_FS_PATH}")


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False
    
    @staticmethod
    def init_app(app):
        Config.init_app(app)
        app.logger.info('RUNNING IN DEVELOPMENT MODE')


class ProductionConfig(Config):
    """Production configuration."""
    # Ensure all production security settings are enabled
    
    @staticmethod
    def init_app(app):
        Config.init_app(app)
        
        # Set up production logging to file/syslog if needed
        import logging
        from logging.handlers import RotatingFileHandler
        
        # Create handler for production logs if not using database logging
        if not os.getenv('STORAGE_MODE') == 'db':
            file_handler = RotatingFileHandler('logs/application.log', maxBytes=1024 * 1024 * 100, backupCount=20)
            file_handler.setFormatter(logging.Formatter(Config.LOG_FORMAT))
            file_handler.setLevel(logging.INFO)
            app.logger.addHandler(file_handler)
        
        app.logger.info('RUNNING IN PRODUCTION MODE')


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': ProductionConfig  # Set production as the default configuration
}

# Get the configuration based on environment variable or use default
def get_config():
    env = os.getenv('FLASK_ENV', 'production')
    return config.get(env, config['default']) 
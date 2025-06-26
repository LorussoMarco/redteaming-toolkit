from flask import Flask, send_from_directory, redirect, url_for
from flask_cors import CORS
import os
import sys
from modules.database.config import SessionLocal
from modules.config import get_config

def create_app(config_name=None):
    """Crea e configura l'applicazione Flask"""
    # Configura la cartella statica correttamente
    static_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')
    app = Flask(__name__, static_folder=static_folder)
    
    # Carica la configurazione in base all'ambiente
    config = get_config()
    app.config.from_object(config)
    config.init_app(app)
    
    # Configura CORS per accettare richieste da entrambi gli host
    CORS(app, origins=['https://localhost:3000', 'https://frontend:3000'], supports_credentials=True)
    
    # Configura i percorsi della app
    app.config['PROJECTS_FS_PATH'] = config.PROJECTS_FS_PATH
    
    # Setup database session
    @app.before_request
    def setup_db_session():
        app.db_session = SessionLocal()
        
    @app.teardown_appcontext
    def close_db_session(exception=None):
        if hasattr(app, 'db_session'):
            app.db_session.close()
    
    # Import and register blueprints/routes
    from app.routes.main import main_bp
    from app.routes.reconnaissance import recon_bp
    from app.routes.exploitation import exploit_bp
    from app.routes.system import system_bp
    from app.routes.projects import projects_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(recon_bp)
    app.register_blueprint(exploit_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(projects_bp)

    # Route per servire il frontend React
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    
    return app 
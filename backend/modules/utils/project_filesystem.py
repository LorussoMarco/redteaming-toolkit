import os
import json
from typing import Dict, Any, Optional

from ..utils.logger import get_module_logger

logger = get_module_logger('project_filesystem')

class ProjectFilesystem:
    """
    Gestisce le operazioni del filesystem relative ai progetti.
    """
    
    def __init__(self, base_path: str):
        """
        Inizializza il gestore del filesystem per i progetti
        
        Args:
            base_path: Percorso base dove vengono salvati i dati dei progetti
        """
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)
        logger.info(f"Inizializzato ProjectFilesystem con percorso base: {base_path}")
    
    def get_project_path(self, project_name: str) -> str:
        """
        Ottiene il percorso della directory di un progetto
        
        Args:
            project_name: Nome del progetto
            
        Returns:
            str: Percorso completo della directory del progetto
        """
        # Sanitizza il nome del progetto rimuovendo caratteri non validi
        safe_name = "".join(c if c.isalnum() or c in ['-', '_'] else '_' for c in project_name)
        return os.path.join(self.base_path, safe_name)
    
    def create_project_directory(self, project_name: str) -> str:
        """
        Crea una directory per un progetto
        
        Args:
            project_name: Nome del progetto
            
        Returns:
            str: Percorso completo della directory creata
        """
        project_path = self.get_project_path(project_name)
        os.makedirs(project_path, exist_ok=True)
        
        # Crea sottodirectory per i diversi tipi di dati
        os.makedirs(os.path.join(project_path, "reports"), exist_ok=True)
        
        logger.info(f"Creata directory per il progetto '{project_name}': {project_path}")
        return project_path
    
    def save_report_json(self, project_name: str, tool: str, report_data: Dict[str, Any], 
                        filename: Optional[str] = None) -> str:
        """
        Salva un report come file JSON nella directory del progetto
        
        Args:
            project_name: Nome del progetto
            tool: Nome dello strumento (es. 'nmap', 'amass')
            report_data: Dati del report da salvare
            filename: Nome del file (opzionale, altrimenti generato automaticamente)
            
        Returns:
            str: Percorso completo del file salvato
        """
        project_path = self.get_project_path(project_name)
        report_dir = os.path.join(project_path, "reports", tool)
        os.makedirs(report_dir, exist_ok=True)
        
        if filename is None:
            # Genera un nome di file basato sul timestamp
            timestamp = report_data.get('metadata', {}).get('timestamp', 'report')
            filename = f"{timestamp}.json"
        
        file_path = os.path.join(report_dir, filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Salvato report {tool} per il progetto '{project_name}': {file_path}")
        return file_path
    
    def get_report_file_path(self, project_name: str, tool: str, filename: str) -> str:
        """
        Ottiene il percorso completo di un file di report
        
        Args:
            project_name: Nome del progetto
            tool: Nome dello strumento (es. 'nmap', 'amass')
            filename: Nome del file del report
            
        Returns:
            str: Percorso completo del file
        """
        project_path = self.get_project_path(project_name)
        return os.path.join(project_path, "reports", tool, filename)
    
    def load_report_json(self, project_name: str, tool: str, filename: str) -> Optional[Dict[str, Any]]:
        """
        Carica un report da un file JSON
        
        Args:
            project_name: Nome del progetto
            tool: Nome dello strumento
            filename: Nome del file del report
            
        Returns:
            Dict o None: I dati del report o None se il file non esiste
        """
        file_path = self.get_report_file_path(project_name, tool, filename)
        
        if not os.path.exists(file_path):
            logger.warning(f"File di report non trovato: {file_path}")
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Errore nel caricamento del report {file_path}: {str(e)}")
            return None
    
    def list_reports(self, project_name: str, tool: Optional[str] = None) -> Dict[str, Any]:
        """
        Elenca tutti i report disponibili per un progetto
        
        Args:
            project_name: Nome del progetto
            tool: Nome dello strumento per filtrare (opzionale)
            
        Returns:
            Dict: Struttura con i report disponibili organizzati per tool
        """
        project_path = self.get_project_path(project_name)
        reports_dir = os.path.join(project_path, "reports")
        
        if not os.path.exists(reports_dir):
            logger.warning(f"Directory reports non trovata per il progetto '{project_name}'")
            return {}
        
        result = {}
        
        # Se specifico un tool, elenca solo quelli
        if tool:
            tool_dir = os.path.join(reports_dir, tool)
            if os.path.exists(tool_dir) and os.path.isdir(tool_dir):
                result[tool] = [f for f in os.listdir(tool_dir) if f.endswith('.json')]
            return result
        
        # Altrimenti elenca tutti
        for item in os.listdir(reports_dir):
            item_path = os.path.join(reports_dir, item)
            if os.path.isdir(item_path):
                result[item] = [f for f in os.listdir(item_path) if f.endswith('.json')]
        
        return result
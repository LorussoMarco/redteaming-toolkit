import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, Float, Boolean, Table
from sqlalchemy.orm import relationship

from .config import Base

# Tabella di associazione tra progetti e target (relazione molti-a-molti)
project_targets = Table(
    'project_targets', 
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('target_id', Integer, ForeignKey('targets.id'), primary_key=True)
)

class Project(Base):
    """
    Modello per i progetti di assessment.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    status = Column(String(50), default="active", nullable=False)  
    phase = Column(String(50), default="discovery", nullable=False)  
    notes = Column(Text, nullable=True)
    
    fs_path = Column(String(255), nullable=True)  
    
    # Relazioni
    targets = relationship("Target", secondary=project_targets, back_populates="projects")
    reports = relationship("ScanReport", back_populates="project")
    
    def to_dict(self):
        """Converte l'oggetto in un dizionario"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'status': self.status,
            'phase': self.phase,
            'notes': self.notes,
            'fs_path': self.fs_path,
            'targets_count': len(self.targets) if self.targets else 0,
            'reports_count': len(self.reports) if self.reports else 0,
        }

class Target(Base):
    """
    Modello per i target di un progetto.
    """
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=True)
    address = Column(String(255), nullable=False, index=True)  
    target_type = Column(String(50), default="host", nullable=False)  
    status = Column(String(50), default="pending", nullable=False)  
    risk_level = Column(Float, default=0.0, nullable=False)  
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)
    meta_info = Column(Text, nullable=True)  
    
    # Relazioni
    projects = relationship("Project", secondary=project_targets, back_populates="targets")
    reports = relationship("ScanReport", back_populates="target_obj")
    
    def set_metadata(self, metadata_dict):
        """Imposta i metadati come JSON"""
        if metadata_dict:
            self.meta_info = json.dumps(metadata_dict, ensure_ascii=False)
        else:
            self.meta_info = None
    
    def get_metadata(self):
        """Recupera i metadati come dizionario Python"""
        if self.meta_info:
            return json.loads(self.meta_info)
        return {}
    
    def to_dict(self):
        """Converte l'oggetto in un dizionario"""
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'target_type': self.target_type,
            'status': self.status,
            'risk_level': self.risk_level,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'notes': self.notes,
            'metadata': self.get_metadata(),
            'reports_count': len(self.reports) if self.reports else 0
        }

class ScanReport(Base):
    """
    Modello per i report di scan generico (base class).
    """
    __tablename__ = "scan_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool = Column(String(50), nullable=False, index=True)  
    scan_type = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.now, nullable=False, index=True)
    target = Column(String(255), nullable=True)  
    data = Column(Text(16777215), nullable=False)  
    
    # Nuovi campi per l'integrazione con i progetti
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    target_id = Column(Integer, ForeignKey('targets.id'), nullable=True)
    vulnerability_count = Column(Integer, default=0)
    
    # Campo per indicare se il report è memorizzato sul filesystem
    stored_on_fs = Column(Boolean, default=False)  
    fs_path = Column(String(255), nullable=True)  
    
    # Relazioni
    project = relationship("Project", back_populates="reports")
    target_obj = relationship("Target", back_populates="reports")

    # Indici per ottimizzare le query
    __table_args__ = (
        Index('idx_tool_timestamp', 'tool', 'timestamp'),
        Index('idx_project_tool', 'project_id', 'tool'),
    )

    def set_data(self, data_dict):
        """Imposta i dati come JSON"""
        self.data = json.dumps(data_dict, ensure_ascii=False)

    def get_data(self):
        """Recupera i dati come dizionario Python"""
        return json.loads(self.data)
    
    def get_metadata(self):
        """Recupera i metadati del report"""
        data = self.get_data()
        return data.get('metadata', {})

    def get_summary(self):
        """Recupera il riepilogo del report"""
        data = self.get_data()
        return data.get('summary', {})

    def to_dict(self):
        """Converte l'oggetto in un dizionario"""
        return {
            'id': self.id,
            'tool': self.tool,
            'scan_type': self.scan_type,
            'timestamp': self.timestamp.isoformat(),
            'target': self.target,
            'project_id': self.project_id,
            'target_id': self.target_id,
            'vulnerability_count': self.vulnerability_count,
            'metadata': self.get_metadata(),
            'summary': self.get_summary(),
            'stored_on_fs': self.stored_on_fs,
            'fs_path': self.fs_path
        }

class SystemLog(Base):
    """
    Modello per i log di sistema.
    """
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    logger_name = Column(String(100), nullable=False, index=True)
    level = Column(String(20), nullable=False, index=True)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    details = Column(Text, nullable=True)  

    # Indici per ottimizzare le query - usa un nome diverso rispetto a ScanReport
    __table_args__ = (
        Index('idx_logger_timestamp', 'logger_name', 'timestamp'),
    )

    def set_details(self, details_dict):
        """Imposta i dettagli come JSON"""
        if details_dict:
            self.details = json.dumps(details_dict, ensure_ascii=False)
        else:
            self.details = None

    def get_details(self):
        """Recupera i dettagli come dizionario Python"""
        if self.details:
            return json.loads(self.details)
        return {}

    def to_dict(self):
        """Converte l'oggetto in un dizionario"""
        return {
            'id': self.id,
            'logger_name': self.logger_name,
            'level': self.level,
            'message': self.message,
            'timestamp': self.timestamp.isoformat(),
            'details': self.get_details()
        } 
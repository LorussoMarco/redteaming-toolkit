"""
Red Teaming Toolkit Modules

Contiene i moduli per le diverse fasi del processo di red teaming:
1. Reconnaissance - Raccolta di informazioni sul target
2. Exploitation - Exploit delle vulnerabilità
3. Privilege Escalation - Escalation dei privilegi sui sistemi compromessi
"""

from .utils.logger import get_module_logger
from .reporting.report_manager import ReportManager
from .reconnaissance.nmap_scan import run as run_nmap, get_scan_commands, is_subnet 
-- Inizializzazione del database redteaming

-- Creazione del database (se non esiste già)
CREATE DATABASE IF NOT EXISTS redteaming;

-- Uso del database
USE redteaming;

-- Concedi permessi all'utente redteam
GRANT ALL PRIVILEGES ON redteaming.* TO 'redteam'@'%';
FLUSH PRIVILEGES;

-- Mostra la versione del database
SELECT VERSION(); 
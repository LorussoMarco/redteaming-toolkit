#!/bin/bash

echo "Checking database connection..."
attempts=0
max_attempts=30

while [ $attempts -lt $max_attempts ]; do
    attempts=$((attempts+1))
    echo "Attempt $attempts/$max_attempts..."
    if mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e "SELECT 1;" $DB_NAME &>/dev/null; then
        echo "Database connection established successfully!"
        break
    else
        echo "Could not connect to database, retrying in 2 seconds..."
        sleep 2
    fi
done

# Verifica l'installazione di Metasploit
echo "Checking Metasploit installation..."
if command -v msfvenom &> /dev/null; then
    echo "Metasploit (msfvenom) found in PATH: $(which msfvenom)"
    msfvenom --version
else
    echo "WARNING: msfvenom not found in PATH!"
    echo "Checking alternative locations..."
    
    # Controlla percorsi alternativi
    for path in /opt/metasploit-framework/msfvenom /usr/local/bin/msfvenom /usr/bin/msfvenom; do
        if [ -f "$path" ]; then
            echo "Found msfvenom at: $path"
            echo "Version:"
            $path --version
            
            # Crea un link simbolico se non esiste già
            if [ ! -f /usr/local/bin/msfvenom ]; then
                echo "Creating symlink to /usr/local/bin/msfvenom"
                ln -sf $path /usr/local/bin/msfvenom
            fi
            
            break
        fi
    done
    
    # Ultimo controllo dopo aver creato il symlink
    if ! command -v msfvenom &> /dev/null; then
        echo "ERROR: Metasploit installation not found or not properly configured!"
        # Non far fallire l'avvio, ma fai sapere che ci sono problemi
    fi
fi

# Start Metasploit RPC daemon
echo "Starting Metasploit RPC daemon..."
if command -v msfrpcd &> /dev/null; then
    msfrpcd -P msf -S -U msf -p 55553 -a 0.0.0.0 &
    echo "Waiting for msfrpcd to start..."
    sleep 5
else
    echo "WARNING: msfrpcd not found! Metasploit RPC daemon cannot be started."
    
    # Controlla percorsi alternativi
    for path in /opt/metasploit-framework/msfrpcd /usr/local/bin/msfrpcd /usr/bin/msfrpcd; do
        if [ -f "$path" ]; then
            echo "Found msfrpcd at: $path"
            echo "Starting Metasploit RPC daemon from alternate location..."
            $path -P msf -S -U msf -p 55553 -a 0.0.0.0 &
            echo "Waiting for msfrpcd to start..."
            sleep 5
            break
        fi
    done
fi

# Generate SSL certificates if they do not exist
mkdir -p /app/backend/certificates
if [ ! -f /app/backend/certificates/cert.pem ] || [ ! -f /app/backend/certificates/key.pem ]; then
    echo "Generating SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -nodes \
        -out /app/backend/certificates/cert.pem \
        -keyout /app/backend/certificates/key.pem \
        -days 365 -subj "/CN=localhost"
    echo "SSL certificates generated."
fi

echo "Starting application..."
cd /app/backend

# Determine if we're in development or production mode
if [ "$FLASK_ENV" = "development" ]; then
    echo "Running in DEVELOPMENT mode with Flask development server"
    python run.py
else
    echo "Running in PRODUCTION mode with Gunicorn"
    # Avvio con Gunicorn - utilizzando il file di configurazione personalizzato
    gunicorn --config=app/gunicorn_config.py "run:application"
fi
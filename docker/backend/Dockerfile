FROM python:3.9-slim
    
# Set working directory
WORKDIR /app

# Install system dependencies in a single layer with cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    sudo \
    nmap \
    dnsutils \
    unzip \
    wget \
    curl \
    ca-certificates \
    default-mysql-client \
    git \
    ruby \
    ruby-dev \
    build-essential \
    libpq-dev \
    libpcap-dev \
    libsqlite3-dev \
    libffi-dev \
    dos2unix \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Amass in the same layer
RUN wget -q https://github.com/OWASP/Amass/releases/download/v3.22.1/amass_Linux_amd64.zip && \
    unzip amass_Linux_amd64.zip && \
    mv amass_linux_amd64/amass /usr/local/bin/ && \
    rm -rf amass_linux_amd64*

# Install Metasploit Framework with aggressive optimizations
RUN mkdir -p /opt/metasploit && \
    cd /opt && \
    # Clone only what we need with minimal history and single branch
    git clone --depth=1 --single-branch --branch master --no-tags \
    https://github.com/rapid7/metasploit-framework.git && \
    cd metasploit-framework && \
    # Remove unnecessary directories to reduce size
    rm -rf .git .github data/meterpreter documentation external/source modules/auxiliary/dos modules/auxiliary/fuzzers \
           modules/auxiliary/scanner/scada modules/auxiliary/spoof tools/dev tools/metasm tools/memdump && \
    # Optimize gem installation
    gem install bundler --no-document && \
    # Configure bundler for minimal installation
    bundle config set --local without 'development test coverage' && \
    bundle config set --local jobs $(nproc) && \
    # Install dependencies with parallel jobs
    bundle install --no-cache && \
    # Cleanup
    rm -rf /usr/local/bundle/cache && \
    # Setup symlinks
    ln -sf /opt/metasploit-framework/msfconsole /usr/local/bin/msfconsole && \
    ln -sf /opt/metasploit-framework/msfvenom /usr/local/bin/msfvenom && \
    ln -sf /opt/metasploit-framework/msfrpcd /usr/local/bin/msfrpcd && \
    mkdir -p /root/.msf4/modules && \
    # Setup database config
    echo "production:" > /opt/metasploit-framework/config/database.yml && \
    echo "  adapter: postgresql" >> /opt/metasploit-framework/config/database.yml && \
    echo "  database: msf" >> /opt/metasploit-framework/config/database.yml && \
    echo "  username: msf" >> /opt/metasploit-framework/config/database.yml && \
    echo "  password: msf" >> /opt/metasploit-framework/config/database.yml && \
    echo "  host: db" >> /opt/metasploit-framework/config/database.yml && \
    echo "  port: 5432" >> /opt/metasploit-framework/config/database.yml && \
    echo "  pool: 5" >> /opt/metasploit-framework/config/database.yml && \
    echo "  timeout: 5" >> /opt/metasploit-framework/config/database.yml

# Create directory structure
COPY backend/requirements.txt /app/backend/

# Install dependencies with pip cache
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend code
COPY backend/ /app/backend/

# Copy our entrypoint script and fix line endings
COPY docker/backend/entrypoint.sh /app/entrypoint.sh
RUN dos2unix /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set environment variables
ENV FLASK_APP=/app/backend/run.py \
    PYTHONPATH=/app \
    DB_HOST=db \
    DB_PORT=3306 \
    DB_USER=redteam \
    DB_PASSWORD=redteampassword \
    DB_NAME=redteaming \
    STORAGE_MODE=db

# SSL setup in entrypoint.sh instead of build time
RUN echo '\n\
# Generate SSL certificates if they do not exist\n\
mkdir -p /app/backend/certificates\n\
if [ ! -f /app/backend/certificates/cert.pem ] || [ ! -f /app/backend/certificates/key.pem ]; then\n\
    echo "Generating SSL certificates..."\n\
    openssl req -x509 -newkey rsa:4096 -nodes \\\n\
        -out /app/backend/certificates/cert.pem \\\n\
        -keyout /app/backend/certificates/key.pem \\\n\
        -days 365 -subj "/CN=localhost"\n\
    echo "SSL certificates generated."\n\
fi\n\
' >> /app/entrypoint.sh

# Expose port
EXPOSE 5000

# Add a health check (now using HTTPS)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f -k https://localhost:5000/api/system/health || exit 1

# Run with root privileges
WORKDIR /app
ENTRYPOINT ["/app/entrypoint.sh"]
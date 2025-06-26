# Red Teaming Toolkit

A comprehensive toolkit for red teaming operations, offering reconnaissance, exploitation, and reporting capabilities.

## Features

- Reconnaissance tools (Nmap, Amass)
- Vulnerability scanning and exploitation
- Comprehensive reporting
- Modern web interface

## Architecture

The application consists of three main components:

1. **Frontend**: React-based web interface
2. **Backend**: Flask API server
3. **Database**: MySQL database for storing reports and logs

## Running with Docker Compose

The easiest way to run the application is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/yourusername/redteaming-toolkit.git
cd redteaming-toolkit

# Build the application first
make build

# Start the application
make up

# Access the web interface
# Open https://localhost:3000 in your browser
```

## Configuration

The application can be configured using environment variables in the `.env` file:

```
# Database configuration
DB_USER=redteam
DB_PASSWORD=redteampassword
DB_HOST=db
DB_PORT=3306
DB_NAME=redteaming

# Application configuration
STORAGE_MODE=db
DEBUG=false
```

## Directory Structure

- `backend/`: Flask backend application
  - `app/`: Flask application code
  - `modules/`: Core functionality modules
- `frontend/`: React frontend application
  - `src/`: Source code
  - `public/`: Common assets
- `docker/`: Docker configuration files
  - `backend/`: Backend Docker configuration
  - `frontend/`: Frontend Docker configuration
  - `db/`: Database initialization scripts
  - `docker-compose.yml`: Production configuration
  - `docker-compose.dev.yml`: Development configuration

## Security Considerations

- Always run in a controlled environment
- Change default credentials in production
- Use proper network isolation

## Features

The toolkit supports various red teaming phases:

1. **Reconnaissance**
   - Nmap scanning
   - Amass subdomain enumeration

2. **Exploitation**
   - Metasploit integration, payload generation

3. **Reporting**
   - Automatic report generation

4. **Projects**
   - Manage gour of host under a project name, gather reports from one place

## Documentation

Project documentation and User manual are available in the project root

## License

[MIT License](LICENSE)

.PHONY: up down dev build logs clean

# Production environment
up:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit up -d

down:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit down

# Development environment
dev:
	docker-compose -f docker/docker-compose.dev.yml -p redteaming-toolkit-dev up

dev-detach:
	docker-compose -f docker/docker-compose.dev.yml -p redteaming-toolkit-dev up -d

# Building images
build:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit build

build-dev:
	export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 && \
	docker-compose -f docker/docker-compose.dev.yml -p redteaming-toolkit-dev build

# Logs
logs:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit logs -f

logs-backend:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit logs -f backend

logs-frontend:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit logs -f frontend

# Cleaning
clean:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit down -v
	docker-compose -f docker/docker-compose.dev.yml -p redteaming-toolkit-dev down -v
	docker system prune -f

# Database operations
db-shell:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit exec db mysql -u redteam -predteampassword redteaming

db-import:
	docker-compose -f docker/docker-compose.yml -p redteaming-toolkit exec -T db mysql -u redteam -predteampassword redteaming < $(file)

help:
	@echo "Usage:"
	@echo "  make up              - Start production environment"
	@echo "  make down            - Stop production environment"
	@echo "  make dev             - Start development environment"
	@echo "  make dev-detach      - Start development environment in detached mode"
	@echo "  make build           - Build production images"
	@echo "  make build-dev       - Build development images"
	@echo "  make logs            - View all logs"
	@echo "  make logs-backend    - View backend logs"
	@echo "  make logs-frontend   - View frontend logs"
	@echo "  make clean           - Stop and remove containers, networks, volumes and clean unused images"
	@echo "  make db-shell        - Access MySQL shell"
	@echo "  make db-import file=file.sql - Import SQL file into the database" 
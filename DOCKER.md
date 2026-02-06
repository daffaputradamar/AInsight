# Docker Deployment Guide

This guide explains how to run AInsight using Docker and Docker Compose.

## Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- OpenAI API key

## Quick Start

### Production Deployment

```bash
# 1. Clone the repository
git clone <repository-url>
cd AInsight

# 2. Create environment file
cp .env.example .env

# 3. Edit .env and add your OpenAI API key
# Edit .env file and set:
# OPENAI_API_KEY=sk-your-actual-api-key-here

# 4. Build and start all services
docker-compose up -d --build

# 5. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# PostgreSQL: localhost:5432
```

### Development Mode (with hot reload)

```bash
# 1. Create environment file
cp .env.example .env

# 2. Add your OpenAI API key to .env

# 3. Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Changes to source files will automatically reload:
# - Backend: Changes in backend/src/
# - Frontend: Changes in app/, components/, lib/

# 4. Stop development
docker-compose -f docker-compose.dev.yml down
```

## Architecture

The Docker setup includes three services:

1. **Frontend** (Next.js) - Port 3000
   - Production: Multi-stage build with standalone output
   - Development: Hot reload using volume mounts

2. **Backend** (Node.js/Express) - Port 3001
   - Production: TypeScript compiled, optimized image
   - Development: tsx watch mode with hot reload

3. **PostgreSQL** - Port 5432
   - Alpine-based image
   - Persistent data with Docker volumes
   - Health checks for service availability

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required
OPENAI_API_KEY=sk-your-api-key-here

# Optional
DEFAULT_MODEL=gpt-4o-mini
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ainsight
DB_USER=postgres
DB_PASSWORD=postgres
```

## Docker Commands

### View running containers
```bash
docker-compose ps
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Restart a service
```bash
docker-compose restart backend
```

### Rebuild a specific service
```bash
docker-compose up -d --build backend
```

### Execute commands in containers
```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh

# PostgreSQL client
docker-compose exec postgres psql -U postgres -d ainsight
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes (deletes database data)
```bash
docker-compose down -v
```

## Using External Database

If you prefer to use an external PostgreSQL database:

1. Edit `docker-compose.yml`
2. Remove the `postgres` service
3. Update the `backend` service's `depends_on` to remove `postgres`
4. Configure database connection via the UI at http://localhost:3000

Alternatively, just don't start the postgres container:
```bash
docker-compose up -d backend frontend
```

Then configure your database connection through the application UI.

## Production Deployment Tips

### Using Docker Swarm

```bash
docker stack deploy -c docker-compose.yml ainsight
```

### Using Kubernetes

Convert docker-compose to Kubernetes manifests:
```bash
kompose convert -f docker-compose.yml
```

### Environment-specific Configurations

Create separate compose files:
- `docker-compose.yml` - Base configuration
- `docker-compose.prod.yml` - Production overrides
- `docker-compose.staging.yml` - Staging overrides

Deploy with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Frontend can't connect to backend

Check the `NEXT_PUBLIC_API_URL` environment variable:
- Production: Should be `http://backend:3001` (internal Docker network)
- Development: Should be `http://localhost:3001` (host network)

### Database connection issues

1. Verify PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Test connection:
   ```bash
   docker-compose exec postgres pg_isready -U postgres
   ```

### Port conflicts

If ports 3000, 3001, or 5432 are already in use, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Change host port (left side)
```

### Build failures

Clear Docker cache and rebuild:
```bash
docker-compose down
docker system prune -a
docker-compose up --build
```

### Out of disk space

Clean up Docker resources:
```bash
docker system prune -a --volumes
```

## Health Checks

All services include health checks:

- **Backend**: HTTP check on `/health` endpoint
- **Frontend**: HTTP check on root path
- **PostgreSQL**: `pg_isready` command

View health status:
```bash
docker-compose ps
```

## Backup and Restore

### Backup PostgreSQL database

```bash
docker-compose exec postgres pg_dump -U postgres ainsight > backup.sql
```

### Restore PostgreSQL database

```bash
docker-compose exec -T postgres psql -U postgres ainsight < backup.sql
```

## Performance Optimization

### Multi-stage builds
The Dockerfiles use multi-stage builds to minimize image size:
- Frontend: ~150MB (vs 1GB+ without optimization)
- Backend: ~100MB (vs 500MB+ without optimization)

### Layer caching
Dependencies are installed in separate layers to leverage Docker cache:
1. Package files copied first
2. Dependencies installed
3. Source code copied and built

This means rebuilds only recompile changed source code, not reinstall dependencies.

## Security Considerations

1. **API Keys**: Never commit `.env` files with real API keys
2. **Non-root users**: All containers run as non-root users
3. **Network isolation**: Services communicate via internal Docker network
4. **Read-only volumes**: Source code mounted read-only in development mode

## Support

For issues or questions:
- GitHub Issues: <repository-url>/issues
- Documentation: See main README.md

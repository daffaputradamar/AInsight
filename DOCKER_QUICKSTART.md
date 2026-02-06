# Docker Quick Start Guide

## ✅ What Was Added

Complete Docker support for AInsight with:

- **Production deployment** with optimized multi-stage builds
- **Development mode** with hot reload
- **PostgreSQL database** container included
- **Automated deployment scripts** for Windows and Linux/Mac

## 📦 Files Created

```
Root Directory:
├── Dockerfile.frontend          # Production frontend build
├── Dockerfile.frontend.dev      # Development frontend with hot reload
├── docker-compose.yml           # Production deployment
├── docker-compose.dev.yml       # Development deployment
├── .dockerignore                # Files to exclude from Docker builds
├── .env.example                 # Environment variables template
├── docker-deploy.sh             # Linux/Mac deployment script
├── docker-deploy.ps1            # Windows deployment script
├── docker-dev.sh                # Linux/Mac dev script
├── docker-dev.ps1               # Windows dev script
└── DOCKER.md                    # Full Docker documentation

Backend Directory:
├── Dockerfile                   # Production backend build
├── Dockerfile.dev               # Development backend with hot reload
└── .dockerignore                # Backend-specific Docker exclusions
```

## 🚀 Quick Start

### Option 1: Windows PowerShell (Recommended for Windows)

**Production:**
```powershell
# 1. Create .env file and add your OpenAI API key
Copy-Item .env.example .env
notepad .env  # Add your OPENAI_API_KEY

# 2. Run deployment script
.\docker-deploy.ps1
```

**Development:**
```powershell
.\docker-dev.ps1
```

### Option 2: Linux/Mac/WSL Bash

**Production:**
```bash
# 1. Create .env file and add your OpenAI API key
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY

# 2. Run deployment script
./docker-deploy.sh
```

**Development:**
```bash
./docker-dev.sh
```

### Option 3: Manual Docker Compose

**Production:**
```bash
# 1. Setup environment
cp .env.example .env
# Edit .env and add OPENAI_API_KEY

# 2. Build and start
docker-compose up -d --build

# 3. View logs
docker-compose logs -f
```

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## 🌐 Access Points

After deployment:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432

## 🔧 Common Commands

```bash
# View status
docker-compose ps

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes (deletes database)
docker-compose down -v

# Rebuild a service
docker-compose up -d --build backend
```

## 📊 Architecture

**Services:**
1. **frontend** - Next.js app (port 3000)
2. **backend** - Node.js API (port 3001)
3. **postgres** - PostgreSQL database (port 5432)

**Networks:**
- All services communicate via internal `ainsight-network`

**Volumes:**
- `postgres_data` - Persistent database storage

## 🔥 Development Mode Features

When using `docker-compose.dev.yml`:

- **Hot reload enabled** for both frontend and backend
- Source code mounted as read-only volumes
- Changes to `backend/src/` trigger backend reload
- Changes to `app/`, `components/`, `lib/` trigger frontend reload
- Sample database can be auto-initialized

## 🛡️ Production Optimizations

Multi-stage builds reduce image sizes:
- **Frontend:** ~150MB (vs 1GB+ without optimization)
- **Backend:** ~100MB (vs 500MB+ without optimization)

Security features:
- Non-root users in containers
- Read-only volume mounts in development
- Network isolation
- No sensitive data in images

## 📝 Environment Variables

Required in `.env`:
```env
OPENAI_API_KEY=sk-your-api-key-here
```

Optional:
```env
DEFAULT_MODEL=gpt-4o-mini
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ainsight
DB_USER=postgres
DB_PASSWORD=postgres
```

## 🚨 Troubleshooting

### Port Already in Use
If ports 3000, 3001, or 5432 are in use:
1. Stop the conflicting service
2. Or edit `docker-compose.yml` to change ports:
   ```yaml
   ports:
     - "8080:3000"  # Change left side only
   ```

### Can't Connect to Backend
- Check if backend is running: `docker-compose logs backend`
- Verify health: `docker-compose ps`
- Check network: `docker network inspect ainsight-network`

### Database Issues
```bash
# Check database is running
docker-compose exec postgres pg_isready -U postgres

# View database logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U postgres -d ainsight
```

### Build Failures
```bash
# Clean Docker cache
docker-compose down
docker system prune -a

# Rebuild from scratch
docker-compose up --build --force-recreate
```

## 📚 Full Documentation

For complete details, see [DOCKER.md](DOCKER.md)

## ✅ Next Steps

1. **Configure .env file** with your OpenAI API key
2. **Choose deployment mode** (production or development)
3. **Run deployment script** or docker-compose command
4. **Access the app** at http://localhost:3000
5. **Configure database** via the UI (or use included PostgreSQL)

That's it! Your AInsight application is now running in Docker! 🎉

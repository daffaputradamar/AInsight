# AInsight Docker Development Environment Script (Windows)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AInsight Docker Development Environment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "⚠️  No .env file found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit .env file and add your OPENAI_API_KEY before continuing!" -ForegroundColor Yellow
    Write-Host "   Run: notepad .env" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter when you've added your API key"
}

Write-Host ""
Write-Host "📦 Building Docker images for development..." -ForegroundColor Green
docker-compose -f docker-compose.dev.yml build

Write-Host ""
Write-Host "🚀 Starting development services..." -ForegroundColor Green
docker-compose -f docker-compose.dev.yml up -d

Write-Host ""
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Development Environment Ready!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Access the application:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000"
Write-Host "   Backend:  http://localhost:3001"
Write-Host "   Database: localhost:5432"
Write-Host ""
Write-Host "🔥 Hot reload is enabled for:" -ForegroundColor Yellow
Write-Host "   - Frontend: app/, components/, lib/"
Write-Host "   - Backend: backend/src/"
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "   View logs:    docker-compose -f docker-compose.dev.yml logs -f"
Write-Host "   Stop:         docker-compose -f docker-compose.dev.yml down"
Write-Host "   Restart:      docker-compose -f docker-compose.dev.yml restart"
Write-Host ""
Write-Host "📖 For more information, see DOCKER.md" -ForegroundColor Cyan
Write-Host ""

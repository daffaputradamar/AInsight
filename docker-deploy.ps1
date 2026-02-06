# AInsight Docker Production Deployment Script (Windows)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AInsight Docker Production Deployment" -ForegroundColor Cyan
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

# Check if OPENAI_API_KEY is set
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "OPENAI_API_KEY=sk-") {
    Write-Host ""
    Write-Host "⚠️  Warning: OPENAI_API_KEY not properly set in .env file" -ForegroundColor Yellow
    Write-Host "   Make sure to add a valid OpenAI API key (starts with 'sk-')" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host ""
Write-Host "📦 Building Docker images..." -ForegroundColor Green
docker-compose build --no-cache

Write-Host ""
Write-Host "🚀 Starting services..." -ForegroundColor Green
docker-compose up -d

Write-Host ""
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Wait for backend health check
Write-Host "   Checking backend..." -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri http://localhost:3001/health -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✓ Backend is ready" -ForegroundColor Green
            break
        }
    } catch {
        if ($i -eq 30) {
            Write-Host "   ⚠️  Backend health check timeout" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

# Wait for frontend
Write-Host "   Checking frontend..." -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri http://localhost:3000 -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✓ Frontend is ready" -ForegroundColor Green
            break
        }
    } catch {
        if ($i -eq 30) {
            Write-Host "   ⚠️  Frontend health check timeout" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Access the application:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000"
Write-Host "   Backend:  http://localhost:3001"
Write-Host "   Database: localhost:5432"
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "   View logs:    docker-compose logs -f"
Write-Host "   Stop:         docker-compose down"
Write-Host "   Restart:      docker-compose restart"
Write-Host ""
Write-Host "📖 For more information, see DOCKER.md" -ForegroundColor Cyan
Write-Host ""

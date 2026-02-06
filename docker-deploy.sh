#!/bin/bash

# AInsight Docker Production Deployment Script

set -e

echo "=========================================="
echo "AInsight Docker Production Deployment"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and add your OPENAI_API_KEY before continuing!"
    echo "   Run: nano .env"
    echo ""
    read -p "Press Enter when you've added your API key..."
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo ""
    echo "⚠️  Warning: OPENAI_API_KEY not properly set in .env file"
    echo "   Make sure to add a valid OpenAI API key (starts with 'sk-')"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📦 Building Docker images..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Wait for backend health check
echo "   Checking backend..."
for i in {1..30}; do
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        echo "   ✓ Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  Backend health check timeout"
    fi
    sleep 2
done

# Wait for frontend
echo "   Checking frontend..."
for i in {1..30}; do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✓ Frontend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  Frontend health check timeout"
    fi
    sleep 2
done

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Database: localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo ""
echo "📖 For more information, see DOCKER.md"
echo ""

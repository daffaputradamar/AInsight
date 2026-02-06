#!/bin/bash

# AInsight Docker Development Environment Script

set -e

echo "=========================================="
echo "AInsight Docker Development Environment"
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

echo ""
echo "📦 Building Docker images for development..."
docker-compose -f docker-compose.dev.yml build

echo ""
echo "🚀 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "=========================================="
echo "✅ Development Environment Ready!"
echo "=========================================="
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Database: localhost:5432"
echo ""
echo "🔥 Hot reload is enabled for:"
echo "   - Frontend: app/, components/, lib/"
echo "   - Backend: backend/src/"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    docker-compose -f docker-compose.dev.yml logs -f"
echo "   Stop:         docker-compose -f docker-compose.dev.yml down"
echo "   Restart:      docker-compose -f docker-compose.dev.yml restart"
echo ""
echo "📖 For more information, see DOCKER.md"
echo ""

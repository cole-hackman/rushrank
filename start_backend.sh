#!/bin/bash
# RushRank Backend Startup Script

echo "🚀 Starting RushRank FastAPI Backend..."

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✓ Virtual environment activated"
else
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    echo "✓ Virtual environment created and activated"
fi

# Install dependencies if needed
if ! python -c "import uvicorn" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r python_server/requirements.txt
    echo "✓ Dependencies installed"
fi

# Start the server
echo "🌐 Starting server on http://localhost:8000"
python START_FASTAPI.py


#!/usr/bin/env bash
set -euo pipefail

# Keshin — One-command development setup script

echo "=== Keshin Development Setup ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Go
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | grep -oP 'go\K[0-9]+\.[0-9]+')
    echo "  ✓ Go $GO_VERSION found"
else
    echo "  ✗ Go not found. Please install Go 1.23+: https://go.dev/dl/"
    exit 1
fi

# Python/uv
if command -v uv &> /dev/null; then
    echo "  ✓ uv found"
elif command -v python3 &> /dev/null; then
    echo "  ✓ python3 found (uv recommended for faster setup: https://docs.astral.sh/uv/)"
else
    echo "  ✗ Python not found. Please install Python 3.11+: https://python.org/"
    exit 1
fi

# Node.js / Bun
if command -v bun &> /dev/null; then
    echo "  ✓ bun found"
elif command -v node &> /dev/null; then
    echo "  ✓ node found (bun recommended for faster setup: https://bun.sh/)"
else
    echo "  ✗ Node.js not found. Please install Node.js 20+: https://nodejs.org/"
    exit 1
fi

echo ""

# Step 1: Install Go dependencies
echo "=== Installing Go dependencies ==="
cd "$(dirname "$0")/.."
go mod download
echo "  ✓ Go dependencies installed"
echo ""

# Step 2: Install Python dependencies
echo "=== Installing Python dependencies ==="
cd ai
if command -v uv &> /dev/null; then
    uv sync
    echo "  ✓ Python dependencies installed (uv)"
else
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e ".[dev]"
    echo "  ✓ Python dependencies installed (pip)"
fi
cd ..
echo ""

# Step 3: Install frontend dependencies
echo "=== Installing frontend dependencies ==="
cd frontend
if command -v bun &> /dev/null; then
    bun install
    echo "  ✓ Frontend dependencies installed (bun)"
else
    npm install
    echo "  ✓ Frontend dependencies installed (npm)"
fi
cd ..
echo ""

# Step 4: Create default config if not present
if [ ! -f keshin.toml ]; then
    cat > keshin.toml << 'EOF'
# Keshin Configuration
mode = "web"

[server]
host = "0.0.0.0"
port = 8080

[llm]
provider = "groq"
model = "llama-3.3-70b-versatile"
max_tokens = 512
temperature = 0.7

[tts]
provider = "edge-tts"

[character]
default = "hinata"
packs_dir = "packs"
EOF
    echo "  ✓ Created default keshin.toml"
else
    echo "  ✓ keshin.toml already exists"
fi
echo ""

echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "  1. Set your LLM API key (optional for dev):"
echo "     export KESHIN_GROQ__API_KEY=gsk_your_key"
echo ""
echo "  2. Start the Python AI service:"
echo "     cd ai && uv run uvicorn keshin_ai.main:app --reload --port 9090"
echo ""
echo "  3. Start the Go server (in another terminal):"
echo "     go run ./cmd/keshin run --character hinata --port 8080"
echo ""
echo "  4. Start the frontend (in another terminal):"
echo "     cd frontend && bun run dev"
echo ""
echo "  5. Open http://localhost:5173 in your browser"
echo ""
echo "Or use 'task dev' to start everything with Taskfile."

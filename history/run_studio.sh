#!/bin/bash
# Launcher script for Rangachakua Heritage Restorer Studio

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=8080
export PORT

echo "==========================================================="
echo "  Starting Rangachakua Heritage Restorer Studio..."
echo "  Listening at: http://localhost:$PORT"
echo "==========================================================="

# Open browser if graphical session available
if which xdg-open > /dev/null; then
  (sleep 1 && xdg-open "http://localhost:$PORT") &
fi

python3 studio/app.py

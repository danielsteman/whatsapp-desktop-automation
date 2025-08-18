#!/bin/bash

echo "Setting up SQLite VSS extension..."

# Create extensions directory
mkdir -p extensions

# Download SQLite VSS extension for macOS ARM64
echo "Downloading SQLite VSS extension..."
curl -L -o extensions/sqlite-vss.dylib "https://github.com/asg017/sqlite-vss/releases/latest/download/sqlite-vss-darwin-aarch64.dylib"

# Make it executable
chmod +x extensions/sqlite-vss.dylib

# Create a symlink for the .so extension
ln -sf extensions/sqlite-vss.dylib sqlite-vss.so

echo "✅ SQLite VSS extension setup complete!"
echo "The extension is now available at: ./sqlite-vss.so"
echo ""
echo "Note: You may need to update the vssExtensionPath in src/database.ts"
echo "to point to: './extensions/sqlite-vss.dylib'"

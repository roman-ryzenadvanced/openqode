#!/bin/bash

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS=linux;;
    Darwin*)    OS=darwin;;
    *)          OS="UNKNOWN:${OS}"
esac

# Detect Arch
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64)    ARCH=x64;;
    arm64)     ARCH=arm64;;
    aarch64)   ARCH=arm64;;
    *)         ARCH="UNKNOWN:${ARCH}"
esac

if [[ "$OS" == *"UNKNOWN"* ]] || [[ "$ARCH" == *"UNKNOWN"* ]]; then
    echo "❌ Unsupported platform: $OS $ARCH"
    echo "Please download manually."
    exit 1
fi

BINARY_NAME="opencode-$OS-$ARCH"
# Windows uses .exe, but we are in bash script, mostly for nix.
# If running bash on windows (git bash), uname -s is MINGW...
if [[ "$OS" == *"MINGW"* ]] || [[ "$OS" == *"CYGWIN"* ]]; then
    BINARY_NAME="opencode-windows-x64.exe"
    TARGET_FILE="opencode.exe"
else
    TARGET_FILE="opencode"
fi

DOWNLOAD_URL="https://github.com/sst/opencode/releases/latest/download/$BINARY_NAME"
# Resolve script directory to handle running from root or scripts dir
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TARGET_DIR="$SCRIPT_DIR/../bin"
FULL_TARGET="$TARGET_DIR/$TARGET_FILE"

# Create bin dir
mkdir -p "$TARGET_DIR"

echo "Downloading OpenCode for $OS-$ARCH..."
echo "URL: $DOWNLOAD_URL"

# Download
if command -v curl &> /dev/null; then
    curl -L -o "$FULL_TARGET" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget -O "$FULL_TARGET" "$DOWNLOAD_URL"
else
    echo "❌ Neither curl nor wget found. Please install one."
    exit 1
fi

if [ -f "$FULL_TARGET" ]; then
    chmod +x "$FULL_TARGET"
    echo "✅ Download successful: $FULL_TARGET"
else
    echo "❌ Download failed."
    exit 1
fi

#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="packs/hinata"
MODEL_FILE="model.vrm"
MODEL_URL="https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm"

echo "Downloading VRM model for Hinata..."
echo "Source: three-vrm example models (Apache-2.0 license)"
echo "Target: ${MODEL_DIR}/${MODEL_FILE}"

mkdir -p "${MODEL_DIR}"

if command -v curl &>/dev/null; then
    curl -L -o "${MODEL_DIR}/${MODEL_FILE}" "${MODEL_URL}"
elif command -v wget &>/dev/null; then
    wget -O "${MODEL_DIR}/${MODEL_FILE}" "${MODEL_URL}"
else
    echo "Error: curl or wget required"
    exit 1
fi

echo "Done! Model saved to ${MODEL_DIR}/${MODEL_FILE}"
echo ""
echo "NOTE: This is a test model. For production, replace it with a"
echo "custom Hinata VRM model. Recommended sources:"
echo "  - VRoid Hub (https://hub.vroid.com/) — many CC0 models"
echo "  - Custom VRoid Studio export (free)"

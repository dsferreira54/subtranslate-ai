#!/usr/bin/env bash
set -euo pipefail

IMAGE="docker.io/dsferreira54/subtranslate-ai:latest"
REGISTRY="docker.io"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

if ! podman login --get-login "$REGISTRY" >/dev/null 2>&1; then
  echo "Not logged in to $REGISTRY. Running podman login..."
  podman login "$REGISTRY"
else
  echo "Already logged in to $REGISTRY as $(podman login --get-login "$REGISTRY")."
fi

echo "Building $IMAGE ..."
podman build -t "$IMAGE" .

echo "Pushing $IMAGE ..."
podman push "$IMAGE"

echo "Done: $IMAGE"

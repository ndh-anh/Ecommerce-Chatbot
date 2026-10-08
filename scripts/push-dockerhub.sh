#!/usr/bin/env bash
set -euo pipefail

# Build and publish one release for all services, using the VPS architecture.
if [[ $# -ne 3 ]]; then
  echo "Usage: bash scripts/push-dockerhub.sh <namespace> <tag> <public-api-url>" >&2
  echo "Example: bash scripts/push-dockerhub.sh myuser v1.0.0 https://api.example.com" >&2
  echo "Optional: IMAGE_PLATFORM=linux/arm64 (default: linux/amd64)" >&2
  exit 1
fi

namespace="$1"
tag="$2"
public_api_url="$3"
platform="${IMAGE_PLATFORM:-linux/amd64}"

if [[ ! "$namespace" =~ ^[a-z0-9][a-z0-9_-]*$ ]] ||
   [[ ! "$tag" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]] ||
   [[ ! "$public_api_url" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "Invalid Docker Hub namespace, image tag, or public API URL." >&2
  exit 1
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

docker info > /dev/null
docker buildx version > /dev/null

for image in e-commerce-api e-commerce-front e-commerce-order e-commerce-search ai-assistant e-commerce-migrations; do
  build_args=()
  if [[ "$image" == "e-commerce-front" ]]; then
    build_args+=(--build-arg "NEXT_PUBLIC_API_URL=$public_api_url")
  fi
  echo "Building and pushing $namespace/$image:$tag ($platform)"
  docker buildx build \
    --platform "$platform" \
    --file "docker/$image/dockerfile" \
    --tag "$namespace/$image:$tag" \
    "${build_args[@]}" \
    --push .
done

echo "Release published. Set DOCKERHUB_NAMESPACE=$namespace and IMAGE_TAG=$tag on the VPS."

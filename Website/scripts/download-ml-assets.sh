#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${MODEL_ROOT:-/app}"
MODEL_URL="${MODEL_URL:-}"
TRANSFORMER_URL="${TRANSFORMER_URL:-}"
MODEL_PATH="${MODEL_PATH:-${MODEL_DIR}/best_model_gradient_boosting.pkl}"
TRANSFORMER_PATH="${TRANSFORMER_PATH:-${MODEL_DIR}/column_transformer.pkl}"

mkdir -p "${MODEL_DIR}"

if [[ -z "${MODEL_URL}" || -z "${TRANSFORMER_URL}" ]]; then
  echo "MODEL_URL and TRANSFORMER_URL must be set to download ML assets" >&2
  exit 1
fi

if [[ ! -f "${MODEL_PATH}" ]]; then
  echo "Downloading model to ${MODEL_PATH}"
  curl -L "${MODEL_URL}" -o "${MODEL_PATH}"
fi

if [[ ! -f "${TRANSFORMER_PATH}" ]]; then
  echo "Downloading transformer to ${TRANSFORMER_PATH}"
  curl -L "${TRANSFORMER_URL}" -o "${TRANSFORMER_PATH}"
fi

echo "ML assets ready"

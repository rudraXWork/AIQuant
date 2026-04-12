#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT_DIR = Path("/Users/rudrajena/Desktop/Trade_Insights")
MODEL_PATH = ROOT_DIR / "best_model_gradient_boosting.pkl"
TRANSFORMER_PATH = ROOT_DIR / "column_transformer.pkl"

MODEL = joblib.load(MODEL_PATH)
CT = joblib.load(TRANSFORMER_PATH)

REQUIRED_FEATURES = list(CT.feature_names_in_)
OUTPUT_FEATURES = list(getattr(CT, "get_feature_names_out", lambda: [])())
if not OUTPUT_FEATURES and hasattr(MODEL, "feature_names_in_"):
    OUTPUT_FEATURES = list(MODEL.feature_names_in_)


def fail(message: str):
    sys.stdout.write(json.dumps({"ok": False, "error": message}))
    sys.exit(0)


def to_frame(rows):
    if not isinstance(rows, list) or not rows:
        fail("rows must be a non-empty list")
    frame = pd.DataFrame(rows)
    missing = [c for c in REQUIRED_FEATURES if c not in frame.columns]
    if missing:
        fail(f"missing required features: {', '.join(missing)}")
    return frame[REQUIRED_FEATURES]


def feature_importance_payload():
    importances = np.array(getattr(MODEL, "feature_importances_", []), dtype=float)
    names = list(getattr(MODEL, "feature_names_in_", OUTPUT_FEATURES))
    if len(importances) != len(names):
        return []
    total = float(np.sum(importances)) or 1.0
    pairs = [
        {"feature": names[i], "importance": float(importances[i]), "importancePct": float((importances[i] / total) * 100.0)}
        for i in range(len(names))
    ]
    pairs.sort(key=lambda x: x["importance"], reverse=True)
    return pairs


def predict_batch(rows):
    frame = to_frame(rows)
    transformed = CT.transform(frame)
    preds = MODEL.predict(transformed)
    importances = np.array(getattr(MODEL, "feature_importances_", []), dtype=float)
    names = list(getattr(MODEL, "feature_names_in_", OUTPUT_FEATURES))

    top_drivers = []
    if len(importances) == transformed.shape[1] and len(names) == transformed.shape[1]:
        for i in range(transformed.shape[0]):
            row_vals = np.asarray(transformed[i]).reshape(-1)
            contrib = np.abs(row_vals * importances)
            idx = int(np.argmax(contrib)) if contrib.size else 0
            top_drivers.append(
                {
                    "feature": names[idx] if names else "",
                    "score": float(contrib[idx]) if contrib.size else 0.0,
                }
            )
    else:
        top_drivers = [{"feature": "", "score": 0.0} for _ in range(len(rows))]

    return {
        "ok": True,
        "predictions": [float(x) for x in preds.tolist()],
        "topDrivers": top_drivers,
        "featureImportance": feature_importance_payload(),
        "requiredFeatures": REQUIRED_FEATURES,
    }


def meta():
    return {
        "ok": True,
        "modelType": type(MODEL).__name__,
        "requiredFeatures": REQUIRED_FEATURES,
        "outputFeatures": OUTPUT_FEATURES,
        "featureImportance": feature_importance_payload(),
    }


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        fail("missing stdin payload")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        fail("invalid json payload")

    mode = str(payload.get("mode", "predict_batch"))
    try:
        if mode == "meta":
            out = meta()
        elif mode == "predict_batch":
            out = predict_batch(payload.get("rows"))
        else:
            fail(f"unsupported mode: {mode}")
            return
    except Exception as exc:
        fail(str(exc))
        return

    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()

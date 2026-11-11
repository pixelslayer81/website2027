"""
Pyodide-side RPC bridge.

The web worker calls `dispatch(fn, payload_json, data, meta_json)` (exposed as
an async JS-callable proxy). Endpoint logic lives in main.py, unchanged from
the server build; upload endpoints are replicated here because their FastAPI
signatures (UploadFile) don't apply in the browser.
"""

import io
import json
import uuid

import numpy as np
from PIL import Image as PILImage

import main
import mask_processor
from schemas import ExportRequest, PreviewRequest, RenderDotsRequest

_MAX_UPLOAD = 20 * 1024 * 1024
_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def _upload_mask(data: bytes, meta: dict) -> dict:
    if meta.get("type") not in _ALLOWED_TYPES:
        raise ValueError("Only PNG, JPG, or WebP images are accepted.")
    if len(data) > _MAX_UPLOAD:
        raise ValueError("File exceeds 20 MB limit.")
    mask_id, w, h = mask_processor.process_uploaded_mask(
        data, meta.get("name") or "upload"
    )
    return {"mask_id": mask_id, "width": w, "height": h, "name": meta.get("name")}


def _upload_size_map(data: bytes, meta: dict) -> dict:
    if meta.get("type") not in _ALLOWED_TYPES:
        raise ValueError("Only PNG, JPG, or WebP images are accepted.")
    if len(data) > _MAX_UPLOAD:
        raise ValueError("File exceeds 20 MB limit.")
    img = PILImage.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img, dtype=np.float32) / 255.0
    size_map_id = f"sizemap_{uuid.uuid4().hex[:8]}"
    main._size_map_store[size_map_id] = arr
    return {"size_map_id": size_map_id}


async def dispatch(fn: str, payload: str = None, data=None, meta: str = None) -> str:
    meta_dict = json.loads(meta) if meta else {}
    raw = bytes(data.to_py()) if data is not None else None

    if fn == "upload_mask":
        return json.dumps(_upload_mask(raw, meta_dict))
    if fn == "upload_size_map":
        return json.dumps(_upload_size_map(raw, meta_dict))

    body = json.loads(payload) if payload else {}

    if fn == "outline":
        return json.dumps(main.outline(PreviewRequest(**body)))
    if fn == "shape_stroke":
        return json.dumps(main.shape_stroke(PreviewRequest(**body)))
    if fn == "preview":
        return json.dumps(main.preview(PreviewRequest(**body)))
    if fn == "dots":
        return json.dumps(main.dots(PreviewRequest(**body)))
    if fn == "image_preview":
        return json.dumps(main.image_preview_endpoint(PreviewRequest(**body)))
    if fn == "preview_size_map":
        result = await main.preview_size_map_endpoint(PreviewRequest(**body))
        return json.dumps(result)
    if fn == "export":
        resp = main.export(ExportRequest(**body))
        return json.dumps(resp.content)
    if fn == "render_dots":
        resp = main.render_dots(RenderDotsRequest(**body))
        return json.dumps(resp.content)

    raise ValueError(f"Unknown bridge function: {fn}")

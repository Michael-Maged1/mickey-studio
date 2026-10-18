"""Local LTX-Video worker for Mickey Studio (binds to loopback only)."""
from __future__ import annotations

import asyncio
import os
import tempfile
import threading
import uuid
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

LTX_ROOT = Path(os.environ.get("LTX_ROOT", "")).expanduser()
CONFIG = LTX_ROOT / "configs" / "ltxv-2b-0.9.8-distilled.yaml"
OUT_DIR = Path(os.environ.get("MICKEY_VIDEO_OUTPUT", Path.home() / "Videos" / "Mickey Studio"))
MAX_UPLOAD = 12 * 1024 * 1024
ALLOWED_ORIGINS = {
    "https://mickey-studio-eta.vercel.app",
    "http://localhost:8765",
    "http://127.0.0.1:8765",
    "null",  # Premiere UXP panels use an opaque origin.
}

app = FastAPI(title="Mickey Studio LTX Video Worker", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class PrivateNetworkAccessMiddleware:
    """Allow the HTTPS site to reach this loopback-only service in Chromium."""

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.application(scope, receive, send)

        async def send_with_pna(message):
            if message["type"] == "http.response.start":
                message["headers"].append((b"access-control-allow-private-network", b"true"))
            await send(message)

        await self.application(scope, receive, send_with_pna)


app.add_middleware(PrivateNetworkAccessMiddleware)
generation_lock = threading.Lock()


@app.get("/health")
async def health():
    return {
        "success": True,
        "worker": "ltx-video-2b-0.9.8-distilled",
        "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "ready": bool(torch.cuda.is_available() and CONFIG.is_file()),
    }


@app.post("/generate")
async def generate(
    prompt: str = Form(...),
    duration: int = Form(3),
    image: UploadFile = File(...),
):
    prompt = prompt.strip()
    if not prompt or len(prompt) > 1200:
        raise HTTPException(400, "اكتب وصفًا للحركة لا يتجاوز 1200 حرف.")
    if not torch.cuda.is_available():
        raise HTTPException(503, "لم يتم العثور على بطاقة NVIDIA/CUDA لتشغيل نموذج الفيديو محليًا.")
    if not CONFIG.is_file():
        raise HTTPException(503, "تعذر العثور على ملفات نموذج LTX. شغّل إعداد العامل المحلي أولًا.")
    if image.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "استخدم صورة PNG أو JPG أو WebP.")
    data = await image.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "حجم الصورة أكبر من 12 ميجابايت.")
    actual_duration = min(5, max(2, int(duration)))
    # LTX requires 8n+1 frames; keep local 3060 jobs capped at 5 seconds.
    frames = int(round((actual_duration * 24 - 1) / 8)) * 8 + 1
    suffix = ".png" if image.content_type == "image/png" else ".webp" if image.content_type == "image/webp" else ".jpg"
    with tempfile.TemporaryDirectory(prefix="mickey-ltx-") as tmp:
        temp = Path(tmp)
        image_path = temp / f"source{suffix}"
        image_path.write_bytes(data)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        job_output = OUT_DIR / f"ltx-{uuid.uuid4().hex}"
        from ltx_video.inference import InferenceConfig, infer

        config = InferenceConfig(
            prompt=prompt,
            output_path=str(job_output),
            pipeline_config=str(CONFIG),
            seed=int.from_bytes(os.urandom(4), "little"),
            height=480,
            width=832,
            num_frames=frames,
            frame_rate=24,
            conditioning_media_paths=[str(image_path)],
            conditioning_start_frames=[0],
            conditioning_strengths=[1.0],
            offload_to_cpu=True,
        )
        try:
            await asyncio.to_thread(_run_generation, infer, config)
        except torch.cuda.OutOfMemoryError as exc:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise HTTPException(503, "نفدت ذاكرة بطاقة الرسوم أثناء التوليد. أغلق التطبيقات التي تستخدم GPU ثم أعد المحاولة.") from exc
        outputs = sorted(job_output.glob("*.mp4"), key=lambda path: path.stat().st_mtime, reverse=True)
        if not outputs:
            raise HTTPException(502, "انتهى النموذج دون إنشاء ملف فيديو.")
        return FileResponse(
            outputs[0],
            media_type="video/mp4",
            filename="mickey-studio-ltx.mp4",
            headers={"X-Generated-Duration": str(actual_duration), "Access-Control-Expose-Headers": "X-Generated-Duration"},
            background=None,
        )


def _run_generation(infer, config):
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(409, "يوجد فيديو آخر قيد التوليد على هذا الجهاز.")
    try:
        infer(config)
    finally:
        generation_lock.release()

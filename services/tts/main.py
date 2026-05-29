"""
CosyVoice TTS Service — Independent AI service layer for speech synthesis.

Provides REST API for text-to-speech synthesis using Fun-CosyVoice3-0.5B model.
Designed to run as a standalone service alongside the game API.
"""

import os
import hashlib
import time
import logging
from pathlib import Path
from typing import Optional

import torch
import torchaudio
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cosyvoice-tts")

# ===== Configuration =====

MODEL_DIR = os.environ.get("COSYVOICE_MODEL_DIR", "pretrained_models/Fun-CosyVoice3-0.5B")
VOICES_DIR = Path(os.environ.get("VOICES_DIR", "./voices"))
AUDIO_CACHE_DIR = Path(os.environ.get("AUDIO_CACHE_DIR", "./audio_cache"))
MAX_TEXT_LENGTH = int(os.environ.get("MAX_TEXT_LENGTH", "2000"))
DEFAULT_SAMPLE_RATE = int(os.environ.get("DEFAULT_SAMPLE_RATE", "22050"))
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:4000,http://localhost:5173").split(",")

# Ensure directories exist
VOICES_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ===== App Setup =====

app = FastAPI(
    title="CosyVoice TTS Service",
    description="Text-to-speech synthesis service for interactive story game",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Model Loading =====

cosyvoice_model = None


def get_model():
    """Lazy-load the CosyVoice model on first request."""
    global cosyvoice_model
    if cosyvoice_model is None:
        logger.info(f"Loading CosyVoice model from {MODEL_DIR}...")
        try:
            from cosyvoice.cli.cosyvoice import CosyVoice2
            cosyvoice_model = CosyVoice2(MODEL_DIR, load_jit=False, load_trt=False)
            logger.info("CosyVoice model loaded successfully")
        except ImportError:
            logger.error("CosyVoice package not installed. Install from: https://github.com/FunAudioLLM/CosyVoice")
            raise HTTPException(500, "CosyVoice model not available")
        except Exception as e:
            logger.error(f"Failed to load CosyVoice model: {e}")
            raise HTTPException(500, f"Model loading failed: {e}")
    return cosyvoice_model


# ===== Request/Response Models =====

class VoiceConfig(BaseModel):
    mode: str = Field(default="zero_shot", description="Synthesis mode: zero_shot, instruct, sft")
    reference_audio: Optional[str] = Field(default=None, description="Path to reference audio file")
    instruct: Optional[str] = Field(default=None, description="Emotion/style instruction text")


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize")
    voice_id: str = Field(..., min_length=1, description="Voice identifier (character ID)")
    voice_config: Optional[VoiceConfig] = Field(default=None, description="Voice configuration")
    output_format: str = Field(default="mp3", description="Output audio format")
    sample_rate: int = Field(default=22050, description="Output sample rate")
    stream: bool = Field(default=False, description="Whether to stream output")


class SynthesizeResponse(BaseModel):
    audio_url: str
    duration_ms: int
    sample_rate: int
    cached: bool


class VoiceInfoResponse(BaseModel):
    id: str
    name: str
    language: str
    default_instruct: Optional[str] = None
    has_reference: bool = False


class HealthResponse(BaseModel):
    status: str
    model: str
    gpu: bool
    gpu_name: Optional[str] = None
    voices_count: int


# ===== Helper Functions =====

def get_cache_key(text: str, voice_id: str, instruct: str = "") -> str:
    """Generate a deterministic cache key for synthesis results."""
    content = f"{text}|{voice_id}|{instruct}"
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def get_voice_reference_path(voice_id: str) -> Optional[Path]:
    """Find the reference audio file for a voice."""
    for ext in [".wav", ".mp3", ".flac", ".ogg"]:
        path = VOICES_DIR / f"{voice_id}_ref{ext}"
        if path.exists():
            return path
    # Also check without _ref suffix
    for ext in [".wav", ".mp3", ".flac", ".ogg"]:
        path = VOICES_DIR / f"{voice_id}{ext}"
        if path.exists():
            return path
    return None


def get_audio_duration_ms(filepath: Path) -> int:
    """Get audio file duration in milliseconds."""
    try:
        info = sf.info(str(filepath))
        return int(info.duration * 1000)
    except Exception:
        return 0


def save_audio_to_file(audio_data, filepath: Path, sample_rate: int, output_format: str):
    """Save synthesized audio tensor to file."""
    # audio_data is expected to be a torch tensor or numpy array
    if hasattr(audio_data, "numpy"):
        audio_np = audio_data.numpy()
    else:
        audio_np = audio_data

    if output_format == "wav":
        sf.write(str(filepath), audio_np, sample_rate)
    else:
        # Save as wav first, then convert if needed
        wav_path = filepath.with_suffix(".wav")
        sf.write(str(wav_path), audio_np, sample_rate)

        if output_format == "mp3":
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_wav(str(wav_path))
            audio_seg.export(str(filepath), format="mp3", bitrate="128k")
            wav_path.unlink(missing_ok=True)
        elif output_format == "ogg":
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_wav(str(wav_path))
            audio_seg.export(str(filepath), format="ogg")
            wav_path.unlink(missing_ok=True)
        else:
            # Default to wav
            if filepath != wav_path:
                wav_path.rename(filepath)


# ===== API Endpoints =====

@app.post("/v1/tts/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest):
    """Synthesize speech from text. Returns a URL to the generated audio file."""
    if len(req.text) > MAX_TEXT_LENGTH:
        raise HTTPException(400, f"Text too long. Maximum {MAX_TEXT_LENGTH} characters.")

    instruct = req.voice_config.instruct if req.voice_config else ""
    cache_key = get_cache_key(req.text, req.voice_id, instruct or "")
    cache_filename = f"{cache_key}.{req.output_format}"
    cache_path = AUDIO_CACHE_DIR / cache_filename

    # Check cache
    if cache_path.exists():
        duration_ms = get_audio_duration_ms(cache_path)
        return SynthesizeResponse(
            audio_url=f"/v1/tts/audio/{cache_filename}",
            duration_ms=duration_ms,
            sample_rate=req.sample_rate,
            cached=True,
        )

    # Find reference audio
    voice_ref_path = get_voice_reference_path(req.voice_id)
    if voice_ref_path is None:
        raise HTTPException(404, f"Voice reference audio not found for: {req.voice_id}")

    # Synthesize
    model = get_model()
    start_time = time.time()

    try:
        # Load reference audio
        prompt_speech, sr = torchaudio.load(str(voice_ref_path))
        if sr != 16000:
            prompt_speech = torchaudio.functional.resample(prompt_speech, sr, 16000)

        # Run synthesis
        output_list = list(model.inference_zero_shot(
            tts_text=req.text,
            prompt_text="",
            prompt_speech_16k=prompt_speech,
            stream=False,
        ))

        if not output_list:
            raise HTTPException(500, "Synthesis produced no output")

        # Concatenate all output chunks
        audio_tensors = [chunk["tts_speech"] for chunk in output_list if "tts_speech" in chunk]
        if not audio_tensors:
            raise HTTPException(500, "No audio data in synthesis output")

        audio_output = torch.cat(audio_tensors, dim=-1).squeeze()

        # Resample if needed
        model_sr = 22050  # CosyVoice default output sample rate
        if req.sample_rate != model_sr:
            audio_output = torchaudio.functional.resample(audio_output, model_sr, req.sample_rate)

        # Save to cache
        save_audio_to_file(audio_output, cache_path, req.sample_rate, req.output_format)

        elapsed = time.time() - start_time
        duration_ms = get_audio_duration_ms(cache_path)
        logger.info(f"Synthesized {len(req.text)} chars for voice '{req.voice_id}' in {elapsed:.2f}s, duration={duration_ms}ms")

        return SynthesizeResponse(
            audio_url=f"/v1/tts/audio/{cache_filename}",
            duration_ms=duration_ms,
            sample_rate=req.sample_rate,
            cached=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synthesis failed: {e}", exc_info=True)
        raise HTTPException(500, f"Synthesis failed: {str(e)}")


@app.post("/v1/tts/stream")
async def stream_synthesize(req: SynthesizeRequest):
    """Stream synthesized audio chunks as they are generated."""
    if len(req.text) > MAX_TEXT_LENGTH:
        raise HTTPException(400, f"Text too long. Maximum {MAX_TEXT_LENGTH} characters.")

    voice_ref_path = get_voice_reference_path(req.voice_id)
    if voice_ref_path is None:
        raise HTTPException(404, f"Voice reference audio not found for: {req.voice_id}")

    model = get_model()

    # Load reference audio
    prompt_speech, sr = torchaudio.load(str(voice_ref_path))
    if sr != 16000:
        prompt_speech = torchaudio.functional.resample(prompt_speech, sr, 16000)

    instruct = req.voice_config.instruct if req.voice_config else ""

    mime_types = {"mp3": "audio/mpeg", "ogg": "audio/ogg", "wav": "audio/wav"}
    content_type = mime_types.get(req.output_format, "audio/mpeg")

    async def audio_generator():
        try:
            for chunk in model.inference_zero_shot(
                tts_text=req.text,
                prompt_text="",
                prompt_speech_16k=prompt_speech,
                stream=True,
            ):
                if "tts_speech" in chunk:
                    audio_tensor = chunk["tts_speech"].squeeze()
                    # Convert to bytes (16-bit PCM WAV chunks for simplicity in streaming)
                    audio_np = (audio_tensor.numpy() * 32767).astype("int16")
                    yield audio_np.tobytes()
        except Exception as e:
            logger.error(f"Stream synthesis error: {e}", exc_info=True)

    return StreamingResponse(
        audio_generator(),
        media_type=content_type,
        headers={"Transfer-Encoding": "chunked", "Cache-Control": "no-cache"},
    )


@app.get("/v1/tts/audio/{filename}")
async def get_audio(filename: str):
    """Serve a cached audio file."""
    # Validate filename to prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")

    filepath = AUDIO_CACHE_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "Audio file not found")

    mime_types = {".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac"}
    ext = filepath.suffix.lower()
    media_type = mime_types.get(ext, "application/octet-stream")

    return FileResponse(
        str(filepath),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/v1/tts/voices")
async def list_voices():
    """List all registered voice profiles (based on reference audio files in voices directory)."""
    voices = []
    seen = set()

    for path in VOICES_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in [".wav", ".mp3", ".flac", ".ogg"]:
            continue

        # Extract voice ID from filename (e.g., "qiaofeng_ref.wav" -> "qiaofeng")
        name = path.stem
        voice_id = name.replace("_ref", "")

        if voice_id in seen:
            continue
        seen.add(voice_id)

        voices.append(VoiceInfoResponse(
            id=voice_id,
            name=voice_id,
            language="zh",
            has_reference=True,
        ))

    return {"voices": voices}


@app.get("/v1/tts/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None

    # Count voice files
    voice_count = sum(1 for p in VOICES_DIR.iterdir() if p.is_file() and p.suffix.lower() in [".wav", ".mp3", ".flac"])

    return HealthResponse(
        status="ok",
        model=MODEL_DIR,
        gpu=gpu_available,
        gpu_name=gpu_name,
        voices_count=voice_count,
    )


@app.delete("/v1/tts/cache")
async def clear_cache():
    """Clear the audio cache directory."""
    count = 0
    for path in AUDIO_CACHE_DIR.iterdir():
        if path.is_file():
            path.unlink()
            count += 1
    logger.info(f"Cleared {count} cached audio files")
    return {"cleared": count}


# ===== Startup =====

@app.on_event("startup")
async def startup():
    logger.info(f"CosyVoice TTS Service starting...")
    logger.info(f"  Model dir: {MODEL_DIR}")
    logger.info(f"  Voices dir: {VOICES_DIR}")
    logger.info(f"  Cache dir: {AUDIO_CACHE_DIR}")
    logger.info(f"  GPU available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"  GPU: {torch.cuda.get_device_name(0)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "50001"))
    uvicorn.run(app, host="0.0.0.0", port=port)

FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    sox \
    libsox-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install CosyVoice (clone and install)
RUN git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git /opt/CosyVoice && \
    cd /opt/CosyVoice && \
    pip install --no-cache-dir -r requirements.txt

# Add CosyVoice to Python path
ENV PYTHONPATH="/opt/CosyVoice:${PYTHONPATH}"

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/voices /app/audio_cache

# Environment defaults
ENV COSYVOICE_MODEL_DIR=/app/pretrained_models/Fun-CosyVoice3-0.5B
ENV VOICES_DIR=/app/voices
ENV AUDIO_CACHE_DIR=/app/audio_cache
ENV PORT=50001

EXPOSE 50001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:50001/v1/tts/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "50001", "--workers", "1"]

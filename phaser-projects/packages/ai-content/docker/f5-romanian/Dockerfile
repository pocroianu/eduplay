FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu124 \
      torch torchvision torchaudio && \
    python -m pip install --no-cache-dir flask f5-tts huggingface_hub soundfile requests

RUN mkdir -p /app/models /app/reference

COPY f5-server.py /app/f5-server.py

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=600s --retries=3 \
    CMD python -c "import requests; r = requests.get('http://localhost:5001/health', timeout=5); raise SystemExit(0 if r.ok else 1)"

CMD ["python", "f5-server.py"]

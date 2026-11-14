FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Piper TTS and API dependencies.
# `pathvalidate` is imported by Piper's CLI at runtime but is not reliably
# installed transitively by piper-tts in this image; `requests` is used by the
# container healthcheck.
RUN pip install --no-cache-dir piper-tts flask pathvalidate requests

# Create voices directory
RUN mkdir -p /app/voices

# Download voice models (English and Romanian)
# These will be downloaded on first run or can be pre-downloaded
RUN wget -O /app/voices/en_US-lessac-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx && \
    wget -O /app/voices/en_US-lessac-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

RUN wget -O /app/voices/ro_RO-mihai-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx && \
    wget -O /app/voices/ro_RO-mihai-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx.json

# Copy Flask API server
COPY piper-server.py /app/piper-server.py

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python3 -c "import requests; requests.get('http://localhost:5000/health')" || exit 1

# Start Flask server
CMD ["python3", "piper-server.py"]

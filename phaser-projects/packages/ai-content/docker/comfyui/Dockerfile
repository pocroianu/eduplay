FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ARG COMFYUI_REALTIME_LORA_REF=main
ARG SD_SCRIPTS_REF=main

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-venv \
    python3-pip \
    git \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /app

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124 \
    && pip3 install --no-cache-dir -r requirements.txt

# Install SDXL LoRA training node toolkit for ComfyUI.
RUN mkdir -p /app/custom_nodes \
    && git clone --depth 1 --branch ${COMFYUI_REALTIME_LORA_REF} https://github.com/shootthesound/comfyUI-Realtime-Lora /app/custom_nodes/comfyUI-Realtime-Lora \
    && python3 -c "from pathlib import Path; path = Path('/app/custom_nodes/comfyUI-Realtime-Lora/sdxl_lora_trainer.py'); text = path.read_text(encoding='utf-8'); needle = '    DESCRIPTION = \\\"Trains an SDXL LoRA from images using kohya sd-scripts.\\\"\\n'; text = text if 'OUTPUT_NODE = True' in text or needle not in text else text.replace(needle, needle + '    OUTPUT_NODE = True\\n'); path.write_text(text, encoding='utf-8')" \
    && pip3 install --no-cache-dir -r /app/custom_nodes/comfyUI-Realtime-Lora/requirements.txt

# Install kohya sd-scripts backend used by the SDXL trainer node.
RUN mkdir -p /app/training \
    && git clone --depth 1 --branch ${SD_SCRIPTS_REF} https://github.com/kohya-ss/sd-scripts.git /app/training/sd-scripts \
    && python3 -m venv /app/training/sd-scripts/.venv \
    && /app/training/sd-scripts/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/training/sd-scripts/.venv/bin/pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124 \
    && cd /app/training/sd-scripts \
    && ./.venv/bin/pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /app/models/loras \
    && rm -rf /app/training/sd-scripts/output \
    && ln -s /app/models/loras /app/training/sd-scripts/output

# Create directories
RUN mkdir -p /app/models/checkpoints /app/output /app/input /app/workflows

# Download SDXL base model (will be cached in volume)
# Note: First run will download ~7GB, subsequent runs use cached version
RUN mkdir -p /app/models/checkpoints

# Expose port
EXPOSE 8188

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import requests; requests.get('http://localhost:8188/system_stats')" || exit 1

# Start ComfyUI
CMD ["python3", "main.py", "--listen", "0.0.0.0", "--port", "8188"]

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageDir = Split-Path -Parent $scriptDir
$runtimeDir = Join-Path $packageDir ".runtime\qwen-image"
$venvDir = Join-Path $runtimeDir ".venv"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is required. Install uv first, then rerun this script."
}

if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

Write-Host "Creating or reusing Qwen image environment at $venvDir"
uv venv $venvDir --python 3.12

Write-Host "Installing CUDA-enabled torch from the PyTorch cu128 index"
uv pip install --python $pythonExe --index-url https://download.pytorch.org/whl/cu128 torch

Write-Host "Installing Qwen runtime dependencies from PyPI"
uv pip install --python $pythonExe diffusers transformers accelerate sentencepiece safetensors pillow peft

Write-Host "Preparing patched local diffusers source overlay for Qwen"
& $pythonExe scripts\prepare-qwen-diffusers-source.py

Write-Host "Verifying CUDA visibility"
& $pythonExe -c "import torch; print({'torch': torch.__version__, 'cuda_available': torch.cuda.is_available(), 'cuda_version': torch.version.cuda, 'device_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None})"

Write-Host "Verifying diffusers import source"
& $pythonExe -c "import diffusers; print({'diffusers': diffusers.__version__, 'module': diffusers.__file__})"

Write-Host ""
Write-Host "Environment ready."
Write-Host "Run a dry-run spike:"
Write-Host "  $pythonExe scripts\qwen-image-spike.py"
Write-Host ""
Write-Host "Run a GPU-backed spike:"
Write-Host "  $pythonExe scripts\qwen-image-spike.py --execute --subjects fox --device cuda --memory-mode model-offload"

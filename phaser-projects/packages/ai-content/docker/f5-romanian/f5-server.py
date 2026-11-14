from __future__ import annotations

import os
import subprocess
import tempfile
import threading
from pathlib import Path

import soundfile as sf
from f5_tts.api import F5TTS
from flask import Flask, jsonify, request, send_file
from huggingface_hub import snapshot_download

app = Flask(__name__)

MODEL_REPO = os.environ.get("F5_MODEL_REPO", "cdorob/f5-tts-romanian")
MODEL_DIR = Path(os.environ.get("F5_MODEL_DIR", "/app/models/f5-tts-romanian"))
REF_AUDIO_PATH = Path(os.environ.get("F5_REF_AUDIO_PATH", "/app/reference/reference.wav"))
REF_TEXT = os.environ.get("F5_REF_TEXT", "").strip()
VOICE_ID = os.environ.get("F5_VOICE_ID", "f5-ro-reference")
VOICE_DESCRIPTION = os.environ.get("F5_VOICE_DESCRIPTION", "F5 Romanian reference voice")

_model_lock = threading.Lock()
_infer_lock = threading.Lock()
_model: F5TTS | None = None
_model_error: str | None = None
_model_loading = False
_model_retry_attempts = 0


def _load_model() -> F5TTS:
    global _model, _model_error, _model_retry_attempts

    with _model_lock:
        if _model is not None:
            return _model

        try:
            snapshot_download(
                repo_id=MODEL_REPO,
                local_dir=str(MODEL_DIR),
                allow_patterns=["model_last.pt", "vocab.txt"],
            )
            ckpt_file = MODEL_DIR / "model_last.pt"
            vocab_file = MODEL_DIR / "vocab.txt"
            if not ckpt_file.exists() or not vocab_file.exists():
                raise FileNotFoundError("Expected model_last.pt and vocab.txt after Hugging Face download")

            _model = F5TTS(
                model="F5TTS_v1_Base",
                ckpt_file=str(ckpt_file),
                vocab_file=str(vocab_file),
            )
            _model_error = None
            _model_retry_attempts = 0
            return _model
        except Exception as exc:
            _model_error = str(exc)
            raise

def _is_model_loading() -> bool:
    return _model is None and _model_error is None and _model_loading

def _preload_model() -> None:
    global _model_loading

    try:
        _model_loading = True
        _load_model()
    except Exception as exc:
        print(f"F5 model preload failed: {exc}", flush=True)
    finally:
        _model_loading = False


def _start_preload(reset_error: bool = True) -> None:
    global _model_error, _model_loading
    if _model is None and not _model_loading:
        if reset_error:
            _model_error = None
        _model_loading = True
        threading.Thread(target=_preload_model, daemon=True).start()


def _reference_error() -> str | None:
    if not REF_AUDIO_PATH.exists():
        return f"Reference audio not found: {REF_AUDIO_PATH}"
    try:
        info = sf.info(str(REF_AUDIO_PATH))
    except Exception as exc:
        return f"Invalid reference audio: {exc}"
    if getattr(info, "frames", 0) <= 0:
        return f"Reference audio is empty: {REF_AUDIO_PATH}"
    if not REF_TEXT:
        return "F5_REF_TEXT is required"
    return None


def _remove_file(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


@app.route("/health", methods=["GET"])
def health():
    global _model_retry_attempts

    ref_error = _reference_error()
    if ref_error is not None:
        return jsonify({"status": "unhealthy", "modelLoaded": _model is not None, "error": ref_error}), 503

    if _is_model_loading():
        return jsonify({"status": "unhealthy", "modelLoaded": False, "error": "F5 model is still loading"}), 503
    if _model is None and _model_error is not None:
        if _model_retry_attempts == 0:
            _model_retry_attempts = 1
            error = _model_error
            _start_preload()
            return jsonify({"status": "unhealthy", "modelLoaded": False, "error": f"F5 model preload failed; retrying: {error}"}), 503
        return jsonify({"status": "unhealthy", "modelLoaded": False, "error": _model_error}), 503

    try:
        _load_model()
    except Exception as exc:
        return jsonify({"status": "unhealthy", "modelLoaded": False, "error": str(exc)}), 503

    return jsonify({"status": "healthy", "service": "f5-romanian-tts", "modelLoaded": True}), 200


@app.route("/voices", methods=["GET"])
def voices():
    global _model_retry_attempts

    ref_error = _reference_error()
    if ref_error is not None:
        return jsonify({"error": ref_error}), 503
    if _is_model_loading():
        return jsonify({"error": "F5 model is still loading"}), 503
    if _model is None and _model_error is not None:
        if _model_retry_attempts == 0:
            _model_retry_attempts = 1
            error = _model_error
            _start_preload()
            return jsonify({"error": f"F5 model preload failed; retrying: {error}"}), 503
        return jsonify({"error": _model_error}), 503

    try:
        _load_model()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify({
        "service": "f5-romanian-tts",
        "voices": [{
            "language": "ro",
            "voice": VOICE_ID,
            "description": VOICE_DESCRIPTION,
            "gender": "neutral",
        }]
    }), 200


@app.route("/synthesize", methods=["POST"])
def synthesize():
    ref_error = _reference_error()
    if ref_error is not None:
        return jsonify({"error": ref_error}), 500

    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    language = data.get("language", "ro")
    requested_voice = str(data.get("voice", VOICE_ID))
    output_format = str(data.get("output_format", "wav")).lower()
    try:
        speed = float(data.get("speed", 1.0))
    except (TypeError, ValueError):
        return jsonify({"error": "Speed must be a number between 0.5 and 2.0"}), 400

    if not text:
        return jsonify({"error": "Text is required"}), 400
    if language != "ro":
        return jsonify({"error": f"Unsupported language: {language}"}), 400
    if speed < 0.5 or speed > 2.0:
        return jsonify({"error": "Speed must be between 0.5 and 2.0"}), 400
    if output_format not in {"wav", "mp3", "ogg"}:
        return jsonify({"error": f"Unsupported output format: {output_format}"}), 400
    if requested_voice != VOICE_ID:
        return jsonify({"error": f"Unsupported voice: {requested_voice}"}), 400
    output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    output_path = output_file.name
    output_file.close()
    converted_path = None

    try:
        model = _load_model()
        with _infer_lock:
            wav, sr, _spec = model.infer(
                ref_file=str(REF_AUDIO_PATH),
                ref_text=REF_TEXT,
                gen_text=text,
                speed=speed,
                file_wave=None,
                seed=None,
            )
        sf.write(output_path, wav, sr)

        duration = len(wav) / float(sr) if sr else 0
        headers = {
            "X-Audio-Duration": str(duration),
            "X-Audio-Sample-Rate": str(sr),
        }

        if output_format == "wav":
            response = send_file(output_path, mimetype="audio/wav", as_attachment=True, download_name="speech_ro.wav")
            response.headers.update(headers)
            response.call_on_close(lambda: _remove_file(output_path))
            return response

        converted_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_format}")
        converted_path = converted_file.name
        converted_file.close()
        subprocess.run(["ffmpeg", "-y", "-i", output_path, converted_path], check=True, capture_output=True)

        mime_type = "audio/mpeg" if output_format == "mp3" else "audio/ogg"
        response = send_file(
            converted_path,
            mimetype=mime_type,
            as_attachment=True,
            download_name=f"speech_ro.{output_format}",
        )
        response.headers.update(headers)

        def cleanup_response_files():
            _remove_file(output_path)
            _remove_file(converted_path)

        response.call_on_close(cleanup_response_files)
        return response
    except Exception as exc:
        _remove_file(output_path)
        if converted_path is not None:
            _remove_file(converted_path)
        return jsonify({"error": f"F5 inference failed: {exc}"}), 500


if __name__ == "__main__":
    if _reference_error() is None:
        _start_preload()
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)

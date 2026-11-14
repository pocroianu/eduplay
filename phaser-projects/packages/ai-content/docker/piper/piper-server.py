"""
Simple Flask API server for Piper TTS
Provides REST API for text-to-speech synthesis
"""

from flask import Flask, request, send_file, jsonify
import subprocess
import os
import tempfile
import hashlib

app = Flask(__name__)

VOICES_DIR = "/app/voices"
VOICE_MODELS = {
    "en": "en_US-lessac-medium",
    "ro": "ro_RO-mihai-medium"
}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "piper-tts"}), 200

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Synthesize speech from text

    Request body:
    {
        "text": "Text to synthesize",
        "language": "en" | "ro",
        "output_format": "wav" | "mp3"  (optional, default: wav)
    }

    Returns: Audio file (WAV or MP3)
    """
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'en')
        output_format = data.get('output_format', 'wav')

        if not text:
            return jsonify({"error": "Text is required"}), 400

        if language not in VOICE_MODELS:
            return jsonify({"error": f"Unsupported language: {language}"}), 400

        # Get voice model
        voice_model = VOICE_MODELS[language]
        model_path = os.path.join(VOICES_DIR, f"{voice_model}.onnx")

        if not os.path.exists(model_path):
            return jsonify({"error": f"Voice model not found: {voice_model}"}), 500

        # Create temp file for output
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            output_path = temp_file.name

        # Run Piper TTS
        try:
            result = subprocess.run(
                ['piper', '--model', model_path, '--output_file', output_path],
                input=text.encode('utf-8'),
                capture_output=True,
                check=True
            )

            # Return audio file
            return send_file(
                output_path,
                mimetype='audio/wav',
                as_attachment=True,
                download_name=f'speech_{language}.wav'
            )

        finally:
            # Cleanup temp file after sending
            if os.path.exists(output_path):
                os.remove(output_path)

    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"Piper TTS error: {e.stderr.decode()}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voices"""
    return jsonify({
        "voices": [
            {
                "language": "en",
                "voice": "en_US-lessac-medium",
                "description": "English (US) - Lessac - Medium quality"
            },
            {
                "language": "ro",
                "voice": "ro_RO-mihai-medium",
                "description": "Romanian - Mihai - Medium quality"
            }
        ]
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

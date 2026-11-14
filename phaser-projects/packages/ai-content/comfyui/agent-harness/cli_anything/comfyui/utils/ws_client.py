"""WebSocket client for real-time ComfyUI execution progress.

Connects to ws://<server>/ws?clientId=<uuid> and receives:
- progress: step N/M during sampling
- executing: which node is currently running
- execution_success / execution_error: completion events
- status: queue remaining count
- preview_image: binary preview data (ignored in CLI)
"""

import json
import sys
import threading
import time


def parse_ws_event(message) -> dict:
    """Parse a WebSocket message into a normalized event dict."""
    if isinstance(message, bytes):
        return {"type": "preview_image"}

    try:
        raw = json.loads(message)
    except (json.JSONDecodeError, TypeError):
        return {"type": "unknown", "raw": str(message)}

    msg_type = raw.get("type", "unknown")
    data = raw.get("data", {})

    if msg_type == "progress":
        return {
            "type": "progress",
            "value": data.get("value", 0),
            "max": data.get("max", 0),
            "prompt_id": data.get("prompt_id", ""),
            "node": data.get("node", ""),
        }
    elif msg_type == "executing":
        return {
            "type": "executing",
            "node": data.get("node"),
            "prompt_id": data.get("prompt_id", ""),
        }
    elif msg_type == "execution_start":
        return {
            "type": "execution_start",
            "prompt_id": data.get("prompt_id", ""),
        }
    elif msg_type == "execution_success":
        return {
            "type": "execution_success",
            "prompt_id": data.get("prompt_id", ""),
        }
    elif msg_type == "execution_error":
        return {
            "type": "execution_error",
            "prompt_id": data.get("prompt_id", ""),
            "node_id": data.get("node_id", ""),
            "error": data.get("exception_message", str(data)),
        }
    elif msg_type == "status":
        return {
            "type": "status",
            "queue_remaining": data.get("status", {}).get("queue_remaining", 0),
        }
    else:
        return {"type": msg_type, "data": data}


def format_progress(value: int, max_val: int, node_label: str = "") -> str:
    """Format a progress bar string for terminal display."""
    bar_width = 20
    if max_val > 0:
        filled = int(bar_width * value / max_val)
    else:
        filled = 0
    bar = "\u2588" * filled + "\u2591" * (bar_width - filled)
    text = f"[{bar}] {value}/{max_val}"
    if node_label:
        text += f" \u2014 {node_label}"
    return text


class ProgressWatcher:
    """WebSocket-based progress watcher for ComfyUI generation."""

    def __init__(self, base_url: str, client_id: str, json_mode: bool = False):
        self._base_url = base_url
        self._client_id = client_id
        self._json_mode = json_mode
        self._ws = None
        self._thread = None
        self._events: list[dict] = []
        self._lock = threading.Lock()
        self._done_event = threading.Event()
        self._target_prompt_id: str | None = None
        self._error: str | None = None

    def start(self):
        """Connect to WebSocket in a background thread."""
        try:
            import websocket
        except ImportError:
            raise RuntimeError(
                "websocket-client is required for progress tracking. "
                "Install with: pip install websocket-client"
            )

        ws_url = self._base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url.rstrip('/')}/ws?clientId={self._client_id}"

        self._ws = websocket.WebSocketApp(
            ws_url,
            on_message=self._on_message,
            on_error=self._on_ws_error,
            on_close=self._on_close,
        )
        self._thread = threading.Thread(target=self._ws.run_forever, daemon=True)
        self._thread.start()
        time.sleep(0.3)

    def _on_message(self, ws, message):
        event = parse_ws_event(message)
        with self._lock:
            self._events.append(event)

        prompt_id = event.get("prompt_id", "")

        if event["type"] == "progress":
            line = format_progress(event["value"], event["max"], event.get("node", ""))
            if self._json_mode:
                print(json.dumps(event), flush=True)
            else:
                print(f"\r  {line}", end="", flush=True, file=sys.stderr)
        elif event["type"] == "executing" and event.get("node"):
            if self._json_mode:
                print(json.dumps(event), flush=True)
        elif event["type"] == "execution_success":
            if self._json_mode:
                print(json.dumps(event), flush=True)
            if self._target_prompt_id and prompt_id == self._target_prompt_id:
                self._done_event.set()
        elif event["type"] == "execution_error":
            self._error = event.get("error", "Unknown error")
            if self._json_mode:
                print(json.dumps(event), flush=True)
            if self._target_prompt_id and prompt_id == self._target_prompt_id:
                self._done_event.set()
        elif event["type"] == "executing" and event.get("node") is None:
            if self._target_prompt_id and prompt_id == self._target_prompt_id:
                self._done_event.set()

    def _on_ws_error(self, ws, error):
        self._error = str(error)
        self._done_event.set()

    def _on_close(self, ws, close_status_code, close_msg):
        self._done_event.set()

    def wait_for_completion(self, prompt_id: str, timeout: float = 300) -> dict:
        """Block until the given prompt completes or times out."""
        self._target_prompt_id = prompt_id
        self._done_event.clear()

        if not self._done_event.wait(timeout=timeout):
            raise RuntimeError(f"Timeout waiting for prompt {prompt_id} after {timeout}s")

        if self._error:
            raise RuntimeError(f"Generation failed: {self._error}")

        with self._lock:
            events = list(self._events)

        return {"status": "success", "events": events}

    def stop(self):
        """Close the WebSocket connection."""
        if self._ws:
            self._ws.close()
        if self._thread:
            self._thread.join(timeout=5)

    @property
    def events(self) -> list[dict]:
        with self._lock:
            return list(self._events)

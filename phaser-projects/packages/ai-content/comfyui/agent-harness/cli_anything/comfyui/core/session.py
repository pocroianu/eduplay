"""Session management — persist CLI state between invocations.

Tracks server URL, client ID, recent prompt IDs, and action history.
Session file: <session_dir>/session.json (default: ~/.comfyui-cli/)
"""

import json
import os
import uuid
from datetime import datetime, timezone


_MAX_HISTORY = 100
_MAX_PROMPT_IDS = 20


class Session:
    """Persistent CLI session state."""

    def __init__(self, session_dir: str | None = None, server_url: str | None = None):
        if session_dir is None:
            session_dir = os.path.join(os.path.expanduser("~"), ".comfyui-cli")
        self._session_dir = session_dir
        self._session_file = os.path.join(session_dir, "session.json")

        # Defaults
        self.server_url: str = server_url or "http://localhost:8188"
        self.client_id: str = str(uuid.uuid4())
        self.last_prompt_ids: list[str] = []
        self.active_workflow_path: str | None = None
        self.history: list[dict] = []

        # Load existing session if present
        self._load()

        # Override server_url if explicitly provided
        if server_url is not None:
            self.server_url = server_url

    def _load(self):
        """Load session from disk if it exists."""
        if not os.path.exists(self._session_file):
            return
        try:
            with open(self._session_file, "r") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return
            self.server_url = data.get("server_url", self.server_url)
            self.client_id = data.get("client_id", self.client_id)
            self.last_prompt_ids = data.get("last_prompt_ids", [])
            self.active_workflow_path = data.get("active_workflow_path")
            self.history = data.get("history", [])
        except (json.JSONDecodeError, OSError):
            pass

    def save(self):
        """Persist session to disk with atomic write."""
        os.makedirs(self._session_dir, exist_ok=True)
        data = {
            "server_url": self.server_url,
            "client_id": self.client_id,
            "last_prompt_ids": self.last_prompt_ids,
            "active_workflow_path": self.active_workflow_path,
            "history": self.history,
        }
        tmp = self._session_file + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, self._session_file)

    def record_prompt(self, prompt_id: str, action: str, params: dict):
        """Record a prompt submission in session history."""
        self.last_prompt_ids.append(prompt_id)
        self.last_prompt_ids = self.last_prompt_ids[-_MAX_PROMPT_IDS:]

        self.history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "prompt_id": prompt_id,
            "params": params,
        })
        self.history = self.history[-_MAX_HISTORY:]
        self.save()

    @property
    def last_prompt_id(self) -> str | None:
        """Most recent prompt ID, or None."""
        return self.last_prompt_ids[-1] if self.last_prompt_ids else None

    def to_dict(self) -> dict:
        """Return session state as a dict (for --json output)."""
        return {
            "server_url": self.server_url,
            "client_id": self.client_id,
            "last_prompt_id": self.last_prompt_id,
            "active_workflow_path": self.active_workflow_path,
            "history_count": len(self.history),
        }

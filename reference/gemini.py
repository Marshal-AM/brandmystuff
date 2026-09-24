"""Ask Gemini a question, optionally about an image.

Cheapest image-capable model this key can call. gemini-2.5-flash-lite is
cheaper on the price list ($0.10 / $0.40 per 1M tokens) but is closed to
new users. gemini-3.1-flash-lite is the next cheapest: $0.25 / 1M input
tokens (text and image), $1.50 / 1M output tokens.
https://ai.google.dev/gemini-api/docs/pricing

Usage:
    python gemini.py "Say hello in one sentence."
    python gemini.py photo.jpg "What brand is on this item?"
"""

import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_env(path: Path) -> None:
    """Read KEY=value lines from a local .env file into the environment."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env(Path(__file__).with_name(".env"))
API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-3.1-flash-lite"
URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{MODEL}:generateContent"
)

IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def generate(prompt: str, image_path: Path | None = None) -> str:
    if not API_KEY:
        raise SystemExit("Set GEMINI_API_KEY in reference/.env (see .env.example).")
    parts: list[dict] = [{"text": prompt}]
    if image_path is not None:
        mime = IMAGE_TYPES.get(image_path.suffix.lower()) or mimetypes.guess_type(
            image_path.name
        )[0]
        if not mime or not mime.startswith("image/"):
            raise SystemExit(f"Not a supported image: {image_path}")
        parts.append(
            {
                "inline_data": {
                    "mime_type": mime,
                    "data": base64.b64encode(image_path.read_bytes()).decode("ascii"),
                }
            }
        )

    body = json.dumps(
        {
            "contents": [{"parts": parts}],
            "generationConfig": {"thinkingConfig": {"thinkingBudget": 0}},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Gemini API error {error.code}: {detail}") from error

    try:
        return payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as error:
        raise SystemExit(f"Unexpected response: {json.dumps(payload, indent=2)}") from error


def main() -> None:
    args = sys.argv[1:]
    image_path = None
    if args and Path(args[0]).is_file() and Path(args[0]).suffix.lower() in IMAGE_TYPES:
        image_path = Path(args[0])
        args = args[1:]

    prompt = " ".join(args).strip()
    if image_path and not prompt:
        prompt = "Describe this image."
    if not prompt:
        prompt = "Reply with the single word: pong"

    print(generate(prompt, image_path))


if __name__ == "__main__":
    main()

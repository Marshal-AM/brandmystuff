"""Ask Groq a question, optionally about an image.

Model: qwen/qwen3.8-27b — 27B multimodal, text + images, 131K context.

Usage:
    python groq.py "Say hello in one sentence."
    python groq.py photo.jpg "What brand is on this item?"
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
API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL = "qwen/qwen3.8-27b"
URL = "https://api.groq.com/openai/v1/chat/completions"

IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def generate(prompt: str, image_path: Path | None = None) -> str:
    if not API_KEY:
        raise SystemExit("Set GROQ_API_KEY in reference/.env (see .env.example).")
    content: list[dict] = [{"type": "text", "text": prompt}]
    if image_path is not None:
        mime = IMAGE_TYPES.get(image_path.suffix.lower()) or mimetypes.guess_type(
            image_path.name
        )[0]
        if not mime or not mime.startswith("image/"):
            raise SystemExit(f"Not a supported image: {image_path}")
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{encoded}"},
            }
        )

    body = json.dumps(
        {
            "model": MODEL,
            "messages": [{"role": "user", "content": content}],
            "temperature": 1,
            "max_completion_tokens": 512,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
            "User-Agent": "brandmystuff-groq-cli/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Groq API error {error.code}: {detail}") from error

    try:
        return payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
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

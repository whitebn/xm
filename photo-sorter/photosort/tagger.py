"""Describe and tag images with Claude vision.

Privacy: this sends a downscaled copy (max 1024 px) of each image to the Anthropic API.
Nothing is sent unless you pass --ai and confirm.
"""
from __future__ import annotations

import base64
import io
import json
import threading
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps

DEFAULT_MODEL = "claude-haiku-5-5"
MAX_SIDE = 1024

SCENES = [
    "beach", "city", "nature", "mountain", "food", "people", "pet", "indoor", "event",
    "vehicle", "landmark", "art", "document", "screenshot", "other",
]

SCHEMA = {
    "type": "object",
    "properties": {
        "caption": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "scene": {"type": "string", "enum": SCENES},
        "text_in_image": {"type": "string"},
        "contains_people": {"type": "boolean"},
    },
    "required": ["caption", "tags", "scene", "text_in_image", "contains_people"],
    "additionalProperties": False,
}

PROMPT = (
    "Describe this image for a personal photo library search index.\n"
    "- caption: one plain sentence saying what is in the frame.\n"
    "- tags: 5 to 12 lowercase search keywords (objects, setting, activity, colors, mood). Single words or short phrases.\n"
    "- scene: the best single category.\n"
    "- text_in_image: any clearly legible text (signs, screenshots, documents), else an empty string.\n"
    "- contains_people: true if a person is visible.\n"
    "Only describe what is visible. Do not guess names of people or exact places unless a sign or caption shows it."
)


@dataclass
class Tags:
    caption: str
    tags: list[str]
    scene: str
    text_in_image: str = ""
    contains_people: bool = False

    @classmethod
    def from_json(cls, data: dict) -> "Tags":
        return cls(
            caption=str(data.get("caption", "")).strip(),
            tags=[str(t).strip().lower() for t in data.get("tags", []) if str(t).strip()],
            scene=str(data.get("scene", "other")),
            text_in_image=str(data.get("text_in_image", "")).strip(),
            contains_people=bool(data.get("contains_people", False)),
        )


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    calls: int = 0
    failures: list[str] = field(default_factory=list)


def prepare_image(path: Path, max_side: int = MAX_SIDE) -> bytes:
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


class ClaudeTagger:
    def __init__(self, model: str = DEFAULT_MODEL, client=None):
        if client is None:
            import anthropic  # imported lazily so the rest of the tool works without it

            client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY or an `ant auth login` profile
        self.client = client
        self.model = model
        self.usage = Usage()
        self._lock = threading.Lock()  # tag() runs from several threads

    def _fail(self, msg: str) -> None:
        with self._lock:
            self.usage.failures.append(msg)

    def tag(self, path: Path) -> Tags | None:
        """Return tags, or None if the image could not be tagged (reason is added to usage.failures)."""
        import anthropic

        data = base64.standard_b64encode(prepare_image(path)).decode("ascii")
        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
                        {"type": "text", "text": PROMPT},
                    ],
                }],
            )
        except anthropic.BadRequestError as e:  # not retryable: this image or request shape is the problem
            self._fail(f"{path.name}: bad request: {e.message}")
            return None
        except anthropic.APIStatusError as e:  # SDK already retried 429/5xx
            self._fail(f"{path.name}: API error {e.status_code}")
            return None
        except anthropic.APIConnectionError:
            self._fail(f"{path.name}: connection error")
            return None

        with self._lock:
            self.usage.calls += 1
            self.usage.input_tokens += resp.usage.input_tokens
            self.usage.output_tokens += resp.usage.output_tokens
        if resp.stop_reason in ("refusal", "max_tokens"):
            self._fail(f"{path.name}: stopped with {resp.stop_reason}")
            return None
        text = next((b.text for b in resp.content if b.type == "text"), None)
        if text is None:
            self._fail(f"{path.name}: no text block")
            return None
        try:
            return Tags.from_json(json.loads(text))
        except json.JSONDecodeError:
            self._fail(f"{path.name}: invalid JSON")
            return None

"""Image validation, compression, and private on-disk storage.

Uploads are never served directly from a predictable public path. Each stored
file gets a random, unguessable name and lives under ``UPLOAD_DIR``. Access to
images is controlled through an authenticated endpoint so a farmer's crop photos
stay private.
"""

import io
import secrets
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

from ..config import settings


@dataclass
class ValidatedImage:
    bytes: bytes
    mime_type: str
    width: int
    height: int
    format: str


class ImageValidationError(Exception):
    """Raised when an upload is rejected (bad type, too large, or unsafe)."""


class ImageValidator:
    """Validates that uploaded bytes are a genuine, in-policy image."""

    MAX_LONG_EDGE = 1920  # downscale very large photos to keep them manageable
    JPEG_QUALITY = 85

    def validate(self, raw: bytes, declared_mime: str) -> ValidatedImage:
        if not raw:
            raise ImageValidationError("The uploaded file is empty.")

        max_bytes = settings.MAX_IMAGE_UPLOAD_MB * 1024 * 1024
        if len(raw) > max_bytes:
            raise ImageValidationError(
                f"Image is too large. Maximum allowed is "
                f"{settings.MAX_IMAGE_UPLOAD_MB} MB."
            )

        # Verify it is a real image and detect its format (defense against
        # renamed/polyglot files). We open with Pillow and re-save.
        try:
            img = Image.open(io.BytesIO(raw))
            img.load()
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageValidationError(
                "The file could not be read as an image. Use a JPEG, PNG, or "
                "WebP photo of the leaf."
            ) from exc

        # Only allow safe raster formats.
        fmt = (img.format or "").upper()
        allowed = {"JPEG", "PNG", "WEBP"}
        if fmt not in allowed:
            raise ImageValidationError("Unsupported image format. Use JPEG, PNG, or WebP.")

        # Drop alpha / palette quirks and normalize to RGB for JPEG re-encode.
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Downscale if huge, preserving aspect ratio.
        w, h = img.size
        scale = min(1.0, self.MAX_LONG_EDGE / max(w, h))
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        # Re-encode to normalize and strip potentially embedded metadata/EXIF
        # payloads that can carry sensitive data or exploit payloads.
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=self.JPEG_QUALITY, optimize=True)
        out_bytes = buffer.getvalue()

        return ValidatedImage(
            bytes=out_bytes,
            mime_type="image/jpeg",
            width=img.width,
            height=img.height,
            format="JPEG",
        )


class ImageStore:
    """Saves validated images to the private upload directory."""

    def __init__(self, upload_dir: str | None = None) -> None:
        import os

        self.upload_dir = upload_dir or settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    def save(self, image: ValidatedImage) -> str:
        """Persist the image and return its unguessable stored filename."""
        token = secrets.token_urlsafe(16)
        filename = f"{token}.jpg"
        path = self._path(filename)
        with open(path, "wb") as f:
            f.write(image.bytes)
        return filename

    def path_for(self, stored_filename: str) -> str:
        """Return the absolute path for a previously stored filename."""
        return self._path(stored_filename)

    def _path(self, filename: str) -> str:
        import os

        # Prevent path traversal: keep only the basename.
        safe = os.path.basename(filename)
        return os.path.join(self.upload_dir, safe)

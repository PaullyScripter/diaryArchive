import io
import logging

from PIL import Image, ImageOps

from app.core.media_validator import MAX_PIXELS

logger = logging.getLogger(__name__)

THUMBNAIL_SIZE = (150, 150)
STANDARD_WIDTH = 1200

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def _strip_exif(img: Image.Image) -> None:
    img.info.pop("exif", None)
    exif = img.getexif()
    if exif:
        exif.clear()


def _open_and_orient(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    return ImageOps.exif_transpose(img)


def convert_to_webp(image_bytes: bytes, quality: int = 82) -> bytes:
    img = _open_and_orient(image_bytes)
    _strip_exif(img)
    output = io.BytesIO()
    img.save(output, format="WEBP", quality=quality)
    return output.getvalue()


def generate_standard(image_bytes: bytes) -> bytes:
    img = _open_and_orient(image_bytes)
    _strip_exif(img)
    width, height = img.size
    if width > STANDARD_WIDTH:
        ratio = STANDARD_WIDTH / width
        new_height = int(height * ratio)
        img = img.resize((STANDARD_WIDTH, new_height), Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="WEBP", quality=82)
    return output.getvalue()


def generate_thumbnail(image_bytes: bytes) -> bytes:
    img = _open_and_orient(image_bytes)
    _strip_exif(img)
    img = ImageOps.fit(
        img,
        THUMBNAIL_SIZE,
        method=Image.LANCZOS,
        centering=(0.5, 0.5),
    )
    output = io.BytesIO()
    img.save(output, format="WEBP", quality=80)
    return output.getvalue()


def get_image_dimensions(image_bytes: bytes) -> tuple[int, int]:
    img = _open_and_orient(image_bytes)
    return img.size


def process_image(image_bytes: bytes) -> dict[str, bytes]:
    img = _open_and_orient(image_bytes)
    _strip_exif(img)

    original_buf = io.BytesIO()
    img.save(original_buf, format="WEBP", quality=82)
    original = original_buf.getvalue()

    width, height = img.size
    if width > STANDARD_WIDTH:
        ratio = STANDARD_WIDTH / width
        std_img = img.resize((STANDARD_WIDTH, int(height * ratio)), Image.LANCZOS)
    else:
        std_img = img
    std_buf = io.BytesIO()
    std_img.save(std_buf, format="WEBP", quality=82)
    standard = std_buf.getvalue()

    thumb = ImageOps.fit(img, THUMBNAIL_SIZE, method=Image.LANCZOS, centering=(0.5, 0.5))
    thumb_buf = io.BytesIO()
    thumb.save(thumb_buf, format="WEBP", quality=80)
    thumbnail = thumb_buf.getvalue()

    return {"original": original, "standard": standard, "thumbnail": thumbnail}

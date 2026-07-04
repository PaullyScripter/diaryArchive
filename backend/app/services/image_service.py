import io
import logging

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

THUMBNAIL_SIZE = (150, 150)
STANDARD_WIDTH = 1200


def _strip_exif(img: Image.Image) -> Image.Image:
    data = list(img.getdata())
    new_img = Image.new(img.mode, img.size)
    new_img.putdata(data)
    if img.info:
        exif = img.info.get("exif")
        if exif:
            new_img.info["exif"] = exif
    return new_img


def _exif_preserved_from_src(img: Image.Image) -> bytes | None:
    return img.info.get("exif")


def convert_to_webp(image_bytes: bytes, quality: int = 82) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    exif_raw = _exif_preserved_from_src(img)
    img = _strip_exif(img)
    output = io.BytesIO()
    save_kwargs: dict = {"format": "WEBP", "quality": quality}
    if exif_raw:
        save_kwargs["exif"] = exif_raw
    img.save(output, **save_kwargs)
    return output.getvalue()


def generate_standard(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    exif_raw = _exif_preserved_from_src(img)
    img = _strip_exif(img)
    width, height = img.size
    if width > STANDARD_WIDTH:
        ratio = STANDARD_WIDTH / width
        new_height = int(height * ratio)
        img = img.resize((STANDARD_WIDTH, new_height), Image.LANCZOS)
    output = io.BytesIO()
    save_kwargs: dict = {"format": "WEBP", "quality": 82}
    if exif_raw:
        save_kwargs["exif"] = exif_raw
    img.save(output, **save_kwargs)
    return output.getvalue()


def generate_thumbnail(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    img = _strip_exif(img)
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
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    return img.size


def process_image(image_bytes: bytes) -> dict[str, bytes]:
    original = convert_to_webp(image_bytes)
    standard = generate_standard(image_bytes)
    thumbnail = generate_thumbnail(image_bytes)
    return {
        "original": original,
        "standard": standard,
        "thumbnail": thumbnail,
    }

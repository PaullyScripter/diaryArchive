import pytest
from app.core.media_validator import detect_mime_type, is_allowed_mime, get_max_size, mime_category


class TestDetectMimeType:
    def test_detect_jpeg(self):
        data = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01"
        assert detect_mime_type(data) == "image/jpeg"

    def test_detect_png(self):
        data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        assert detect_mime_type(data) == "image/png"

    def test_detect_gif87a(self):
        data = b"GIF87a" + b"\x00" * 20
        assert detect_mime_type(data) == "image/gif"

    def test_detect_gif89a(self):
        data = b"GIF89a" + b"\x00" * 20
        assert detect_mime_type(data) == "image/gif"

    def test_detect_webp(self):
        data = b"RIFF\x10\x00\x00\x00WEBP" + b"\x00" * 10
        assert detect_mime_type(data) == "image/webp"

    def test_detect_avif(self):
        data = b"\x00\x00\x00\x18ftypavif\x00\x00\x00\x00avif" + b"\x00" * 10
        assert detect_mime_type(data) == "image/avif"

    def test_detect_webm(self):
        data = b"\x1aE\xdf\xa3" + b"\x00" * 20
        assert detect_mime_type(data) == "video/webm"

    def test_detect_mp4(self):
        data = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42" + b"\x00" * 10
        assert detect_mime_type(data) == "video/mp4"

    def test_detect_mp4_isom(self):
        data = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isom" + b"\x00" * 10
        assert detect_mime_type(data) == "video/mp4"

    def test_detect_ogg(self):
        data = b"OggS" + b"\x00" * 20
        assert detect_mime_type(data) == "audio/ogg"

    def test_detect_wav(self):
        data = b"RIFF\x08\x00\x00\x00WAVE" + b"\x00" * 10
        assert detect_mime_type(data) == "audio/wav"

    def test_detect_mp3_id3(self):
        data = b"ID3\x03\x00\x00\x00\x00\x00" + b"\x00" * 20
        assert detect_mime_type(data) == "audio/mpeg"

    def test_detect_mp3_frame_sync(self):
        data = b"\xff\xfb\x90\x00" + b"\x00" * 20
        assert detect_mime_type(data) == "audio/mpeg"

    def test_detect_mp4_audio(self):
        data = b"\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00M4A " + b"\x00" * 10
        assert detect_mime_type(data) == "audio/mp4"

    def test_reject_executable(self):
        data = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_zip_disguised_as_image(self):
        data = b"PK\x03\x04" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_empty_data(self):
        assert detect_mime_type(b"") is None
        assert detect_mime_type(b"\x00\x00\x00") is None

    def test_reject_html_disguised_as_image(self):
        data = b"<html>" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_pdf(self):
        data = b"%PDF-1.4" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_renamed_exe_as_jpeg(self):
        data = b"MZ\x90\x00" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_svg_xml(self):
        data = b'<?xml version="1.0"?><svg>' + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_svg_no_xml(self):
        data = b"<svg>" + b"\x00" * 20
        assert detect_mime_type(data) is None

    def test_reject_html(self):
        data = b"<!DOCTYPE html>" + b"\x00" * 20
        assert detect_mime_type(data) is None


class TestIsAllowedMime:
    def test_allowed_images(self):
        assert is_allowed_mime("image/jpeg") is True
        assert is_allowed_mime("image/png") is True
        assert is_allowed_mime("image/webp") is True
        assert is_allowed_mime("image/gif") is True
        assert is_allowed_mime("image/avif") is True

    def test_allowed_video(self):
        assert is_allowed_mime("video/mp4") is True
        assert is_allowed_mime("video/webm") is True

    def test_allowed_audio(self):
        assert is_allowed_mime("audio/mpeg") is True
        assert is_allowed_mime("audio/ogg") is True
        assert is_allowed_mime("audio/wav") is True

    def test_disallowed_types(self):
        assert is_allowed_mime("application/pdf") is False
        assert is_allowed_mime("application/x-msdownload") is False
        assert is_allowed_mime("text/html") is False
        assert is_allowed_mime("application/zip") is False


class TestGetMaxSize:
    def test_image_size_limit(self):
        assert get_max_size("image/jpeg") == 10 * 1024 * 1024

    def test_video_size_limit(self):
        assert get_max_size("video/mp4") == 50 * 1024 * 1024

    def test_audio_size_limit(self):
        assert get_max_size("audio/mpeg") == 30 * 1024 * 1024

    def test_unknown_type_size(self):
        assert get_max_size("application/pdf") == 0


class TestMimeCategory:
    def test_image_category(self):
        assert mime_category("image/jpeg") == "image"
        assert mime_category("image/png") == "image"

    def test_video_category(self):
        assert mime_category("video/mp4") == "video"

    def test_audio_category(self):
        assert mime_category("audio/mpeg") == "audio"

    def test_other_category(self):
        assert mime_category("application/pdf") == "other"

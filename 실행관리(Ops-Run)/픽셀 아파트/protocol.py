"""REA 복원 헤더와 공개 TS115 프로토콜을 대조한 전송 규칙."""

import io
from PIL import Image, ImageOps

REPORT_SIZE = 513
KEY_IDS = (13, 10, 7, 4, 1, 14, 11, 8, 5, 2, 15, 12, 9, 6, 3)


def command(opcode, tail=b""):
    if opcode not in (b"BAT", b"STP", b"DIS", b"CONNECT"):
        raise ValueError("허용하지 않은 장치 명령")
    payload = b"\x00CRT\x00\x00" + opcode + tail
    if len(payload) > REPORT_SIZE:
        raise ValueError("보고서 길이 초과")
    return payload.ljust(REPORT_SIZE, b"\x00")


def image_reports(tile, encoded):
    if not 0 <= tile < 15 or not 0 < len(encoded) <= 65535:
        raise ValueError("키 번호 또는 이미지 크기 오류")
    yield command(b"BAT", b"\x00\x00" + len(encoded).to_bytes(2, "big") + bytes([KEY_IDS[tile]]))
    for offset in range(0, len(encoded), 512):
        yield (b"\x00" + encoded[offset:offset + 512]).ljust(REPORT_SIZE, b"\x00")


def encode_tile(image):
    image = image.convert("RGB").resize((85, 85), Image.Resampling.NEAREST)
    # image-rs rotate90() is clockwise; Pillow ROTATE_270 is clockwise.
    image = ImageOps.flip(ImageOps.mirror(image.transpose(Image.Transpose.ROTATE_270)))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=75, subsampling=2)
    return buffer.getvalue()


def decode_key(report):
    if len(report) < 10 or report[:3] != b"ACK":
        return None
    raw = report[9]
    return KEY_IDS.index(raw) if raw in KEY_IDS else None

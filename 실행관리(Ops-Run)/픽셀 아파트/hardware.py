"""hidapi로 장치를 열고, 제조사 앱의 화면 깨우기 명령으로 세션을 시작한다."""

import ctypes as C
import configparser
from pathlib import Path
from protocol import image_reports, command, decode_key


class HidInfo(C.Structure):
    pass


HidInfo._fields_ = [("path", C.c_char_p), ("vendor_id", C.c_ushort), ("product_id", C.c_ushort),
                    ("serial_number", C.c_wchar_p), ("release_number", C.c_ushort),
                    ("manufacturer_string", C.c_wchar_p), ("product_string", C.c_wchar_p),
                    ("usage_page", C.c_ushort), ("usage", C.c_ushort),
                    ("interface_number", C.c_int), ("next", C.POINTER(HidInfo)), ("bus_type", C.c_int)]


class Device:
    def __init__(self, shared=False):
        self.lib = C.CDLL("/opt/homebrew/lib/libhidapi.dylib")
        self.lib.hid_enumerate.argtypes = [C.c_ushort, C.c_ushort]
        self.lib.hid_enumerate.restype = C.POINTER(HidInfo)
        self.lib.hid_free_enumeration.argtypes = [C.POINTER(HidInfo)]
        self.lib.hid_open_path.argtypes = [C.c_char_p]
        self.lib.hid_open_path.restype = C.c_void_p
        self.lib.hid_close.argtypes = [C.c_void_p]
        self.lib.hid_write.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t]
        self.lib.hid_read_timeout.argtypes = [C.c_void_p, C.c_void_p, C.c_size_t, C.c_int]
        self.lib.hid_error.argtypes = [C.c_void_p]
        self.lib.hid_error.restype = C.c_wchar_p
        self.lib.hid_darwin_set_open_exclusive.argtypes = [C.c_int]
        if self.lib.hid_init() != 0:
            raise RuntimeError("HID 통신 초기화에 실패했습니다.")
        self.lib.hid_darwin_set_open_exclusive(0 if shared else 1)
        self.handle = None
        self.report_count = 0
        self.input_reports = 0
        self.physical_keys = []
        self.next_heartbeat = 0.0

    def open(self):
        config = configparser.ConfigParser(interpolation=None)
        config.read(Path.home() / "Library/Application Support/HotSpot/StreamDock/config/StreamDockConfig.plist")
        serial = next(v.strip('"') for k, v in config["StreamDockCurrentDevice"].items() if "serial" in k)
        head = self.lib.hid_enumerate(0x0400, 0x1000)
        paths = []
        try:
            node = head
            while node:
                info = node.contents
                if info.usage_page == 0xFFA0 and info.usage == 1 and info.serial_number == serial:
                    paths.append(bytes(info.path))
                node = info.next
        finally:
            self.lib.hid_free_enumeration(head)
        if len(paths) != 1:
            raise RuntimeError("현재 선택된 TS115 한 대를 확인할 수 없습니다.")
        self.handle = self.lib.hid_open_path(paths[0])
        if not self.handle:
            raise RuntimeError("TS115를 열 수 없습니다. 제조사 앱과의 제어권 충돌을 확인하세요.")
        try:
            # SDDevice::sendWakeUpScreenPack()의 TS115 명령.
            self.write(command(b"DIS"))
            self.keep_alive()
        except Exception:
            self.close()
            raise
        return self

    def keep_alive(self):
        import time
        now = time.monotonic()
        if now >= self.next_heartbeat:
            self.write(command(b"CONNECT"))
            self.next_heartbeat = now + 1

    def write(self, report):
        if not self.handle:
            raise RuntimeError("장치가 열리지 않았습니다.")
        data = C.create_string_buffer(report)
        count = self.lib.hid_write(self.handle, data, len(report))
        if count != len(report):
            raise RuntimeError(f"HID 송신 실패: {self.lib.hid_error(self.handle) or count}")
        self.report_count += 1

    def frame(self, encoded_tiles):
        for tile, encoded in encoded_tiles.items():
            for report in image_reports(tile, encoded):
                self.write(report)
        if encoded_tiles:
            self.write(command(b"STP"))

    def poll(self, timeout=0):
        self.keep_alive()
        buffer = C.create_string_buffer(512)
        count = self.lib.hid_read_timeout(self.handle, buffer, 512, timeout)
        if count < 0:
            raise RuntimeError(f"HID 수신 실패: {self.lib.hid_error(self.handle)}")
        if not count:
            return None
        self.input_reports += 1
        report = buffer.raw[:count]
        key = decode_key(report)
        if key is not None:
            self.physical_keys.append(key)
        return key

    def close(self):
        if self.handle:
            self.lib.hid_close(self.handle)
            self.handle = None

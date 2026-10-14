"""공유 세계의 화면과 입력을 TS115에 연결한다."""

import json
from pathlib import Path
import queue
import threading
import time

from hardware import Device
from protocol import encode_tile
from session import Session
from world import Apartment

ROOT = Path(__file__).resolve().parent


class Controller:
    def __init__(self, device_factory=Device, session_factory=Session):
        self.world = Apartment()
        self.lock = threading.RLock()
        self.commands = queue.Queue()
        self.events = queue.Queue()
        self.device_factory = device_factory
        self.session = session_factory()
        self.device = None
        self.running = True
        self.frames = 0
        self.last_send_ms = 0.0
        self.started = 0.0
        self.sent_tiles = 0
        self.pending_tiles = {}
        self.error = None
        self.thread = threading.Thread(target=self.loop, name='apartment-controller', daemon=True)
        self.thread.start()

    def request(self, action, value=None):
        self.commands.put((action, value))

    def press(self, tile, physical=False):
        with self.lock:
            self.world.press(tile, physical=physical)
        self.events.put(('press', (tile, physical)))

    def overview(self):
        with self.lock:
            return self.world.overview()

    def connect(self):
        if self.device:
            return
        self.error = None
        self.events.put(('status', '몬스터덱으로 전환 중…'))
        try:
            self.session.begin()
            self.device = self.device_factory().open()
            with self.lock:
                self.world.last_tiles.clear()
            self.pending_tiles.clear()
            self.frames = self.sent_tiles = 0
            self.started = time.monotonic()
            self.events.put(('connected', None))
        except Exception:
            self.disconnect()
            raise

    def disconnect(self):
        try:
            if self.device:
                try:
                    self.save_metrics()
                finally:
                    self.device.close()
                    self.device = None
        finally:
            self.pending_tiles.clear()
            self.session.end()
            self.events.put(('disconnected', None))

    def save_metrics(self):
        if not self.device:
            return
        elapsed = time.monotonic() - self.started
        data = {'transport': 'TS115 HID 0400:1000', 'seconds': round(elapsed, 3),
                'frames_sent': self.frames, 'tiles_sent': self.sent_tiles,
                'reports_sent': self.device.report_count,
                'input_reports': self.device.input_reports,
                'physical_key_presses': list(self.device.physical_keys),
                'last_send_ms': round(self.last_send_ms, 2),
                'average_send_fps': round(self.frames / max(.001, elapsed), 2),
                'error': self.error,
                'display_observation': 'HID 송신 성공만으로 LCD 표시 성공을 단정하지 않음'}
        dest = ROOT / '근거/최근 장치 실행.json'
        dest.parent.mkdir(exist_ok=True)
        tmp = dest.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        tmp.replace(dest)

    def loop(self):
        previous = time.monotonic()
        next_frame = previous
        try:
            while self.running:
                try:
                    while True:
                        action, value = self.commands.get_nowait()
                        if action == 'connect':
                            self.connect()
                            previous = next_frame = time.monotonic()
                        elif action == 'disconnect':
                            self.disconnect()
                        elif action == 'press':
                            self.press(value)
                        elif action == 'close':
                            self.running = False
                            break
                except queue.Empty:
                    pass
                if not self.running:
                    break
                now = time.monotonic()
                with self.lock:
                    self.world.tick(now - previous)
                previous = now
                if self.device:
                    for _ in range(30):
                        key = self.device.poll(0)
                        if key is None:
                            break
                        self.press(key, physical=True)
                    if now >= next_frame:
                        with self.lock:
                            tiles = self.world.changed_tiles()
                        # 같은 방의 대기 중 그림은 최신 것으로 교체하고 순서대로 보낸다.
                        self.pending_tiles.update(tiles)
                        batch_size = 15 if self.frames == 0 else 3
                        selected = list(self.pending_tiles)[:batch_size]
                        encoded = {i: encode_tile(self.pending_tiles.pop(i)) for i in selected}
                        start = time.monotonic()
                        self.device.frame(encoded)
                        self.last_send_ms = (time.monotonic() - start) * 1000
                        if encoded:
                            self.frames += 1
                            self.sent_tiles += len(encoded)
                        # 전송 직후에도 읽기를 이어가며 장치가 버튼을 처리할 틈을 둔다.
                        next_frame = max(now + 1 / 6, time.monotonic() + .1)
                        if self.frames % 12 == 0:
                            self.save_metrics()
                time.sleep(.01)
        except Exception as error:
            self.error = str(error)
            self.events.put(('error', self.error))
        finally:
            try:
                self.disconnect()
            except Exception as error:
                self.events.put(('error', '원래 앱 복귀 실패: ' + str(error)))
            self.running = False

    def close(self):
        self.request('close')

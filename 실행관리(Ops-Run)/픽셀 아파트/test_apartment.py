import time
import unittest
from unittest.mock import patch

from controller import Controller
from world import Apartment


def wait_until(predicate):
    end = time.monotonic() + 3
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(.01)
    raise AssertionError('시간 초과')


class FakeDevice:
    def __init__(self):
        self.report_count = self.input_reports = 0
        self.physical_keys = []
        self.frames = []
        self.closed = False
        self.next_key = None

    def open(self):
        return self

    def frame(self, tiles):
        if any(not data.startswith(b'\xff\xd8') for data in tiles.values()):
            raise AssertionError('JPEG가 아님')
        self.frames.append(set(tiles))
        self.report_count += 1

    def poll(self, timeout):
        key, self.next_key = self.next_key, None
        if key is not None:
            self.input_reports += 1
            self.physical_keys.append(key)
        return key

    def close(self):
        self.closed = True


class FakeSession:
    def __init__(self):
        self.active = False
        self.restored = 0

    def begin(self):
        self.active = True

    def end(self):
        if self.active:
            self.active = False
            self.restored += 1


class ApartmentTests(unittest.TestCase):
    @patch.object(Controller, 'save_metrics')
    def test_animation_uses_small_fair_batches(self, metrics):
        device, session = FakeDevice(), FakeSession()
        controller = Controller(lambda: device, lambda: session)
        try:
            controller.request('connect')
            wait_until(lambda: len(device.frames) >= 16)
            self.assertEqual(device.frames[0], set(range(15)))
            self.assertTrue(all(len(frame) <= 3 for frame in device.frames[1:]))
            self.assertEqual(set().union(*device.frames[1:]), set(range(15)))
        finally:
            controller.close()
            controller.thread.join(3)

    @patch.object(Controller, 'save_metrics')
    def test_input_gets_time_between_slow_transfers(self, metrics):
        class BusyDevice(FakeDevice):
            last_write = None

            def frame(self, tiles):
                super().frame(tiles)
                time.sleep(.2)
                self.last_write = time.monotonic()

            def poll(self, timeout):
                if self.last_write is not None and time.monotonic() - self.last_write >= .05:
                    return super().poll(timeout)
                return None

        device, session = BusyDevice(), FakeSession()
        device.next_key = 0
        controller = Controller(lambda: device, lambda: session)
        try:
            controller.request('connect')
            wait_until(lambda: controller.world.physical_presses == 1)
        finally:
            controller.close()
            controller.thread.join(3)
        self.assertFalse(controller.thread.is_alive())

    def test_call_moves_guest_and_reacts(self):
        scene = Apartment()
        before = scene.tiles()[6].tobytes()
        scene.press(6, physical=True)
        self.assertNotEqual(before, scene.tiles()[6].tobytes())
        for _ in range(70):
            scene.tick(.05)
        self.assertAlmostEqual(scene.x, 150)
        self.assertAlmostEqual(scene.y, 178)
        self.assertEqual(scene.physical_presses, 1)

    def test_all_rooms_and_frame_changes(self):
        scene = Apartment()
        first = scene.changed_tiles()
        self.assertEqual(set(first), set(range(15)))
        self.assertEqual(scene.changed_tiles(), {})
        scene.tick(.25)
        self.assertGreater(len(scene.changed_tiles()), 2)
        self.assertTrue(all(tile.size == (100, 100) for tile in first.values()))

    def test_invalid_input_is_rejected(self):
        scene = Apartment()
        for tile in (-1, 15, True, .5, '3'):
            with self.assertRaises(ValueError):
                scene.press(tile)
        for delta in (-1, float('inf'), float('nan')):
            with self.assertRaises(ValueError):
                scene.tick(delta)

    @patch.object(Controller, 'save_metrics')
    def test_device_input_reconnect_and_original_app_return(self, metrics):
        device, session = FakeDevice(), FakeSession()
        controller = Controller(lambda: device, lambda: session)
        try:
            controller.request('connect')
            wait_until(lambda: bool(device.frames))
            self.assertEqual(device.frames[0], set(range(15)))
            device.next_key = 6
            wait_until(lambda: controller.world.physical_presses == 1)
            controller.request('disconnect')
            wait_until(lambda: session.restored == 1)
            self.assertTrue(device.closed)
            device.closed = False
            controller.request('connect')
            wait_until(lambda: session.active)
        finally:
            controller.close()
            controller.thread.join(3)
        self.assertFalse(controller.thread.is_alive())
        self.assertTrue(device.closed)
        self.assertEqual(session.restored, 2)

    @patch.object(Controller, 'save_metrics')
    def test_send_failure_still_returns_control(self, metrics):
        device, session = FakeDevice(), FakeSession()
        device.frame = lambda _: (_ for _ in ()).throw(RuntimeError('송신 실패'))
        controller = Controller(lambda: device, lambda: session)
        controller.request('connect')
        controller.thread.join(3)
        self.assertFalse(controller.thread.is_alive())
        self.assertTrue(device.closed)
        self.assertEqual(session.restored, 1)
        self.assertEqual(controller.error, '송신 실패')


if __name__ == '__main__':
    unittest.main()

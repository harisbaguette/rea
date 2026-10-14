import io
import unittest

from PIL import Image
from protocol import KEY_IDS, command, decode_key, encode_tile, image_reports


class ProtocolTests(unittest.TestCase):
    def test_known_header_and_chunks(self):
        reports = list(image_reports(7, b'j' * 513))
        self.assertEqual(reports[0][:14], bytes.fromhex('0043525400004241540000020108'))
        self.assertEqual([len(r) for r in reports], [513, 513, 513])
        self.assertEqual(reports[1], b'\0' + b'j' * 512)
        self.assertEqual(reports[2], b'\0j' + b'\0' * 511)
        self.assertEqual(command(b'STP')[:9], bytes.fromhex('004352540000535450'))

    def test_wake_packet_matches_vendor_trace(self):
        self.assertEqual(command(b'DIS'), bytes.fromhex('004352540000444953') + bytes(504))
        self.assertEqual(command(b'CONNECT'), b'\0CRT\0\0CONNECT' + bytes(500))

    def test_captured_physical_top_left_button(self):
        captured = bytes.fromhex('41434b00004f4b00000d0000000000000000000000000000')
        self.assertEqual(decode_key(captured.ljust(512, b'\0')), 0)

    def test_only_session_and_image_commands(self):
        for opcode in (b'CLE', b'LIG', b'RESET'):
            with self.assertRaises(ValueError):
                command(opcode)

    def test_input_mapping(self):
        for tile, raw in enumerate(KEY_IDS):
            self.assertEqual(decode_key(b'ACK' + bytes(6) + bytes([raw])), tile)
        for report in (b'', b'ACK', bytes(512), b'ACK' + bytes(509)):
            self.assertIsNone(decode_key(report))

    def test_image_rotation_matches_public_protocol(self):
        image = Image.new('RGB', (85, 85), 'black')
        image.paste('red', (0, 0, 35, 35))
        out = Image.open(io.BytesIO(encode_tile(image)))
        # Clockwise 90 + both mirrors places the upper-left corner at bottom-left.
        self.assertGreater(out.getpixel((10, 70))[0], 220)
        self.assertLess(out.getpixel((70, 10))[0], 30)


if __name__ == '__main__':
    unittest.main()

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import session


class SessionTests(unittest.TestCase):
    @patch.object(session, 'vendor_pids', return_value=[100])
    @patch.object(session.subprocess, 'run')
    def test_existing_vendor_is_not_duplicated(self, run, pids):
        session.open_vendor()
        run.assert_not_called()

    @patch.object(session.time, 'sleep')
    @patch.object(session.os, 'kill')
    @patch.object(session.subprocess, 'run', return_value=SimpleNamespace(stdout='200\n'))
    @patch.object(session, 'vendor_pids', side_effect=[[], [], [300]])
    def test_orphan_splash_is_removed_and_main_process_is_verified(self, pids, run, kill, sleep):
        session.open_vendor()
        kill.assert_called_once_with(200, session.signal.SIGTERM)
        run.assert_any_call(['open', '-n', '-a', session.APP], check=True)
        self.assertEqual(pids.call_count, 3)
        sleep.assert_called_once_with(.1)

    @patch.object(session.os, 'kill', side_effect=ProcessLookupError)
    @patch.object(session.subprocess, 'run', return_value=SimpleNamespace(stdout='200\n'))
    def test_splash_exit_race_is_harmless(self, run, kill):
        session.stop_splash()


if __name__ == '__main__':
    unittest.main()

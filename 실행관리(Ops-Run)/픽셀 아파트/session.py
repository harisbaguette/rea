"""제조사 앱과 제어권을 교대하고 종료 시 원래 앱을 돌려준다."""

import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

APP = '/Applications/MONSTAR DECK.app'
APP_PATTERN = '^' + re.escape(APP + '/Contents/MacOS/MONSTAR DECK') + '($| )'
SPLASH_PATTERN = '^' + re.escape(APP + '/Contents/MacOS/SplashScreen') + '($| )'
ROOT = Path(__file__).resolve().parent


def vendor_pids():
    out = subprocess.run(['pgrep', '-f', APP_PATTERN], capture_output=True, text=True).stdout
    return [int(p) for p in out.split()]


def stop_splash():
    out = subprocess.run(['pgrep', '-f', SPLASH_PATTERN], capture_output=True, text=True).stdout
    for value in out.split():
        try:
            os.kill(int(value), signal.SIGTERM)
        except ProcessLookupError:
            pass


def open_vendor():
    if vendor_pids():
        return
    # 부모 앱이 먼저 꺼지면 SplashScreen만 남아 open -a를 가로챌 수 있다.
    stop_splash()
    subprocess.run(['open', '-n', '-a', APP], check=True)
    until = time.monotonic() + 8
    while not vendor_pids():
        if time.monotonic() >= until:
            raise RuntimeError('몬스터덱 본 프로그램을 다시 시작하지 못했습니다.')
        time.sleep(.1)


class Session:
    def __init__(self):
        self.active = False
        self.watchdog = None

    def begin(self):
        if self.active:
            return
        self.active = True
        self.watchdog = subprocess.Popen([sys.executable, str(ROOT / 'session.py'), '--watch', str(os.getpid())],
                                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                         stderr=subprocess.DEVNULL, start_new_session=True)
        try:
            for pid in vendor_pids():
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            until = time.monotonic() + 8
            while vendor_pids():
                if time.monotonic() > until:
                    raise RuntimeError('몬스터덱 앱을 종료하지 못했습니다.')
                time.sleep(.1)
            stop_splash()
        except BaseException:
            self.end()
            raise

    def end(self):
        if not self.active:
            return
        open_vendor()
        self.active = False
        if self.watchdog and self.watchdog.poll() is None:
            self.watchdog.terminate()
            self.watchdog.wait(timeout=3)


def watch(parent):
    while True:
        try:
            os.kill(parent, 0)
        except ProcessLookupError:
            open_vendor()
            return
        time.sleep(.5)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--watch':
        watch(int(sys.argv[2]))

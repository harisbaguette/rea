"""픽셀 아파트의 시작과 종료, PC 미리보기."""

import argparse
import fcntl
from pathlib import Path
import queue
import signal
import sys
import tkinter as tk
from tkinter import messagebox, ttk

from PIL import ImageTk
from controller import Controller

ROOT = Path(__file__).resolve().parent
BG = '#111c27'
INK = '#f3ead6'
MUTED = '#a5b5bc'


class Window:
    def __init__(self, root, args):
        self.root = root
        self.controller = Controller()
        self.closing = False
        self.connected = False
        self.photo = None
        root.title('몬스터덱 · 픽셀 아파트')
        root.configure(bg=BG)
        root.geometry('1110x850')
        root.resizable(False, False)
        root.protocol('WM_DELETE_WINDOW', self.close)
        root.bind('<Escape>', lambda _: self.close())
        header = tk.Frame(root, bg=BG)
        header.pack(fill='x', padx=27, pady=(20, 12))
        tk.Label(header, text='픽셀 아파트', fg=INK, bg=BG,
                 font=('Helvetica', 25, 'bold')).pack(side='left')
        self.status = tk.Label(header, text='PC 미리보기', fg='#e9c382', bg=BG,
                               font=('Helvetica', 12))
        self.status.pack(side='right', pady=9)
        tk.Label(root, text='방을 누르면 주민이 반응하고, 방문객이 찾아옵니다.',
                 fg=MUTED, bg=BG, font=('Helvetica', 13)).pack(anchor='w', padx=28, pady=(0, 14))
        self.canvas = tk.Canvas(root, width=1056, height=628, bg=BG, highlightthickness=0)
        self.canvas.pack()
        self.canvas.bind('<Button-1>', self.click_room)
        self.scene_image = self.canvas.create_image(0, 0, anchor='nw')
        footer = tk.Frame(root, bg=BG)
        footer.pack(fill='x', padx=27, pady=17)
        self.start_button = ttk.Button(footer, text='몬스터덱에서 시작', command=self.connect)
        self.start_button.pack(side='left')
        self.stop_button = ttk.Button(footer, text='기존 바로가기로 돌아가기', command=self.disconnect,
                                      state='disabled')
        self.stop_button.pack(side='left', padx=9)
        self.feedback = tk.Label(footer, text='창을 닫거나 Esc를 누르면 종료합니다.',
                                 fg=MUTED, bg=BG, font=('Helvetica', 11))
        self.feedback.pack(side='right')
        self.draw()
        if args.device:
            root.after(350, self.connect)
        if args.seconds:
            root.after(round(args.seconds * 1000), self.close)
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: self.root.after(0, self.close))

    def connect(self):
        if not self.controller.running:
            messagebox.showerror('픽셀 아파트', '실행 중 오류가 있었습니다. 창을 닫고 다시 시작해 주세요.')
            return
        self.start_button.configure(state='disabled')
        self.status.configure(text='몬스터덱으로 전환 중…')
        self.controller.request('connect')

    def disconnect(self):
        self.stop_button.configure(state='disabled')
        self.status.configure(text='기존 바로가기로 돌아가는 중…')
        self.controller.request('disconnect')

    def click_room(self, event):
        col, rx = divmod(event.x, 214)
        row, ry = divmod(event.y, 214)
        if 0 <= col < 5 and 0 <= row < 3 and rx < 200 and ry < 200:
            self.controller.request('press', row * 5 + col)

    def draw(self):
        try:
            while True:
                action, value = self.controller.events.get_nowait()
                if action == 'connected':
                    self.connected = True
                    self.stop_button.configure(state='normal')
                elif action == 'disconnected':
                    self.connected = False
                    self.start_button.configure(state='normal')
                    self.stop_button.configure(state='disabled')
                    self.status.configure(text='PC 미리보기 · 기존 바로가기 복귀')
                elif action == 'status':
                    self.status.configure(text=value)
                elif action == 'press':
                    tile, physical = value
                    room = f'{3 - tile // 5}{tile % 5 + 1:02}'
                    self.feedback.configure(text=f'{room}호에서 불렀어요' + (' · 실제 버튼' if physical else ''))
                elif action == 'error':
                    self.status.configure(text='실행 중단 · 기존 앱 복귀')
                    self.feedback.configure(text=value)
        except queue.Empty:
            pass
        if self.connected:
            c = self.controller
            self.status.configure(text=f'몬스터덱에 전송 중 · 실제 버튼 {c.world.physical_presses}회')
        self.photo = ImageTk.PhotoImage(self.controller.overview())
        self.canvas.itemconfigure(self.scene_image, image=self.photo)
        if not self.closing:
            self.root.after(85, self.draw)

    def close(self):
        if self.closing:
            return
        self.closing = True
        self.status.configure(text='종료 중 · 기존 바로가기 복귀')
        self.controller.close()
        self.wait_close()

    def wait_close(self):
        if self.controller.thread.is_alive():
            self.root.after(50, self.wait_close)
        else:
            self.root.destroy()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', action='store_true')
    parser.add_argument('--seconds', type=float, default=0)
    args = parser.parse_args()
    lock_path = ROOT / '.session.lock'
    with lock_path.open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('픽셀 아파트가 이미 실행 중입니다.')
            return 1
        root = tk.Tk()
        Window(root, args)
        root.mainloop()
    return 0


if __name__ == '__main__':
    sys.exit(main())

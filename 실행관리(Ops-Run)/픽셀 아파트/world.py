"""버튼 15개가 한 상태를 공유하는 작은 아파트."""

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SIZE = 100
WALK = (0, 1, 2, 1)
PALETTES = (('#657d81', '#bfa280'), ('#80728d', '#b99c8b'), ('#637f73', '#af9b76'))


class Apartment:
    def __init__(self):
        self.resident = Image.open(ROOT / 'assets/pipoya/resident.png').convert('RGBA')
        self.cat = Image.open(ROOT / 'assets/pipoya/cat.png').convert('RGBA')
        self.elapsed = 0.0
        self.x, self.y = 50.0, 78.0
        self.target = (450.0, 78.0)
        self.path = [(450, 178), (50, 178), (50, 278), (450, 278), (450, 78), (50, 78)]
        self.next_stop = 0
        self.direction = 2
        self.presses = self.physical_presses = 0
        self.highlight = None
        self.highlight_until = 0.0
        self.reactions = [0.0] * 15
        self.last_tiles = {}

    def press(self, tile, physical=False):
        if isinstance(tile, bool) or not isinstance(tile, int) or not 0 <= tile < 15:
            raise ValueError('방 번호 오류')
        self.target = (50.0 + tile % 5 * SIZE, 78.0 + tile // 5 * SIZE)
        self.presses += 1
        self.physical_presses += int(physical)
        self.highlight, self.highlight_until = tile, self.elapsed + 4.0
        self.reactions[tile] = self.elapsed + 2.8

    def tick(self, delta):
        if not math.isfinite(delta) or delta < 0:
            raise ValueError('시간 간격 오류')
        delta = min(delta, 0.25)
        self.elapsed += delta
        dx, dy = self.target[0] - self.x, self.target[1] - self.y
        step = 65 * delta
        if abs(dx) > .1:
            self.direction = 2 if dx > 0 else 1
            self.x += math.copysign(min(abs(dx), step), dx)
        elif abs(dy) > .1:
            self.direction = 0 if dy > 0 else 3
            self.y += math.copysign(min(abs(dy), step), dy)
        elif self.elapsed >= self.highlight_until:
            self.target = self.path[self.next_stop]
            self.next_stop = (self.next_stop + 1) % len(self.path)

    def sprite(self, sheet, col, row, scale=2):
        return sheet.crop((col * 32, row * 32, (col + 1) * 32, (row + 1) * 32)).resize(
            (32 * scale, 32 * scale), Image.Resampling.NEAREST)

    def background(self, tile):
        row = tile // 5
        wall, floor = PALETTES[row]
        image = Image.new('RGB', (SIZE, SIZE), '#202b37')
        draw = ImageDraw.Draw(image)
        draw.rectangle((2, 2, 97, 97), fill=wall)
        draw.rectangle((3, 76, 96, 96), fill=floor)
        for yy in (80, 87, 94):
            draw.line((3, yy, 96, yy), fill='#8f775e')
        draw.rectangle((8, 12, 34, 38), fill='#344c60')
        draw.rectangle((11, 15, 31, 35), fill='#c7ddd1')
        draw.line((21, 15, 21, 35), fill='#829e9e', width=2)
        draw.line((11, 25, 31, 25), fill='#829e9e', width=2)
        draw.text((74, 9), f'{3-row}{tile % 5 + 1:02}', fill='#f8e8c8')
        if tile % 3 == 0:
            draw.rectangle((71, 59, 89, 74), fill='#bb8166')
            draw.rectangle((69, 57, 91, 61), fill='#d9a07a')
            draw.line((80, 39, 80, 57), fill='#325849', width=3)
            draw.rectangle((68, 35, 83, 46), fill='#7db17d')
            draw.rectangle((78, 28, 90, 40), fill='#91bf8c')
        elif tile % 3 == 1:
            draw.rectangle((63, 61, 91, 74), fill='#a96574')
            draw.rectangle((64, 55, 90, 66), fill='#db9a9f')
            draw.line((77, 57, 77, 66), fill='#ba7a88', width=2)
        else:
            draw.rectangle((69, 45, 91, 74), fill='#5c5760')
            for yy in (48, 59, 70):
                draw.line((71, yy, 89, yy), fill='#c7ac88', width=2)
            draw.rectangle((73, 49, 76, 57), fill='#8eb5a2')
            draw.rectangle((80, 49, 85, 57), fill='#cd9e90')
        return image

    def render(self):
        image = Image.new('RGB', (500, 300))
        for tile in range(15):
            room = self.background(tile)
            phase = self.elapsed + tile * .27
            reacting = self.elapsed < self.reactions[tile]
            col = WALK[int(phase * (7 if reacting else 2)) % 4]
            resident = self.sprite(self.resident, col, (tile % 3 if reacting else 0))
            jump = round(abs(math.sin(phase * 9)) * 7) if reacting else 0
            room.paste(resident, (16, 18 - jump), resident)
            draw = ImageDraw.Draw(room)
            if reacting:
                draw.polygon([(45, 13), (42, 10), (42, 6), (45, 4), (48, 7),
                              (51, 4), (54, 6), (54, 10), (48, 16)], fill='#ffb4b0')
            if tile == self.highlight and self.elapsed < self.highlight_until:
                draw.rectangle((2, 2, 97, 97), outline='#f6d58c', width=2)
            image.paste(room, ((tile % 5) * SIZE, (tile // 5) * SIZE))
        cycle = (self.elapsed * 24) % 800
        cat_x = 50 + (cycle if cycle <= 400 else 800-cycle)
        cat_row = 2 if cycle <= 400 else 1
        cat = self.sprite(self.cat, WALK[int(self.elapsed * 5) % 4], cat_row)
        image.paste(cat, (round(cat_x) - 32, 235), cat)
        guest = self.sprite(self.resident, WALK[int(self.elapsed * 5) % 4], self.direction, 1)
        image.paste(guest, (round(self.x) - 16, round(self.y) - 30), guest)
        return image

    def tiles(self):
        image = self.render()
        return [image.crop((i % 5 * SIZE, i // 5 * SIZE, i % 5 * SIZE + SIZE, i // 5 * SIZE + SIZE))
                for i in range(15)]

    def changed_tiles(self, force=False):
        changed = {}
        for i, tile in enumerate(self.tiles()):
            data = tile.tobytes()
            if force or self.last_tiles.get(i) != data:
                changed[i] = tile
            self.last_tiles[i] = data
        return changed

    def overview(self, scale=2):
        gap = 7
        image = Image.new('RGB', (500 + gap * 4, 300 + gap * 2), '#111c27')
        for i, tile in enumerate(self.tiles()):
            image.paste(tile, (i % 5 * (SIZE + gap), i // 5 * (SIZE + gap)))
        return image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)

#!/usr/bin/env python3
"""Regenerate the PNG figures in this directory with the bundled Pillow.

Usage: python3 assets/diagrams/generate.py
Requires the DSH bundled runtime (Pillow + macOS system fonts SFNS/Menlo).
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BG = (10, 16, 30)
PANEL = (18, 28, 50)
EDGE = (69, 92, 127)
INK = (241, 245, 249)
SUB = (148, 163, 184)
GREEN = (34, 197, 94)
BLUE = (77, 107, 254)
AMBER = (245, 158, 11)

TITLE = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 30)
BODY = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 19)
SMALL = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 16)
MONO = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15)


def canvas(w, h):
    img = Image.new('RGB', (w, h), BG)
    return img, ImageDraw.Draw(img)


def centered(d, w, text, y, font, fill=INK):
    d.text(((w - d.textlength(text, font=font)) / 2, y), text, font=font, fill=fill)


def box(d, x, y, w, h, lines, accent=None, mono_last=False):
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=PANEL, outline=accent or EDGE, width=2)
    cy = y + 12
    for i, ln in enumerate(lines):
        mono_line = mono_last and i == len(lines) - 1
        f = MONO if mono_line else BODY
        c = SUB if mono_line else INK
        tw = d.textlength(ln, font=f)
        d.text((x + (w - tw) / 2, cy), ln, font=f, fill=c)
        cy += 27


def arrow(d, x1, y1, x2, y2, color=SUB):
    d.line([(x1, y1), (x2, y2)], fill=color, width=2)
    a = math.atan2(y2 - y1, x2 - x1)
    L = 10
    d.polygon([(x2, y2),
               (x2 - L * math.cos(a - 0.4), y2 - L * math.sin(a - 0.4)),
               (x2 - L * math.cos(a + 0.4), y2 - L * math.sin(a + 0.4))], fill=color)


def routing_flow():
    W, H = 1280, 760
    img, d = canvas(W, H)
    centered(d, W, 'dsh-provider-proxy — how a request is routed', 26, TITLE)
    box(d, 430, 80, 420, 92, ['ctx.llm.stream({ provider, model })', 'undici global dispatcher'])
    arrow(d, 640, 172, 640, 196)
    box(d, 430, 196, 420, 92, ['AsyncLocalStorage store', 'als.run({provider, model}) per pull'], GREEN)
    arrow(d, 640, 288, 640, 312)
    box(d, 430, 312, 420, 92, ['adapter → globalThis.fetch', 'one fetch, many callers'])
    arrow(d, 640, 404, 640, 428)
    cx, cy, hw, hh = 640, 500, 170, 62
    d.polygon([(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)], fill=PANEL, outline=BLUE, width=2)
    centered(d, W, 'RoutingDispatcher', cy - 32, BODY)
    centered(d, W, 'match, first hit wins', cy - 4, SMALL, SUB)
    for x, t1, t2, ac in [
        (140, 'model rule', 'exact / pinned · prefix', GREEN),
        (430, 'host rule', 'exact · subdomain · :port', GREEN),
        (720, 'loopback', 'always direct', AMBER),
        (1010, 'default', 'inherit → launcher policy', BLUE),
    ]:
        arrow(d, cx, cy + hh - 4, x, 610, ac)
        box(d, x - 130, 610, 260, 84, [t1, t2], ac)
    d.text((40, H - 34), 'fail-closed: an invalid entry refuses the whole route set — previous routes keep serving',
           font=SMALL, fill=SUB)
    img.save(os.path.join(HERE, 'routing-flow.png'), optimize=True)
    print('routing-flow.png', img.size)


def two_seats():
    W, H = 1280, 620
    img, d = canvas(W, H)
    centered(d, W, 'Two seats, one editor', 26, TITLE)
    box(d, 80, 96, 480, 92, ['Plugins → dsh-provider-proxy', 'Configure'])
    box(d, 720, 96, 480, 92, ['Settings → Proxy routes', 'id: proxy-routes'])
    arrow(d, 320, 188, 560, 260, GREEN)
    arrow(d, 960, 188, 720, 260, GREEN)
    box(d, 480, 260, 320, 92, ['ProxyRoutesView', 'one shared component'], GREEN)
    arrow(d, 640, 352, 640, 376)
    box(d, 400, 376, 480, 92, ['settings form (configForms)', 'revision-fenced mutate'])
    arrow(d, 640, 468, 640, 492)
    box(d, 400, 492, 480, 92, ['volatile update', 'routes replaced live, no remount'], BLUE)
    d.text((40, H - 34), 'drafts never write until Save · a stale write is refused, never merged',
           font=SMALL, fill=SUB)
    img.save(os.path.join(HERE, 'two-seats.png'), optimize=True)
    print('two-seats.png', img.size)


if __name__ == '__main__':
    routing_flow()
    two_seats()

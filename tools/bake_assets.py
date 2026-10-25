#!/usr/bin/env python3
"""
將盤雙六的程序化物理音效與獨立道具烘焙導出為標準 .wav 與透明 .png 資產包
可直接用於：
1. 網頁版 / 手機 App 外部皮膚替換 (mobile/assets/)
2. 騎馬與砍殺：戰團 Mod (Sounds/*.wav & Textures/*.dds)
3. C/C++ SDL 遊戲引擎
"""
import math
import os
import random
import struct
import wave

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "mobile", "assets")
SFX_DIR = os.path.join(OUT_DIR, "sfx")
SPRITE_DIR = os.path.join(OUT_DIR, "sprites")
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(SPRITE_DIR, exist_ok=True)

SAMPLE_RATE = 44100

def save_wav(filename, samples):
    path = os.path.join(SFX_DIR, filename)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for s in samples:
            clamped = max(-1.0, min(1.0, s))
            frames.extend(struct.pack("<h", int(clamped * 32767)))
        wf.writeframes(frames)
    print(f"[SFX] Exported {path} ({len(samples)/SAMPLE_RATE:.2f}s)")

def biquad_bandpass(samples, freq, Q):
    w0 = 2.0 * math.pi * freq / SAMPLE_RATE
    alpha = math.sin(w0) / (2.0 * Q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1.0 + alpha, -2.0 * math.cos(w0), 1.0 - alpha
    b0, b1, b2 = b0 / a0, b1 / a0, b2 / a0
    a1, a2 = a1 / a0, a2 / a0
    out = [0.0] * len(samples)
    x1 = x2 = y1 = y2 = 0.0
    for i, x0 in enumerate(samples):
        y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        out[i] = y0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
    return out

def synth_burst(duration, freq, Q, gain):
    n = int(SAMPLE_RATE * duration)
    raw = [random.uniform(-1.0, 1.0) for _ in range(n)]
    filtered = biquad_bandpass(raw, freq, Q)
    for i in range(n):
        env = math.exp(-i / (n * 0.22))
        filtered[i] *= env * gain
    return filtered

def synth_modal(duration, freq, gain):
    n = int(SAMPLE_RATE * duration)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-i / (n * 0.25))
        out.append(math.sin(2.0 * math.pi * freq * t) * env * gain)
    return out

def mix_into(buf, sub, offset_sec=0.0):
    start = int(offset_sec * SAMPLE_RATE)
    for i, v in enumerate(sub):
        if start + i < len(buf):
            buf[start + i] += v

def build_sfx():
    random.seed(42)
    # 1. 竹筒振賽單次碰撞音 (tube_rattle.wav)
    buf = [0.0] * int(SAMPLE_RATE * 0.12)
    mix_into(buf, synth_burst(0.032, 940, 7.5, 0.85), 0.0)
    mix_into(buf, synth_burst(0.020, 2380, 9.0, 0.70), 0.0)
    mix_into(buf, synth_burst(0.010, 3400, 3.0, 0.55), 0.0)
    mix_into(buf, synth_burst(0.024, 1120, 8.0, 0.65), 0.022)
    mix_into(buf, synth_burst(0.010, 3100, 6.0, 0.45), 0.022)
    save_wav("tube_rattle.wav", buf)

    # 2. 牛骨賽落盤彈跳音 (dice_bounce.wav)
    buf = [0.0] * int(SAMPLE_RATE * 0.09)
    mix_into(buf, synth_burst(0.014, 2950, 6.5, 0.90), 0.0)
    mix_into(buf, synth_burst(0.028, 780, 4.5, 0.75), 0.0)
    mix_into(buf, synth_modal(0.050, 165, 0.28), 0.0)
    save_wav("dice_bounce.wav", buf)

    # 3. 那智黒石・通常着手音 (stone_place.wav)
    buf = [0.0] * int(SAMPLE_RATE * 0.16)
    mix_into(buf, synth_burst(0.014, 2780, 6.0, 0.95), 0.0)
    mix_into(buf, synth_burst(0.032, 890, 4.2, 0.85), 0.0)
    mix_into(buf, synth_modal(0.120, 122, 0.65), 0.0)
    mix_into(buf, synth_modal(0.080, 184, 0.40), 0.0)
    save_wav("stone_place.wav", buf)

    # 4. 叩き（孤石撃退・二石激突＋重着地音） (stone_hit.wav)
    buf = [0.0] * int(SAMPLE_RATE * 0.22)
    mix_into(buf, synth_burst(0.015, 3650, 8.5, 1.0), 0.0)
    mix_into(buf, synth_burst(0.024, 1850, 6.0, 0.85), 0.0)
    mix_into(buf, synth_modal(0.028, 2180, 0.35), 0.0)
    mix_into(buf, synth_burst(0.018, 2650, 5.5, 0.95), 0.024)
    mix_into(buf, synth_burst(0.042, 820, 3.8, 0.90), 0.024)
    mix_into(buf, synth_modal(0.150, 114, 0.80), 0.024)
    mix_into(buf, synth_modal(0.100, 172, 0.55), 0.024)
    save_wav("stone_hit.wav", buf)

def build_sprites():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("[WARN] Pillow not installed, skipping PNG sprite generation.")
        return

    # 1. 那智黒石 & 日向蛤白石 (128x128 透明 PNG)
    for name, is_black in [("stone_black.png", True), ("stone_white.png", False)]:
        img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # 投影
        d.ellipse([18, 30, 114, 112], fill=(0, 0, 0, 135))
        # 圓柱側壁厚度
        side_col = (17, 14, 12, 255) if is_black else (184, 164, 132, 255)
        d.ellipse([14, 24, 110, 106], fill=side_col)
        # 圓柱頂面
        top_col = (42, 37, 33, 255) if is_black else (244, 234, 214, 255)
        rim_col = (92, 78, 62, 255) if is_black else (160, 138, 102, 255)
        d.ellipse([14, 12, 110, 94], fill=top_col, outline=rim_col, width=2)
        # 中央同心圓凹槽（くぼみ）
        dimple_col = (20, 17, 15, 255) if is_black else (207, 192, 162, 255)
        dimple_rim = (80, 72, 65, 180) if is_black else (140, 115, 80, 180)
        d.ellipse([41, 35, 83, 71], fill=dimple_col, outline=dimple_rim, width=2)
        path = os.path.join(SPRITE_DIR, name)
        img.save(path)
        print(f"[SPRITE] Exported {path}")

    # 2. 六面牛骨賽 (dice_1.png .. dice_6.png)
    pips_map = {
        1: [(48, 48)],
        2: [(26, 26), (70, 70)],
        3: [(26, 26), (48, 48), (70, 70)],
        4: [(26, 26), (70, 26), (26, 70), (70, 70)],
        5: [(26, 26), (70, 26), (48, 48), (26, 70), (70, 70)],
        6: [(26, 24), (70, 24), (26, 48), (70, 48), (26, 72), (70, 72)],
    }
    for val in range(1, 7):
        img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([12, 14, 88, 90], radius=8, fill=(0, 0, 0, 120))
        d.rounded_rectangle([8, 8, 84, 84], radius=8, fill=(242, 229, 201, 255), outline=(107, 83, 49, 255), width=3)
        for px, py in pips_map[val]:
            r = 11 if val == 1 else 7
            col = (168, 28, 20, 255) if val in (1, 4) else (23, 17, 11, 255)
            d.ellipse([px - r, py - r, px + r, py + r], fill=col)
        path = os.path.join(SPRITE_DIR, f"dice_{val}.png")
        img.save(path)
        print(f"[SPRITE] Exported {path}")

if __name__ == "__main__":
    build_sfx()
    build_sprites()

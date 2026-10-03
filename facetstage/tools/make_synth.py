# -*- coding: utf-8 -*-
# Synthetic "photos" of faceted surfaces for testing 自動偵測面. Writes ../testimg/*.jpg + gt counts.
import numpy as np, json, os
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'testimg'); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def render(W, H, bg, planes, blobs=(), noise=5.0, blur=1.0, name='x'):
    img = np.zeros((H, W, 3), np.float32); img[:] = bg
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for poly, col, grad in planes:
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
        m = np.asarray(m, np.float32)[..., None] / 255
        cx = np.mean([p[0] for p in poly]); cy = np.mean([p[1] for p in poly])
        shade = 1 + grad[0] * (xx - cx) / W + grad[1] * (yy - cy) / H
        img = img * (1 - m) + (np.array(col, np.float32) * shade[..., None]) * m
    for (bx, by, r, amp) in blobs:
        img += amp * np.exp(-((xx - bx) ** 2 + (yy - by) ** 2) / (2 * r * r))[..., None]
    img += rng.normal(0, noise, img.shape)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
    im.save(f'{OUT}/{name}.jpg', quality=85)

gt = {}
# 1) 白色天花板 + 斜樑 + 吸頂燈（直拍）
W, H = 900, 1200
planes = [
    ([[0, 0], [900, 0], [900, 330], [0, 560]], (226, 224, 220), (0.10, 0.25)),        # 天花板左/上
    ([[0, 560], [900, 330], [900, 420], [0, 660]], (196, 194, 190), (0.05, 0.0)),      # 樑底面
    ([[0, 660], [900, 420], [900, 470], [0, 720]], (150, 148, 146), (0.1, 0.0)),       # 樑側面
    ([[0, 720], [900, 470], [900, 900], [0, 1060]], (214, 212, 208), (-0.1, -0.3)),    # 天花板下
    ([[0, 1060], [900, 900], [900, 1200], [0, 1200]], (176, 160, 140), (0.0, 0.2)),    # 牆面
]
render(W, H, (0, 0, 0), planes, blobs=[(520, 200, 70, 40)], name='syn_ceiling'); gt['syn_ceiling'] = 5
# 2) 摺紙（手風琴摺，直拍，背景暗）
pl = []; xs = [120, 230, 340, 450, 560, 670, 780]
for i in range(6):
    x0, x1 = xs[i], xs[i + 1]
    top0 = 220 + (i % 2) * 60; top1 = 220 + ((i + 1) % 2) * 60
    poly = [[x0, top0], [x1, top1], [x1, 980 - ((i + 1) % 2) * 50], [x0, 980 - (i % 2) * 50]]
    col = (235, 232, 225) if i % 2 == 0 else (150, 146, 140)
    pl.append((poly, col, (0.2, 0.25)))
render(W, H, (40, 38, 42), pl, name='syn_fold'); gt['syn_fold'] = 6
# 3) 低多邊形牆（橫拍，類似範例牆）
V = dict(A=[430, 140], B=[640, 90], C=[860, 120], D=[1060, 170], E=[1180, 300], F=[520, 300], G=[720, 260], H=[930, 290], I=[1090, 400],
         J=[470, 470], K=[660, 450], L=[860, 480], M=[1020, 560], N=[600, 640], O=[820, 660])
faces = ['ABF', 'BGF', 'BCG', 'CHG', 'CDH', 'DEIH', 'AFJ', 'FGKJ', 'GHLK', 'HIML', 'JKN', 'KLON', 'LMO']
pl = []
for k, fs in enumerate(faces):
    l = 70 + rng.random() * 110
    pl.append(([V[c] for c in fs], (l, l * 0.97, l * 1.05), (rng.normal(0, 0.15), rng.normal(0, 0.15))))
render(1280, 720, (22, 20, 30), pl, blobs=[(200, 150, 160, 25)], noise=6, name='syn_lowpoly'); gt['syn_lowpoly'] = 13
# 4) 低對比斜面板（相鄰面亮度只差 ~6%）
pl = []
pts = [[0, 0], [450, 0], [900, 0], [0, 600], [450, 520], [900, 600], [0, 1200], [450, 1200], [900, 1200]]
tri = [(0, 1, 4), (0, 4, 3), (1, 2, 4), (2, 5, 4), (3, 4, 7), (3, 7, 6), (4, 5, 7), (5, 8, 7)]
base = [200, 188, 212, 196, 180, 192, 204, 186]
for t, b in zip(tri, base):
    pl.append(([pts[i] for i in t], (b, b * 0.98, b * 0.95), (0.12, 0.15)))
render(900, 1200, (0, 0, 0), pl, blobs=[(450, 300, 120, 18)], noise=6, name='syn_lowcontrast_v1')
# 4b) 物理一致版：光線衰減是整面共用的乘法因子（不是每塊各自的漸層），相鄰面亮度只差 4–8%
def render_global(W, H, planes, name, noise=6):
    img = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    light = 0.82 + 0.25 * np.exp(-((xx - 0.55 * W) ** 2 + (yy - 0.2 * H) ** 2) / (2 * (0.45 * W) ** 2))
    for poly, k in planes:
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
        m = np.asarray(m, np.float32)[..., None] / 255
        img = img * (1 - m) + (np.array([215, 211, 204], np.float32) * k * light[..., None]) * m
    img += rng.normal(0, noise, img.shape)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)).save(f'{OUT}/{name}.jpg', quality=85)
ks = [1.0, 0.94, 1.0 * 0.97, 0.91, 0.88, 0.95, 0.92, 0.86]
render_global(900, 1200, [([pts[i] for i in t], k) for t, k in zip(tri, ks)], 'syn_lowcontrast'); gt['syn_lowcontrast'] = 8
json.dump(gt, open(f'{OUT}/gt.json', 'w'))
print(gt)

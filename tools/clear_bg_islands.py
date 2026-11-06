#!/usr/bin/env python3
"""초상화에 남은 흰 배경 섬(머리카락 틈·팔 사이)을 투명하게 만든다(2026-11-05).

배경 제거(make_portraits.py)는 테두리에서 이어진 흰색과 큰 순백 덩어리만 지웠다.
머리카락 틈처럼 테두리와 끊긴 작은 배경은 흰 얼룩으로 남는다.
완성 그림의 색만으로는 흰 옷·눈 하이라이트와 구별되지 않으므로 원본 출력(assets/raw)에서 찾는다.
모델 배경은 순백(모든 채널 252 이상)이고, 흰 옷·하이라이트는 그보다 어둡다.

완성 그림을 다시 만들지 않고 알파만 고친다 — 손으로 고친 초상(나유타 속눈썹·삿갓)을 보존하려고.

사용법
  tools/clear_bg_islands.py <저장소> [이름…] [--save] [--diag 폴더]
"""
import argparse, pathlib
from collections import deque

import numpy as np
from PIL import Image

PURE, NEAR = 252, 227      # 순백 기준, make_portraits의 tol=28과 같은 근백 기준
MIN_CORE = 40              # 이보다 작은 순백 섬은 눈 하이라이트일 수 있어 둔다(원본 픽셀 수)
GROW = 6                   # 섬 가장자리의 번진 흰 테두리까지 지우는 폭(원본 픽셀)
EDGE_DIST = 45             # 실루엣 밖 배경에서 이 거리 안의 섬만 배경 틈으로 본다(원본 픽셀)
HAIR_DIST = 120            # 둘레가 머리카락처럼 색이 있는 섬은 이 거리까지 본다
# 위 거리는 머리카락 안쪽 틈만 잡히는 인물에만 쓴다(다른 인물은 휘장·보석·꽃 장식의 흰색까지 잡혀서 뺌, 2026-11-05 확인)
HAIR_DEEP = ("dorothy", "rapi_")
# 흰 머리·흰 옷이라 순백 하이라이트가 배경과 구별되지 않는 인물(덩기덕)은 건너뛴다
# 폴리도 흰 머리라 눈 흰자를 배경 틈으로 잘못 지웠다(2026-11-06 사용자 지적) → 건너뜀
SKIP = ("me_", "poli_")
# 거리 기준을 넘는 깊은 틈은 원본 좌표로 직접 짚는다(2026-11-06 사용자 지적: 미란다 목 양옆·팔과 머리 사이).
# 표정마다 섬 번호가 달라서, 지점이 들어 있는(없으면 20픽셀 안에서 가장 가까운) 순백 섬을 지운다
PICK = {"miranda_": [(922, 566), (356, 695), (700, 622), (1243, 848), (435, 520)]}


def label(m):
    h, w = m.shape
    L = np.zeros((h, w), np.int32); sizes = [0]
    for y, x in zip(*np.nonzero(m)):
        if L[y, x]:
            continue
        k = len(sizes); L[y, x] = k; q = deque([(y, x)]); n = 0
        while q:
            cy, cx = q.popleft(); n += 1
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not L[ny, nx]:
                    L[ny, nx] = k; q.append((ny, nx))
        sizes.append(n)
    return L, np.array(sizes)


def dilate(m, n):
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    return m


def is_pocket(raw, Lc, k, dist, deep):
    """흰 옷의 하이라이트와 머리카락 틈의 배경을 가른다.
    틈은 실루엣 가장자리 가까이(dist) 있고, 둘레가 머리카락처럼 색이 있거나 어둡다.
    흰 옷의 하이라이트는 둘레가 회백색(채도 낮고 밝음)이다."""
    ys, xs = np.nonzero(Lc == k)
    y0, y1, x0, x1 = max(ys.min() - 10, 0), ys.max() + 11, max(xs.min() - 10, 0), xs.max() + 11
    m = Lc[y0:y1, x0:x1] == k
    ring = dilate(m, 8) & ~dilate(m, 4)
    px = raw[y0:y1, x0:x1][ring]
    sat = np.median(px.max(axis=1) - px.min(axis=1)); lo = np.median(px.min(axis=1))
    d = dist[ys, xs].min()
    # 둘레에 색이 있으면(머리카락) 실루엣 안쪽 HAIR_DIST까지, 크면 거리와 상관없이 틈으로 본다.
    # 눈 하이라이트는 실루엣에서 더 멀고 작아서 남는다
    if sat >= 30:
        return d <= (HAIR_DIST if deep else EDGE_DIST) or len(ys) >= 250
    return d <= EDGE_DIST and (lo < 150 or len(ys) >= 300)


def islands(raw, deep=False, picks=()):
    """원본에서 (테두리 배경, 남은 배경 섬) 두 마스크를 돌려준다."""
    mn = raw.min(axis=2)
    L, _ = label(mn >= 255 - 28)
    edge = set(np.unique(np.concatenate([L[0], L[:, 0], L[:, -1]]))) - {0}
    bg = np.isin(L, list(edge))
    # 실루엣 밖 배경까지의 거리(원본 픽셀)
    h, w = mn.shape
    dist = np.full((h, w), 1 << 20, np.int32); q = deque(zip(*np.nonzero(bg))); dist[bg] = 0
    while q:
        y, x = q.popleft(); d = dist[y, x] + 1
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and dist[ny, nx] > d:
                dist[ny, nx] = d; q.append((ny, nx))
    Lc, s = label((mn >= PURE) & ~bg)
    keep = [k for k in np.nonzero(s >= MIN_CORE)[0] if k > 0 and is_pocket(raw, Lc, k, dist, deep)]
    for x, y in picks:
        win = Lc[max(y - 20, 0):y + 21, max(x - 20, 0):x + 21]
        ys, xs = np.nonzero(win)
        if len(ys):
            i = np.argmin((ys - min(y, 20)) ** 2 + (xs - min(x, 20)) ** 2)
            keep.append(win[ys[i], xs[i]])
    core = np.isin(Lc, keep)
    isl = core.copy()
    near = (mn >= NEAR) & ~bg
    for _ in range(GROW):
        isl = dilate(isl, 1) & near
    return bg, isl


def find_raw(repo, name, size):
    """완성 그림과 크기가 맞는 원본 출력을 찾는다(도로시 쪽 공유 초상은 나유타 저장소 raw)."""
    cands = [repo / "assets/raw" / name, repo.parent / "nayuta-trial/assets/raw" / name,
             repo.parent / "nayuta-trial/assets/raw" / name.replace("anis_", "anis_star_")]
    for p in cands:
        if not p.exists():
            continue
        raw = np.array(Image.open(p).convert("RGB")).astype(int)
        picks = next((v for k, v in PICK.items() if name.startswith(k)), ())
        bg, isl = islands(raw, name.startswith(HAIR_DEEP), picks)
        ys, xs = np.nonzero(~bg)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        bw, bh = box[2] - box[0], box[3] - box[1]
        sc = min(720 / bw, 720 / bh, 1)
        if abs(round(bw * sc) - size[0]) <= 1 and abs(round(bh * sc) - size[1]) <= 1:
            return p, isl, box
    return None, None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", type=pathlib.Path)
    ap.add_argument("names", nargs="*")
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--diag", type=pathlib.Path)
    a = ap.parse_args()
    pdir = a.repo / "assets/portraits"
    files = [pdir / f"{n}.png" for n in a.names] if a.names else sorted(pdir.glob("*.png"))
    for f in files:
        if f.name.startswith(SKIP):
            print(f"{f.name}: 흰 머리·흰 옷 인물 — 건너뜀")
            continue
        im = Image.open(f)
        p, isl, box = find_raw(a.repo, f.name, im.size)
        if p is None:
            print(f"{f.name}: 원본 없음 — 건너뜀")
            continue
        # 원본 마스크를 완성 그림 크기로 줄여, 칸의 절반 이상이 섬이면 지운다
        m = Image.fromarray((isl[box[1]:box[3], box[0]:box[2]] * 255).astype(np.uint8))
        m = np.array(m.resize(im.size, Image.BOX)) >= 128
        rgba = np.array(im.convert("RGBA"))
        hit = m & (rgba[:, :, 3] >= 128)
        print(f"{f.name}: 원본 {p.parent.parent.parent.name}/{p.name}, 지울 픽셀 {hit.sum()}")
        if a.diag:
            d = rgba.copy(); d[d[:, :, 3] < 128] = [40, 40, 60, 255]; d[hit] = [255, 0, 0, 255]
            a.diag.mkdir(parents=True, exist_ok=True)
            Image.fromarray(d).save(a.diag / f.name)
        if a.save and hit.any():
            if im.mode == "P":
                # 팔레트 그림은 투명 색 번호로 바꿔 넣는다(다시 양자화하면 색이 흔들린다)
                tr = im.info["transparency"]
                clear = next(i for i, v in enumerate(tr) if v == 0)
                px = np.array(im); px[hit] = clear
                out = Image.frombytes("P", im.size, px.tobytes()); out.putpalette(im.getpalette()); out.info["transparency"] = tr
                out.save(f, optimize=True, transparency=tr)
            else:
                rgba[hit, 3] = 0
                Image.fromarray(rgba).save(f, optimize=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""원본 그림 → 도트 초상화 일괄 생성 (고려대 LLM 이미지 모델 경유).

순서
  1. 인물마다 원본 그림(ref)을 참고해 '기본(normal)' 도트 초상화를 만든다.
  2. 나머지 표정은 방금 만든 기본 초상화를 참고로 표정만 바꾼다(얼굴·옷이 흔들리지 않게).
  3. 흰 배경을 투명하게 지우고 assets/portraits/<인물>_<표정>.png 로 저장한다.

사용법
  tools/make_portraits.py --plan                 # 무엇을 몇 장 만들지와 예상 크레딧만 보여 줌
  tools/make_portraits.py                        # 없는 그림만 생성
  tools/make_portraits.py nayuta --force         # 특정 인물만 다시 생성
  tools/make_portraits.py --clean-only           # 생성 없이 raw/ → portraits/ 배경 제거만 다시

원본 그림 위치: --ref-dir (기본 Dropbox '00. Inbox/dorothy-ref'), 파일 이름 = <인물 id>.png|jpg|jpeg|webp
"""
import argparse, pathlib, subprocess, sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
KU_DRAW = pathlib.Path.home() / "Library/CloudStorage/Dropbox/00. Cockpit/tools/ku_draw.py"
REF_DIR = pathlib.Path.home() / "Library/CloudStorage/Dropbox/00. Inbox/dorothy-ref"
RAW = ROOT / "assets/raw"            # 모델이 준 원본 출력(흰 배경)
OUT = ROOT / "assets/portraits"
CREDITS_PER_IMAGE = 11               # gpt-image-2.5-sunburst 실측(2026-10-04)

# 시나리오(data/case1.js)에서 쓰는 표정만
FACES = {
    # 나유타 재판에서 가져온 초상(judge·prosecutor·snowwhite·hongryeon·johan·anis…)은 여기 두지 않는다 — 다시 만들지 않게
    "dorothy": ["normal", "smile", "angry", "sad"],  # 피고. 귀족적 존댓말, 겉은 복수심·속은 방주를 사랑함
    "dorothy_alt": ["normal", "smile", "sad"],      # 도로시 최신 이격(미출시, 사용자 제공 그림) — 3심 엔딩에서 alias로 바꿈
    "medium": ["normal", "trance"],                  # 영매 = 양산형 니케(Product 08)
    # 빙의 모습: 옷은 영매(medium) 그대로, 얼굴·머리·체형만 그 인물. 참고 = medium_normal + <인물>.png
    "medium_redhood": ["normal", "smile", "sad"],
    "rapi": ["normal", "stern", "sad"],              # 카운터스. 1심 피해자 증인, 프롤로그에서 변호를 권함
    "neon": ["normal", "smile", "shock"],            # 카운터스. 1심 증인(채널 협상)
}
FACE_DESC = {
    "normal": "calm, neutral expression",
    "sad": "sad expression, eyes lowered, slight frown",
    "smile": "gentle, warm smile",
    "shock": "shocked expression, wide eyes, mouth open, a small sweat drop",
    "drunk": "tipsy expression, flushed red cheeks, half-closed eyes, relaxed grin",
    "stern": "stern, serious expression, narrowed eyes, closed mouth",
    "confident": "confident smirk, determined sharp eyes, slight smile",
    "angry": "angry expression, furrowed brows, glaring eyes, gritted teeth",
    "trance": "eyes closed in a trance, faint purple glow around the head, calm face",
    "open": "eyes opened, bright glowing light sky-blue irises with a white star-shaped highlight, serious determined look",
}
STYLE = ("16-bit retro game pixel art, clearly visible chunky square pixels, limited palette of about 32 colors, "
         "clean dark 1-pixel outline, no anti-aliasing, no dithering noise. "
         "Bust portrait (head and upper body), facing the viewer, centered. "
         "Plain pure white background, no text, no frame, no UI, no shadow on the background.")


def prompt_base(face):
    return ("Redraw the character from the reference image as a pixel art character portrait. "
            "Keep the same hairstyle, hair color, eye color, outfit, hat and accessories as the reference. "
            f"Expression: {FACE_DESC[face]}. " + STYLE)


def prompt_variant(face):
    return ("This is a pixel art portrait. Draw the exact same character, same pose, same framing, same pixel style "
            f"and same colors. Only change the facial expression to: {FACE_DESC[face]}. " + STYLE)


def prompt_possessed(face):
    return ("Image 1 is a pixel art portrait of a soldier android. Image 2 is another character. "
            "Draw a new pixel art portrait: keep the exact outfit, armor and colors of image 1 (remove the helmet), "
            "but give the person the face, hair, hair color, eye color, horns or hair accessories and body shape of image 2. "
            f"Expression: {FACE_DESC[face]}. " + STYLE)


def find_ref(ref_dir, cid):
    for ext in ("png", "jpg", "jpeg", "webp", "PNG", "JPG", "JPEG"):
        p = ref_dir / f"{cid}.{ext}"
        if p.exists():
            return p
    return None


def generate(prompt, refs, dest):
    cmd = [sys.executable, str(KU_DRAW), prompt, "-o", str(dest), "-r", "1:1"]
    for r in refs:
        cmd += ["-i", str(r)]
    print(f"  생성 중: {dest.name}", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("   ", (res.stdout.strip().splitlines() or [""])[-1], res.stderr.strip()[-300:])
    return res.returncode == 0 and dest.exists()


def remove_background(src, dest, tol=28):
    """테두리에서 이어진 흰색(에 가까운) 영역만 투명하게 만든다. 인물 안쪽의 흰색은 남는다."""
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(int)
    near_white = (255 - rgb).max(axis=2) <= tol
    bg = np.zeros((h, w), bool)
    q = deque()
    # 상반신 그림은 아래가 옷에서 잘리므로 아래 테두리에서는 시작하지 않는다(흰 옷이 지워지는 것 방지)
    for x in range(w):
        for y in (0,):
            if near_white[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    a[bg, 3] = 0
    out = Image.fromarray(a)
    box = out.getbbox()
    if box:
        out = out.crop(box)
    # FHD 화면에서 초상화 칸이 약 720×672 픽셀이라 720으로 맞춘다.
    # 도트 그림은 색이 적어 128색 팔레트로 저장해도 보기엔 같고 파일이 작아진다(휴대폰 로딩용)
    out.thumbnail((720, 720), Image.LANCZOS)
    out = out.quantize(colors=128, method=Image.FASTOCTREE)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, optimize=True)
    print(f"  저장: {dest.relative_to(ROOT)} ({out.width}×{out.height}, 배경 {bg.mean():.0%} 제거)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chars", nargs="*", help="인물 id (비우면 전부)")
    ap.add_argument("--ref-dir", type=pathlib.Path, default=REF_DIR)
    ap.add_argument("--force", action="store_true", help="이미 있는 그림도 다시 생성")
    ap.add_argument("--plan", action="store_true", help="생성하지 않고 계획만 출력")
    ap.add_argument("--clean-only", action="store_true", help="raw/ 그림의 배경 제거만 다시")
    a = ap.parse_args()
    chars = a.chars or list(FACES)

    if a.clean_only:
        # raw/ 에는 배경·아이콘 원본도 있으므로 인물 초상(<인물>_<표정>.png)만 고른다
        for cid in chars:
            for face in FACES[cid]:
                p = RAW / f"{cid}_{face}.png"
                if p.exists():
                    remove_background(p, OUT / p.name)
        return 0

    todo, missing = [], []
    for cid in chars:
        # 빙의 모습(medium_<인물>)은 그 인물의 원본 그림을 참고로 쓴다
        ref = find_ref(a.ref_dir, cid.split("_", 1)[1] if cid.startswith("medium_") else cid)
        if not ref:
            missing.append(cid); continue
        for face in FACES[cid]:
            if a.force or not (RAW / f"{cid}_{face}.png").exists():
                todo.append((cid, face, ref))
    if missing:
        print(f"원본 그림 없음 (건너뜀): {', '.join(missing)} — {a.ref_dir}/<id>.png 로 넣어 주세요")
    print(f"생성할 그림 {len(todo)}장, 예상 크레딧 약 {len(todo) * CREDITS_PER_IMAGE}")
    for cid, face, ref in todo:
        print(f"  - {cid}_{face}  (참고: {ref.name if face == 'normal' else cid + '_normal'})")
    if a.plan or not todo:
        return 0

    failed = []
    for cid, face, ref in todo:
        raw = RAW / f"{cid}_{face}.png"
        if cid.startswith("medium_") and face == "normal":
            base = RAW / "medium_normal.png"
            ok = base.exists() and generate(prompt_possessed(face), [base, ref], raw)
        elif face == "normal":
            ok = generate(prompt_base(face), [ref], raw)
        else:
            base = RAW / f"{cid}_normal.png"
            ok = base.exists() and generate(prompt_variant(face), [base], raw)
        if ok:
            remove_background(raw, OUT / raw.name)
        else:
            failed.append(raw.stem)
    if failed:
        print(f"실패: {', '.join(failed)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

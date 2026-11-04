#!/usr/bin/env python3
"""법정 배경 · 증거품 아이콘 생성 (고려대 LLM 이미지 모델 경유).

  tools/make_assets.py            # 없는 아이콘만 생성
  tools/make_assets.py --bg       # 법정 배경도 다시 저장(주의: 지금 배경을 덮어씀)
  tools/make_assets.py --force    # 전부 다시
모델 원본은 assets/raw/ 에, 게임용은 assets/bg/court.png · assets/evidence/<id>.png 에 저장한다.
"""
import argparse, pathlib, subprocess, sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from make_portraits import KU_DRAW, ROOT, RAW, remove_background  # noqa: E402

STYLE = ("16-bit retro game pixel art, clearly visible chunky square pixels, limited palette, "
         "clean dark outline, no text, no letters, no UI.")

# 도로시 재판: 배경은 나유타 재판에서 가져왔다. 갱생관(rehab)=raw/bg_rehab_2, 중앙정부 광장(plaza)=raw/bg_plaza_1, A.C.P.U. 본부(acpu)=raw/bg_acpu_1 을 128색으로 줄인 것.
# 참고: 지금 게임 배경(assets/bg/court.png)은 assets/raw/bg_mass_2.png(밝은 캐주얼 + 양산형 니케·눈 가린 NPC 관중)를 골라 넣은 것이다.
# 아래 BG는 처음 만든 어두운 배경의 지시문이다. 다시 돌리면 어두운 배경으로 덮어쓰니 주의.
# 휴정 대기실(assets/bg/lobby.png)은 assets/raw/bg_lobby_2.png 를 128색으로 줄인 것이다(법정 배경 bg_mass_2를 화풍 참고로 생성).
BG = ("Wide pixel art background of a futuristic underground-city courtroom interior, seen from the front. "
      "A high judge's bench in the back center under a large round emblem. "
      "On the left, a jury box with six ordinary civilians of a sci-fi underground city (casual jackets, hoodies, work uniforms). "
      "On the right, audience gallery benches crowded with ordinary civilians watching. "
      "The middle foreground is an empty open floor. Dim blue and warm wood tones, cinematic lighting. " + STYLE)

ICONS = {
    # 도로시 재판 제1심 증거품
    "e0": "a folded official legal document with a red seal stamp and a small gavel emblem",
    "e1": "a stack of meeting minutes papers with a small silver USB stick lying on top",
    "e2": "a small retro broadcast monitor showing a green mountain landscape, with a tiny antenna",
    "e3": "a medical injection gun syringe with green liquid, with one bullet hole crack in its barrel",
    "e4": "an old red cassette tape with a hand-written blank label",
    "e5": "a pink speech bubble shaped note card with a small heart drawn in the corner",
    "e6": "a sealed official expulsion letter envelope with a dark gray wax seal",
    "e7": "a small yellow memo note with a hand-drawn bowing stick figure",
    # 제2심
    "e8": "a folded official indictment document with a dark green military seal stamp",
    "e9": "a broadcast recording cassette next to a small screen showing a warning icon and a falling power gauge",
    "e10": "a thick bundle of citizen report forms with a few small heart stickers on them",
    "e11": "a forensic tag attached to a scorched metal robot torso fragment with a small antenna receiver chip",
    "e12": "a small pendant necklace with a light blue gem, inside a clear plastic evidence bag",
    "e13": "a clear evidence bag with many brass bullet casings and one glowing blue optical shell",
    "e14": "a radio signal log printout with sharp red spikes and a small military truck icon",
    "e15": "a confidential inspection report folder with a purple audit seal",
    # 제3심
    "e16": "a folded official indictment document with a navy blue seal and a small gavel emblem",
    "e17": "an old yellowed government archive file stamped with a large red X mark",
    "e18": "a cracked metal operation plaque from a defensive wall showing a progress gauge at 72 percent",
    "e19": "an old dusty field radio communication terminal with a faint pink glowing screen",
    "e20": "a small voice recorder device next to a steaming teacup",
    "e21": "a glowing tablet showing a document with a small green sprout emblem",
    "e22": "a security camera snapshot photo of a winged goddess statue at night with a small pink-haired figure cleaning it",
    "e23": "an old worn leather-bound handwritten notebook tied with a string",
    "e25": "a rusty metal signboard with a new name plate bolted over an older erased name",
    "e26": "an old red sword scabbard with seven bullet dents along its length",
    "e27": "an ancient sealed roster book with a broken blue wax seal, one line on the page crossed out",
}


def draw(prompt, dest, ratio):
    cmd = [sys.executable, str(KU_DRAW), prompt, "-o", str(dest), "-r", ratio]
    print(f"  생성 중: {dest.name}", flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    print("   ", (r.stdout.strip().splitlines() or [""])[-1], r.stderr.strip()[-300:], flush=True)
    return r.returncode == 0 and dest.exists()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--bg", action="store_true")
    a = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    # 배경은 --bg 를 줄 때만 건드린다. 아이콘만 만들다가 지금 배경(bg_mass_2)을 어두운 옛 배경으로 덮어쓰지 않도록
    raw_bg, out_bg = RAW / "bg_court.png", ROOT / "assets/bg/court.png"
    if a.bg and (a.force or not raw_bg.exists()):
        draw(BG, raw_bg, "16:9")
    if a.bg and raw_bg.exists():
        im = Image.open(raw_bg).convert("RGB")
        im.thumbnail((1920, 1080), Image.LANCZOS)
        im.quantize(colors=128, method=Image.FASTOCTREE).save(out_bg, optimize=True)
        print(f"  저장: {out_bg.relative_to(ROOT)} {im.size}")

    for eid, what in ICONS.items():
        raw = RAW / f"icon_{eid}.png"
        if a.force or not raw.exists():
            draw(f"Pixel art game item icon, centered, filling most of the frame: {what}. Plain pure white background. " + STYLE, raw, "1:1")
        if raw.exists():
            dest = ROOT / f"assets/evidence/{eid}.png"
            remove_background(raw, dest)
            im = Image.open(dest).convert("RGBA")
            im.thumbnail((256, 256), Image.LANCZOS)
            im.save(dest, optimize=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

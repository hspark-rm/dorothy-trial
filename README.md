# 도로시 재판: 지휘관의 변론 — 시험판 v0.1 (제1심)

도트 감성 법정 공방 팬게임. 「승리의 여신: 니케」 비공식 팬 제작물. 지휘관이 되어 방주 법정에 선 도로시를 변호한다.
엔진은 자매작 「나유타 재판」(github.com/hspark-rm/nayuta-trial)에서 갈라져 나왔다.

> 이 프로젝트는 비영리 팬 프로젝트이며 원작의 권리를 존중합니다. 모든 캐릭터·세계관의 권리는 SHIFT UP에 있습니다.
> 권리자가 요청하면 즉시 중단하고 삭제합니다. 모델 원본 출력(`assets/raw/`)은 올리지 않습니다.

플레이: <https://dorothy-trial.pages.dev/> (Cloudflare Pages, `tools/deploy_cf.sh`로 올림)

제작: 닥터야돈 · 피드백: globalchmist@naver.com

지금 들어 있는 것: 제1심 「사랑받지 못한 채널」(갱생관 조사, 영매 레드 후드) → 제2심 「도반의 법정」(광장·A.C.P.U. 본부 조사, 영매 피나). → 제3심 「승리의 여신에게」(방주 입구·전장·에덴 조사 2회, 영매 오스왈드, 가면을 쓴 재판장 엔더슨) → 에필로그.

## 실행

```bash
python3 -m http.server 8841 --bind 127.0.0.1 --directory ~/Developer/dorothy-trial
```

브라우저에서 <http://127.0.0.1:8841> 을 연다. `index.html`을 파일로 바로 열면 그림 도트 변환이 막힌다(브라우저 보안 규칙).

### 휴대폰에서 하기

1. 맥과 휴대폰을 같은 와이파이에 연결한다.
2. 맥 터미널에서 `~/Developer/dorothy-trial/tools/serve-lan.sh` 를 실행한다.
3. 화면에 나온 `http://192.168.…:8850` 주소를 휴대폰 브라우저에서 연다.
4. 휴대폰을 가로로 돌린다. 안드로이드는 타이틀의 **전체 화면** 버튼을 누르면 가로로 고정된다.

맥 방화벽이 연결 허용을 물으면 허용한다. 맥이 꺼지거나 터미널을 닫으면 휴대폰에서도 멈춘다. 집 밖 인터넷에서는 열리지 않는다.
아이폰은 사파리 공유 → **홈 화면에 추가**로 열면 주소창 없이 쓸 수 있다.

## 조작

| 동작 | 키보드 | 마우스·터치 |
|---|---|---|
| 대사 넘기기 | Enter · Space · Z | 화면 아무 곳 누르기 |
| 증언 앞뒤로 | ← → | ◀ ▶ |
| 캐묻기 | X | 캐묻기 |
| 증거 목록 · 증거 내기 | E | 증거 E · 증거 내기 |
| 증거 고르기 · 제시 | ↑ ↓ · Z | 목록 누르기 · 제시 |
| 소리 켜기/끄기 | M | 타이틀의 소리 버튼 |

틀린 증거를 내면 재판장 인내심(왼쪽 위 하트)이 1칸 준다. 5칸이 모두 없어지면 패소하고, 마지막 저장 지점부터 다시 한다.

## 그림 넣기

PNG 파일을 아래 이름으로 넣으면 게임이 32색 도트 그림으로 바꿔서 보여 준다. 파일이 없으면 회색 자리표시 그림이 나온다.

- 인물: `assets/portraits/<인물>_<표정>.png` — 그 표정 파일이 없으면 `_normal`을 쓴다.
- 증거: `assets/evidence/<증거 id>.png` (32×32로 줄여 씀)
- 배경: `assets/bg/court.png` (320×180으로 잘라 씀)

### 원본 그림으로 도트 초상화 만들기 (고려대 LLM)

1. 원본 그림(게임 스크린샷도 됨)을 Dropbox `00. Inbox/dorothy-ref/` 에 `nayuta.png`, `anis.png`, `hongryeon.png` 이름으로 넣는다.
2. `tools/make_portraits.py --plan` 으로 장수와 예상 크레딧을 본다(1장 약 11).
3. `tools/make_portraits.py` 를 실행한다. 기본 표정을 먼저 만들고, 나머지 표정은 그 그림을 참고로 표정만 바꾼다.
4. 흰 배경을 지운 결과가 `assets/portraits/` 에 들어간다. 모델 원본 출력은 `assets/raw/` 에 남는다.

투명 여백은 자동으로 잘라 낸다. 전신 그림이면 상반신만 쓴다. 범위를 직접 정하려면 `data/case1.js`의 인물에 `crop: [x, y, 폭, 높이]`(그림 크기 대비 0~1 비율)를 넣는다.

| 인물 id | 배역 | 쓰는 표정 |
|---|---|---|
| `judge` | 1·2심 재판장 에닉 (나유타 재판에서 가져옴) | normal, stern |
| `prosecutor` | 1심 검사 노벨 (가져옴) | normal, stern |
| `me` | 변호인 지휘관 — 초상 없음(`portrait: false`) | — |
| `dorothy` | 피고 도로시 | normal, smile, angry, sad |
| `medium` | 영매(양산형 니케 Product 08) | normal, trance |
| `medium_redhood` | 빙의한 레드 후드(영매 옷 + 레드 후드 얼굴·체형) | normal, smile, sad |
| `johan` | 1심 증인 요한 (가져옴) | normal, stern, shock |
| `rapi` · `anis` · `neon` | 카운터스 — 최신 이격(라피: 레드 후드, 아니스: 스타, 네온: 비전 아이) | 각 3표정 |
| `doban` · `burningham` | 2심 검사 도반, 3심 검사 버닝엄 | 각 3표정 |
| `poli` · `miranda` · `citizen` | 2심 증인 폴리·미란다·방주 시민 | 각 3표정 |
| `medium_fina` | 빙의한 피나 | normal, sad |
| `dorothy_alt` | 도로시 최신 이격(3심 엔딩용, 사용자 제공 그림) | normal, smile, sad |
| `andersen` · `andersen_hidden` | 3심 재판장 엔더슨(맨얼굴) / 두건·가면 | 3표정 / normal |
| `medium_oswald` | 빙의한 오스왈드 | normal, sad |
| `snowwhite` · `hongryeon` · `cecil` | 3심 증인 (나유타 재판에서 가져옴) | 각 3표정 |

⚠ 도반 초상(`doban_*`)은 생성 뒤 이마의 총알 구멍과 동공 없는 눈을 프로그램으로 직접 그려 넣었다(저승에서 돌아온 설정). `make_portraits.py --force`로 다시 만들면 사라진다.

빙의 모습(`medium_<인물>`)은 `make_portraits.py`가 `medium_normal`과 그 인물의 원본 그림 두 장을 참고로 만든다. 나유타 재판에서 가져온 초상(에닉·노벨·요한·아니스·세실·홍련·스노우 화이트·나유타)은 `FACES`에 넣지 않아 다시 만들지 않는다.


## 시나리오 고치기

시나리오는 `data/case1.js` 한 파일이다. 줄마다 하나의 명령이다.

| 명령 | 모양 |
|---|---|
| 대사 | `{ who: 'nayuta', face: 'sad', line: '…' }` (`who: null`이면 이름 없는 안내문, `me`는 지휘관. `(`로 시작하는 지휘관 대사는 속마음 색) |
| 장 제목 | `{ op: 'chapter', text: '제1심', sub: '독잔 사건' }` |
| 증언 | `{ op: 'testimony', title, witness, statements: [{ line, face, press: [대사…], present: { 증거id: 'label' } }], after: [대사…], loop: [대사…], hints: ['…'], wrong: [대사…] }` — `after` = 증언을 다 들은 뒤 신문 전에 나오는 대사(변호인의 고민·검사의 도발), `loop` = 증언을 한 바퀴 돌았을 때 한 번 나오는 고민(없으면 `CASE.pressure.loop`) |
| 증거 요구 | `{ op: 'demand', who, line, answer: 증거id, ok: 'label', wrong: [대사…] }` |
| 증거 받기 | `{ op: 'give', id: 'e3' }` |
| 표시·이동 | `{ op: 'label', id }` · `{ op: 'goto', id }` |
| 연출 | `{ op: 'fx', kind: 'stamp' \| 'shake' \| 'flash' \| 'gavel', text, color }` — `gavel` = 재판봉(흔들림 + 소리), `stamp`의 `color`로 띠 색을 바꾼다(노벨의 이의 = `#6a3a9a`) |
| 배경 | `{ op: 'bg', id }` — `court`·`void`·`nightmare`·`lobby`·`night`는 정해진 배경, 그 밖의 id는 `assets/bg/<id>.png`(지금 `edenlab`·`coffin`·`battle`) |
| 조사 | `{ op: 'investigate', id, start, places: { 장소id: { name, bg, who, desc, move: [장소id], enter: [대사…], spots: [{ name, x, y, w, h, needs, lines: [대사…], again: [대사…] }], talk: [{ topic, needs, lines, again }] } }, done: { needs: [증거id], lines } }` — 좌표는 320×180 기준, `needs`의 증거를 가져야 그 지점·주제·장소가 열린다. 조사 중 `give`는 "새 증거품" 카드로 보인다 |
| 빙의 | `{ op: 'possess', who: 'medium', as: 'redhood' }` — 영매의 옷은 그대로, 얼굴·체형만 그 인물(그림 = `medium_redhood_<표정>.png`), 이름표 "영매(레드 후드)". `as: null`이면 풀림 |
| 별칭 | `{ op: 'alias', who, portrait, name }` — 인물의 그림·이름표를 장면 중에 바꿈(예: 얼굴을 가린 3심 재판장). `portrait` 없이 쓰면 원래대로 |
| 선택지 | `{ op: 'choice', prompt, hints, options: [{ label, goto } 또는 { label, wrong: [대사…] }] }` — `wrong` 선택지는 하트가 줄고 같은 선택지로 돌아옴(영매 소환 퍼즐) |
| 초상 숨기기 | `{ op: 'hide' }` |
| 저장 지점 | `{ op: 'save' }` (여기서 하트가 다시 다 찬다) |
| 끝 | `{ op: 'end', result: 'win', title, text }` |

**게임 문구(`CASE`)**: `gameId`(저장 이름), `title`·`tagline`(타이틀), `nightmare`(프롤로그 댓글), `over`(패소 화면 인물·대사).

**재판의 압박(`CASE.pressure`)**: 오답 뒤 하트가 2개·1개 남으면 `pressure[2]`·`pressure[1]`의 경고를 차례로 돌려 쓴다. 하트가 2개 이하면 화면 가장자리가 붉게 맥박치고 음악이 위기곡으로 바뀌며, 1개면 "종결 경고"가 뜬다.

없는 인물·증거·label을 가리키면 타이틀 왼쪽 위에 "데이터 오류 N건"이 뜨고, 브라우저 콘솔에 목록이 나온다.

## 글꼴

갈무리11 (quiple/galmuri, SIL OFL 1.1). jsDelivr에서 받는다. 인터넷이 없으면 시스템 글꼴을 도트처럼 깎아서 쓴다.

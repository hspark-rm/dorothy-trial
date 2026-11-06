-- 익명 방문 집계(2026-11-05). 브라우저마다 무작위 번호(vid) 하나, 종류별로 한 번만 센다
CREATE TABLE IF NOT EXISTS hits (
  game TEXT NOT NULL,
  vid  TEXT NOT NULL,
  kind TEXT NOT NULL,          -- visit 방문 / start 새로 시작 / finish 엔딩
  day  TEXT NOT NULL,          -- 처음 기록된 날(한국 시간)
  PRIMARY KEY (game, vid, kind)
);

-- 짧은 설문(2026-11-06). 게임 중 메뉴·엔딩 화면에서 보낸다. IP는 저장하지 않는다
CREATE TABLE IF NOT EXISTS surveys (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  game   TEXT NOT NULL,
  vid    TEXT,                 -- 집계와 같은 브라우저 번호(없으면 NULL)
  me     INTEGER NOT NULL DEFAULT 0,  -- 1 = 제작자 본인 기기(?me)
  day    TEXT NOT NULL,        -- 한국 날짜
  at     TEXT NOT NULL,        -- 한국 시각 YYYY-MM-DD HH:MM
  fun    INTEGER,              -- 재미 1~5
  diff   TEXT,                 -- 체감 난이도 easy / ok / hard
  stuck  TEXT,                 -- 막혔거나 이상했던 곳
  wish   TEXT,                 -- 바라는 점
  place  TEXT,                 -- 보낸 위치(제N심 / 엔딩)
  level  TEXT,                 -- 고른 난이도 easy / normal / hard
  wrongs INTEGER, hints INTEGER, overs INTEGER, min INTEGER
);

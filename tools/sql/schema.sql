-- 익명 방문 집계(2026-11-05). 브라우저마다 무작위 번호(vid) 하나, 종류별로 한 번만 센다
CREATE TABLE IF NOT EXISTS hits (
  game TEXT NOT NULL,
  vid  TEXT NOT NULL,
  kind TEXT NOT NULL,          -- visit 방문 / start 새로 시작 / finish 엔딩
  day  TEXT NOT NULL,          -- 처음 기록된 날(한국 시간)
  PRIMARY KEY (game, vid, kind)
);

-- 0009_chapter_theme.sql
ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL
  DEFAULT '{"enabled": false, "accent_hex": null, "source": "auto"}'::jsonb;

COMMENT ON COLUMN chapters.theme IS
  'Chapter UI theme: {enabled: bool, accent_hex: "#RRGGBB"|null, source: "auto"|"manual"}';

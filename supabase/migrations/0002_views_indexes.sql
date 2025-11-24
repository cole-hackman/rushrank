BEGIN;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pnms_chapter_name ON pnms (chapter_id, name);
CREATE INDEX IF NOT EXISTS idx_pnms_name_trgm ON pnms USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_votes_round_pnm ON votes (round_id, pnm_id);
CREATE INDEX IF NOT EXISTS idx_votes_round_voter ON votes (round_id, voter_user_id);

CREATE INDEX IF NOT EXISTS idx_event_attendance_pnm ON event_attendance (pnm_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON event_attendance (event_id);

CREATE INDEX IF NOT EXISTS idx_pnm_notes_pnm_created_at ON pnm_notes (pnm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pnm_tags_pnm ON pnm_tags (pnm_id);
CREATE INDEX IF NOT EXISTS idx_pnm_tags_tag ON pnm_tags (tag_id);

-- Materialized view for full-text search
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pnms_search AS
SELECT
  p.id AS pnm_id,
  p.chapter_id,
  setweight(to_tsvector('simple', coalesce(p.name,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(p.major,'')), 'B') ||
  setweight(to_tsvector('simple', coalesce(p.hometown,'')), 'C') ||
  setweight(to_tsvector('simple', array_to_string(ARRAY(
    SELECT t.label FROM pnm_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE pt.pnm_id = p.id
  ), ' ')), 'C') AS document
FROM pnms p;

CREATE INDEX IF NOT EXISTS idx_mv_pnms_search_doc ON mv_pnms_search USING gin (document);

CREATE OR REPLACE FUNCTION refresh_mv_pnms_search() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pnms_search;
END$$;

-- Rankings View
CREATE OR REPLACE VIEW v_round_rankings AS
WITH scoring AS (
  SELECT
    v.round_id,
    v.pnm_id,
    COUNT(*) AS total_votes,
    COUNT(*) FILTER (WHERE v.value = 'YES') AS yes_count,
    COUNT(*) FILTER (WHERE v.value = 'NO') AS no_count,
    COUNT(*) FILTER (WHERE v.value = 'UNKNOWN') AS unknown_count,
    COUNT(*) FILTER (WHERE v.favorite) AS favorite_count,
    -- Numeric score mapping
    SUM(
      CASE v.value
        WHEN 'YES' THEN 1.0
        WHEN 'UNKNOWN' THEN 0.5
        ELSE 0.0
      END
      * (CASE WHEN u.is_exec THEN COALESCE(NULLIF((vr.settings->>'execWeight')::numeric, NULL), 1.0) ELSE 1.0 END)
    ) AS weighted_sum,
    SUM( (CASE WHEN u.is_exec THEN COALESCE(NULLIF((vr.settings->>'execWeight')::numeric, NULL), 1.0) ELSE 1.0 END) ) AS weight_total
  FROM votes v
  JOIN users u ON u.id = v.voter_user_id
  JOIN voting_rounds vr ON vr.id = v.round_id
  GROUP BY v.round_id, v.pnm_id
)
SELECT
  s.round_id,
  s.pnm_id,
  s.yes_count,
  s.no_count,
  s.unknown_count,
  s.favorite_count,
  CASE WHEN s.total_votes > 0 THEN ROUND((s.yes_count::numeric / s.total_votes)::numeric, 4) ELSE 0 END AS yes_ratio,
  CASE WHEN s.weight_total > 0 THEN ROUND((s.weighted_sum / s.weight_total)::numeric, 4) ELSE 0 END AS weighted_score
FROM scoring s;

-- Public Votes View with anonymity masking
CREATE OR REPLACE VIEW v_votes_public AS
SELECT
  v.id,
  v.round_id,
  v.pnm_id,
  CASE
    WHEN COALESCE((vr.settings->>'anonymous')::boolean, false) THEN NULL
    ELSE v.voter_user_id
  END AS voter_user_id,
  v.value,
  v.favorite,
  v.voted_at
FROM votes v
JOIN voting_rounds vr ON vr.id = v.round_id;

-- Optional RLS scaffolding (commented)
-- ALTER TABLE pnms ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "pnms_chapter_isolation" ON pnms
--   FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.chapter_id = pnms.chapter_id));
-- -- Admin-only export example:
-- ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "exports_admin_only" ON exports
--   FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'ADMIN'));

COMMIT;


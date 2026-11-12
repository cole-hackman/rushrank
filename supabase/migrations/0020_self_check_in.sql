-- 0020_self_check_in.sql
--
-- A PNM can check himself in by scanning the event's QR code. Those rows are
-- recorded with their own method, so the attendance list can tell a brother's
-- scan from a self check-in, and with no checked_in_by_user_id (already
-- nullable), because no brother did it.
--
-- Additive: one new label on an existing enum.

ALTER TYPE attendance_method ADD VALUE IF NOT EXISTS 'SELF';

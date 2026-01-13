-- Migration to add fun_fact column to pnms table
BEGIN;

ALTER TABLE pnms ADD COLUMN IF NOT EXISTS fun_fact text;

COMMIT;

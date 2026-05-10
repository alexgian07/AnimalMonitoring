-- Phase 1: Pen renaming + side/position layout
-- Run once in Supabase SQL Editor.

-- Add columns for ordering and side grouping (idempotent)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS position INTEGER;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('left','right'));

-- Rename seeded pens A..H to Κελί 1..8 with positions and sides
UPDATE locations SET name = 'Κελί 1', description = 'Αριστερή πλευρά', position = 1, side = 'left'  WHERE name = 'Pen A';
UPDATE locations SET name = 'Κελί 2', description = 'Αριστερή πλευρά', position = 2, side = 'left'  WHERE name = 'Pen B';
UPDATE locations SET name = 'Κελί 3', description = 'Αριστερή πλευρά', position = 3, side = 'left'  WHERE name = 'Pen C';
UPDATE locations SET name = 'Κελί 4', description = 'Αριστερή πλευρά', position = 4, side = 'left'  WHERE name = 'Pen D';
UPDATE locations SET name = 'Κελί 5', description = 'Δεξιά πλευρά',    position = 5, side = 'right' WHERE name = 'Pen E';
UPDATE locations SET name = 'Κελί 6', description = 'Δεξιά πλευρά',    position = 6, side = 'right' WHERE name = 'Pen F';
UPDATE locations SET name = 'Κελί 7', description = 'Δεξιά πλευρά',    position = 7, side = 'right' WHERE name = 'Pen G';
UPDATE locations SET name = 'Κελί 8', description = 'Δεξιά πλευρά',    position = 8, side = 'right' WHERE name = 'Pen H';

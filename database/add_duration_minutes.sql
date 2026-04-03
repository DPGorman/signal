-- Add duration_minutes to deliverables for time-blocking and workload calculation
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Signal — upsert_lexicon_terms RPC
-- Applied to signal-multi (czgjbblkoyyojnaziyuy) on 2026-05-06.
-- Pairs with the Step F migration (app.jsx capture flow): when capture mode
-- returns lexicon_extract, api/ai.js batches the terms into one RPC call
-- that increments frequency + updates last_seen on existing terms, inserts
-- new ones with frequency=1.
--
-- Idempotent. Safe to re-run.

CREATE OR REPLACE FUNCTION upsert_lexicon_terms(
  p_user_id UUID,
  p_terms JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  term_record RECORD;
  count_processed INTEGER := 0;
BEGIN
  IF p_terms IS NULL OR jsonb_array_length(p_terms) = 0 THEN
    RETURN 0;
  END IF;

  FOR term_record IN
    SELECT * FROM jsonb_to_recordset(p_terms) AS x(term TEXT, type TEXT)
  LOOP
    -- Skip empty terms, oversized terms, or invalid types.
    IF term_record.term IS NULL OR length(trim(term_record.term)) = 0 THEN
      CONTINUE;
    END IF;
    IF length(term_record.term) > 200 THEN
      CONTINUE;
    END IF;
    IF term_record.type NOT IN ('proper_noun', 'project_term', 'user_phrasing') THEN
      CONTINUE;
    END IF;

    INSERT INTO user_lexicon (user_id, term, type)
    VALUES (p_user_id, trim(term_record.term), term_record.type)
    ON CONFLICT (user_id, term) DO UPDATE SET
      frequency = user_lexicon.frequency + 1,
      last_seen = NOW();

    count_processed := count_processed + 1;
  END LOOP;

  RETURN count_processed;
END;
$$;

-- Revert: DROP FUNCTION IF EXISTS upsert_lexicon_terms(UUID, JSONB);

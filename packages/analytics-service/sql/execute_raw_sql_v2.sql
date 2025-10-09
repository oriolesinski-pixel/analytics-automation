-- Updated SQL function for SQL Sandbox
-- This version returns JSONB directly instead of TABLE

-- First, drop the old function if it exists
DROP FUNCTION IF EXISTS execute_raw_sql(TEXT);

-- Create the new function that returns JSONB array
CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_upper TEXT;
  result_json JSONB;
BEGIN
  -- Security: Convert to uppercase for checking
  query_upper := UPPER(TRIM(sql_query));
  
  -- Security: Only allow SELECT statements
  IF NOT query_upper LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Security: Block dangerous keywords
  IF query_upper ~ 'DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;
  
  -- Execute the query and return results as JSONB array
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*)) FROM (%s) t', sql_query) INTO result_json;
  
  -- If result is null (no rows), return empty array
  IF result_json IS NULL THEN
    result_json := '[]'::jsonb;
  END IF;
  
  RETURN result_json;
END;
$$;

-- Grant execute permission to the service role
-- GRANT EXECUTE ON FUNCTION execute_raw_sql(TEXT) TO service_role;

-- Test the function (optional - comment out in production)
-- SELECT execute_raw_sql('SELECT 1 as test, 2 as another');


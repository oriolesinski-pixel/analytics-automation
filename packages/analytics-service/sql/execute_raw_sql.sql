-- SQL function to execute raw SQL queries safely
-- This function is used by the SQL Sandbox to execute user queries

CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query TEXT)
RETURNS TABLE (result JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_upper TEXT;
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
  
  -- Execute the query and return results as JSON
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t.*) FROM (%s) t', sql_query);
END;
$$;

-- Grant execute permission to authenticated users (adjust as needed)
-- GRANT EXECUTE ON FUNCTION execute_raw_sql(TEXT) TO authenticated;

-- Alternative simpler version that returns raw results
CREATE OR REPLACE FUNCTION execute_raw_sql_simple(sql_query TEXT)
RETURNS SETOF RECORD
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security checks (same as above)
  IF NOT UPPER(TRIM(sql_query)) LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  IF UPPER(sql_query) ~ 'DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;
  
  -- Execute and return
  RETURN QUERY EXECUTE sql_query;
END;
$$;

-- Note: To use this function, you need to execute it in your Supabase SQL Editor
-- After creating the function, the SQL Sandbox will be able to execute queries.


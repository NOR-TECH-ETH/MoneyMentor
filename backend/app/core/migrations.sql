-- Enable vector extension
CREATE OR REPLACE FUNCTION enable_vector_extension()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
END;
$$;

-- Enable UUID extension
CREATE OR REPLACE FUNCTION enable_uuid_extension()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
END;
$$;

-- Create table function
CREATE OR REPLACE FUNCTION create_table(table_name text, table_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE table_sql;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION enable_vector_extension() TO authenticated;
GRANT EXECUTE ON FUNCTION enable_uuid_extension() TO authenticated;
GRANT EXECUTE ON FUNCTION create_table(text, text) TO authenticated; 
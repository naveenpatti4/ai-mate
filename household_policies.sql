-- First, drop the problematic policy that's causing the issue
DROP POLICY IF EXISTS "Allow authenticated users to create households" ON households;
DROP POLICY IF EXISTS "Allow users to create households" ON households;

-- Create a new policy that allows the public role to create households
CREATE POLICY "Allow users to create households" 
ON households FOR INSERT 
TO public 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create a safer function without the household_members insertion
CREATE OR REPLACE FUNCTION create_household_only(
  household_name TEXT,
  user_id UUID
)
RETURNS JSON AS $$
DECLARE
  new_household_id UUID;
  join_code TEXT;
BEGIN
  -- Generate a random join code
  SELECT UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) INTO join_code;
  
  -- Create the household only, don't try to add member
  INSERT INTO households (name, created_by, join_code)
  VALUES (household_name, user_id, join_code)
  RETURNING id INTO new_household_id;
  
  -- Return the household ID and join code
  RETURN json_build_object(
    'id', new_household_id,
    'join_code', join_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_household_only(TEXT, UUID) TO authenticated;

-- Create a function to find household by join code with fixed column references
DROP FUNCTION IF EXISTS find_household_by_join_code(text);
CREATE FUNCTION find_household_by_join_code(search_code TEXT)
RETURNS TABLE (
  household_id UUID,
  household_name TEXT,
  join_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id AS household_id,
    h.name AS household_name,
    h.join_code
  FROM households h
  WHERE h.join_code = UPPER(search_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_household_by_join_code(TEXT) TO authenticated;
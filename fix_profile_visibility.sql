-- Drop the existing restrictive policy for profiles
DROP POLICY IF EXISTS "profile_select_own" ON profiles;

DROP POLICY IF EXISTS "profiles_select_household_members" ON profiles;

DROP POLICY IF EXISTS "TEMP_DEBUG_profiles_select_all" ON profiles;

-- Create a new policy that allows users to see:
-- 1. Their own profile
-- 2. Profiles of users who are in the same household as them
CREATE POLICY "profiles_select_household_members" ON profiles
FOR SELECT TO public
USING (
  id = auth.uid() OR EXISTS (
    SELECT 1
    FROM household_members AS my_memberships
    JOIN household_members AS other_memberships 
      ON my_memberships.household_id = other_memberships.household_id
    WHERE 
      my_memberships.user_id = auth.uid() AND
      other_memberships.user_id = profiles.id
  )
);

-- Create an RPC function to get household members with their profiles
-- This uses a direct SQL approach with proper joins
CREATE OR REPLACE FUNCTION get_household_members_with_profiles(household_id_param UUID)
RETURNS TABLE (
  member_id UUID,
  user_id UUID,
  display_name TEXT,
  role TEXT,
  full_name TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hm.id AS member_id,
    p.id AS user_id,
    hm.display_name,
    hm.role,
    p.full_name,
    p.avatar_url
  FROM
    household_members hm
  LEFT JOIN
    profiles p ON hm.user_id = p.id
  WHERE
    hm.household_id = household_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_household_members_with_profiles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_members_with_profiles(UUID) TO public;

-- Create an RPC function to get expenses with creator profiles
-- Fix: Cast the date column to TEXT to match the declared return type
CREATE OR REPLACE FUNCTION get_expenses_with_creator_profiles(
  household_id_param UUID,
  start_date TEXT,
  end_date TEXT
)
RETURNS TABLE (
  expense_id UUID,
  store_name TEXT,
  amount NUMERIC,
  category TEXT,
  expense_date TEXT,
  description TEXT,
  created_by UUID,
  creator_name TEXT,
  creator_avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS expense_id,
    e.store_name,
    e.amount,
    e.category,
    e.date::TEXT AS expense_date,  -- Cast to TEXT to match return type
    e.description,
    e.created_by,
    p.full_name AS creator_name,
    p.avatar_url AS creator_avatar
  FROM
    expenses e
  LEFT JOIN
    profiles p ON e.created_by = p.id
  WHERE
    e.household_id = household_id_param
    AND e.date >= CAST(start_date AS DATE)
    AND e.date <= CAST(end_date AS DATE)
  ORDER BY e.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_expenses_with_creator_profiles(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_expenses_with_creator_profiles(UUID, TEXT, TEXT) TO public;

-- Maintain the existing update policy (only update your own profile)
DROP POLICY IF EXISTS "profile_update_own" ON profiles;
CREATE POLICY "profile_update_own" ON profiles 
FOR UPDATE TO public 
USING (auth.uid() = id);
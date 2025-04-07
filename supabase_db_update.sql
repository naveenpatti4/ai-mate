-- Supabase Database Update Script for AI-Mate Household Management
-- Run this in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clear existing tables if needed (be careful with this in production!)
-- Use CASCADE to ensure dependent objects like policies are also dropped
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Create profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create households table 
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    join_code TEXT NOT NULL UNIQUE, -- For inviting others easily
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create household_members table (join table)
CREATE TABLE IF NOT EXISTS household_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, household_id) -- Prevent duplicate memberships
);

-- 4. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    store_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 5. Create a function to automatically add the creator as a household member
CREATE OR REPLACE FUNCTION add_household_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS for this specific operation
    INSERT INTO household_members (user_id, household_id, display_name, role)
    VALUES (NEW.created_by, NEW.id, (SELECT full_name FROM profiles WHERE id = NEW.created_by), 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-add the creator
CREATE OR REPLACE TRIGGER on_household_created
AFTER INSERT ON households
FOR EACH ROW EXECUTE FUNCTION add_household_creator_as_member();

-- 6. Create a join code generator function (auto-generates when household is created)
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TRIGGER AS $$
DECLARE
    new_join_code TEXT;
BEGIN
    -- Generate a 6-character alphanumeric code
    new_join_code := SUBSTRING(MD5(NEW.id::TEXT || CURRENT_TIMESTAMP::TEXT) FROM 1 FOR 6);
    -- Make it uppercase for easier sharing
    NEW.join_code := UPPER(new_join_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to generate join code before household is inserted
CREATE OR REPLACE TRIGGER before_household_created
BEFORE INSERT ON households
FOR EACH ROW EXECUTE FUNCTION generate_join_code();

-- 7. Set up Row-Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY profile_select_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profile_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- Households: Users can select households they are members of
CREATE POLICY household_select_member ON households 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM household_members 
        WHERE household_id = households.id AND user_id = auth.uid()
    )
);

-- Households: Anyone can insert a household (they become the creator)
CREATE POLICY household_insert_any ON households FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Households: Only members can update/delete household
CREATE POLICY household_update_member ON households 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM household_members 
        WHERE household_id = households.id AND user_id = auth.uid()
    )
);

CREATE POLICY household_delete_admin ON households 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM household_members 
        WHERE household_id = households.id AND user_id = auth.uid() AND role = 'admin'
    )
);

-- Household Members: Members can view other members of their households
DROP POLICY IF EXISTS household_members_select ON household_members;
CREATE POLICY household_members_select ON household_members
FOR SELECT USING (
    -- User can see their own memberships
    user_id = auth.uid() 
    -- Or memberships of households they belong to
    OR household_id IN (
        SELECT household_id 
        FROM household_members 
        WHERE user_id = auth.uid()
    )
);

-- Household Members: Special policy for inserting via the trigger function
DROP POLICY IF EXISTS household_members_admin_insert ON household_members;
CREATE POLICY household_members_admin_insert ON household_members
FOR INSERT WITH CHECK (
    -- Allow insert operations through the trigger function (via the created_by field in households)
    EXISTS (
        SELECT 1 
        FROM households 
        WHERE id = household_members.household_id AND created_by = household_members.user_id
    )
    -- Or when users join households themselves
    OR user_id = auth.uid()
);

-- Remove the old policy that caused recursion
DROP POLICY IF EXISTS household_members_insert ON household_members;

-- Household Members: Users can update/delete their own membership
CREATE POLICY household_members_update_own ON household_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY household_members_delete_own ON household_members
FOR DELETE USING (user_id = auth.uid());

-- Expenses: Members can view expenses for their households
CREATE POLICY expenses_select_household ON expenses
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = expenses.household_id AND user_id = auth.uid()
    )
);

-- Expenses: Members can create expenses for their households
CREATE POLICY expenses_insert ON expenses
FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = expenses.household_id AND user_id = auth.uid()
    )
);

-- Expenses: Members can update/delete any expense in their household
CREATE POLICY expenses_update_household ON expenses
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = expenses.household_id AND user_id = auth.uid()
    )
);

CREATE POLICY expenses_delete_household ON expenses
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = expenses.household_id AND user_id = auth.uid()
    )
);

-- 8. Create a function to search for a household by join code
CREATE OR REPLACE FUNCTION find_household_by_join_code(search_code TEXT)
RETURNS TABLE (
    household_id UUID,
    household_name TEXT,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id as household_id,
        h.name as household_name,
        COUNT(hm.id) as member_count
    FROM households h
    LEFT JOIN household_members hm ON h.id = hm.household_id
    WHERE h.join_code = UPPER(search_code)
    GROUP BY h.id, h.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create a function to join a household with a join code
CREATE OR REPLACE FUNCTION join_household_with_code(
    join_code_param TEXT, 
    display_name_param TEXT
)
RETURNS UUID AS $$
DECLARE
    household_id_var UUID;
BEGIN
    -- Find the household ID by join code
    SELECT id INTO household_id_var 
    FROM households 
    WHERE join_code = UPPER(join_code_param);
    
    -- If household found, add the user
    IF household_id_var IS NOT NULL THEN
        INSERT INTO household_members (user_id, household_id, display_name)
        VALUES (auth.uid(), household_id_var, display_name_param)
        ON CONFLICT (user_id, household_id) DO NOTHING;
        
        RETURN household_id_var;
    ELSE
        RETURN NULL; -- No household found with that code
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Set up a trigger to update the updated_at timestamp for expenses
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 11. Add useful view for household summary
CREATE OR REPLACE VIEW household_summary AS
SELECT
    h.id as household_id,
    h.name as household_name,
    h.join_code,
    COUNT(DISTINCT hm.user_id) as member_count,
    COUNT(DISTINCT e.id) as expense_count,
    COALESCE(SUM(e.amount), 0) as total_expenses
FROM households h
LEFT JOIN household_members hm ON h.id = hm.household_id
LEFT JOIN expenses e ON h.id = e.household_id
GROUP BY h.id, h.name, h.join_code;

-- 12. Add function to get households for a user
CREATE OR REPLACE FUNCTION get_user_households(user_id_param UUID)
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT household_id
    FROM household_members
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a trigger to create profiles from auth.users when they sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', null, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix the infinite recursion in household_members policies
-- First, drop all existing household_members policies
DROP POLICY IF EXISTS household_members_select ON household_members;
DROP POLICY IF EXISTS household_members_admin_insert ON household_members;
DROP POLICY IF EXISTS household_members_insert ON household_members;
DROP POLICY IF EXISTS household_members_update_own ON household_members;
DROP POLICY IF EXISTS household_members_delete_own ON household_members;

-- Then create the updated policies
-- Policy for selecting household members
CREATE POLICY household_members_select ON household_members
FOR SELECT USING (
  -- User can see their own memberships
  user_id = auth.uid() 
  -- Or memberships of households they belong to
  OR EXISTS (
    SELECT 1 FROM household_members AS hm
    WHERE hm.household_id = household_members.household_id 
    AND hm.user_id = auth.uid()
    AND hm.id != household_members.id -- Prevent recursive check
  )
);

-- Policy for inserting household members
CREATE POLICY household_members_insert ON household_members
FOR INSERT WITH CHECK (
  -- User can add themselves to households
  user_id = auth.uid()
  -- Or the system can add them during household creation
  OR EXISTS (
    SELECT 1 FROM households
    WHERE id = household_members.household_id 
    AND created_by = household_members.user_id
  )
);

-- Additional policy for managing household members
CREATE POLICY household_members_update_own ON household_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY household_members_delete_own ON household_members
FOR DELETE USING (user_id = auth.uid());
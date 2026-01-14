-- Add all users to Beta Theta Pi Cal Poly chapter
-- First, let's find the chapter and users

-- Get chapter ID
SELECT id, name FROM chapters WHERE name ILIKE '%beta%' OR name ILIKE '%cal poly%';

-- Get user IDs
SELECT id, email FROM auth.users 
WHERE email IN (
  'colehackman@icloud.com',
  'mattabiz23@gmail.com', 
  'multilogin1@rushrank.me',
  'multilogin2@rushrank.me',
  'multilogin3@rushrank.me'
);

-- Insert memberships for all users (run after getting the IDs)
-- Replace CHAPTER_UUID with actual chapter ID from above
/*
INSERT INTO memberships (user_id, chapter_id, role)
SELECT u.id, 'CHAPTER_UUID', 'member'
FROM auth.users u
WHERE u.email IN (
  'colehackman@icloud.com',
  'mattabiz23@gmail.com', 
  'multilogin1@rushrank.me',
  'multilogin2@rushrank.me',
  'multilogin3@rushrank.me'
)
ON CONFLICT (user_id, chapter_id) DO NOTHING;
*/

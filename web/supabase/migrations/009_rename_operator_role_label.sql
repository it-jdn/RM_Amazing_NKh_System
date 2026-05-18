-- Rename legacy Thai label "พนักงานรับของ" → "พนักงานร้าน" in user profile fields.
-- Role code stays `operator`.

UPDATE app_users
SET
  display_name = REPLACE(display_name, 'พนักงานรับของ', 'พนักงานร้าน'),
  first_name = REPLACE(first_name, 'พนักงานรับของ', 'พนักงานร้าน'),
  last_name = REPLACE(last_name, 'พนักงานรับของ', 'พนักงานร้าน'),
  updated_at = NOW()
WHERE
  display_name LIKE '%พนักงานรับของ%'
  OR first_name LIKE '%พนักงานรับของ%'
  OR last_name LIKE '%พนักงานรับของ%';

-- Make structure_id optional to allow global "Lambda" client accounts (B2C)
ALTER TABLE users ALTER COLUMN structure_id DROP NOT NULL;

-- Remove the strict structure_id, email unique constraint and replace it with a broader rule
-- Warning: If an email is already used per-structure, having a global unique constraint might cause conflicts. 
-- For a SaaS, ideally emails are globally unique, or we maintain the existing constraint and just rely on structure_id being NULL for clients.
-- Actually, the existing constraint UNIQUE(structure_id, email) automatically treats NULLs as distinct rows in Postgres.
-- So multiple global clients could theoretically have the same email if structure_id is NULL.
-- To prevent this, we should enforce a global UNIQUE constraint on email.
-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_structure_id_email_key;

-- Add a new global unique constraint on email
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

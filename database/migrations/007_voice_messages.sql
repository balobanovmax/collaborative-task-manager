ALTER TABLE messages
ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'text'
CHECK (message_type IN ('text', 'voice'));

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS voice_url VARCHAR(500);

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS voice_duration_seconds INTEGER;

ALTER TABLE messages
ALTER COLUMN content DROP NOT NULL;

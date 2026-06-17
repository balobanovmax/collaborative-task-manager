ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'todo'
CHECK (status IN ('todo', 'doing', 'done'));

UPDATE tasks
SET status = CASE
    WHEN is_completed = true THEN 'done'
    ELSE 'todo'
END
WHERE status = 'todo' AND is_completed = true;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

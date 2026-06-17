CREATE TABLE IF NOT EXISTS task_comment_mentions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_comment_mentions_user ON task_comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_mentions_comment ON task_comment_mentions(comment_id);

CREATE TABLE message_mentions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX idx_message_mentions_user ON message_mentions(mentioned_user_id);
CREATE INDEX idx_message_mentions_message ON message_mentions(message_id);

CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_created_at ON task_comments(created_at);

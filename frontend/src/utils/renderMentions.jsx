const MENTION_PATTERN = /@([a-zA-Z0-9_]{1,50})/g;

export const renderMessageWithMentions = (
    content,
    mentions = [],
    currentUserId = null,
    mentionClass = '',
    selfMentionClass = ''
) => {
    if (!content) {
        return null;
    }

    const mentionUsernames = new Set(
        (mentions || []).map((mention) => mention.username.toLowerCase())
    );

    const parts = [];
    let lastIndex = 0;
    let match;
    const regex = new RegExp(MENTION_PATTERN.source, 'g');

    while ((match = regex.exec(content)) !== null) {
        const username = match[1];
        const start = match.index;
        const end = regex.lastIndex;

        if (start > lastIndex) {
            parts.push(content.slice(lastIndex, start));
        }

        const isKnownMention = mentionUsernames.has(username.toLowerCase());
        const isSelfMention = isKnownMention && mentions.some(
            (mention) =>
                mention.username.toLowerCase() === username.toLowerCase()
                && Number(mention.user_id) === Number(currentUserId)
        );

        if (isKnownMention) {
            parts.push(
                <span
                    key={`${start}-${username}`}
                    className={isSelfMention ? selfMentionClass : mentionClass}
                >
                    @{username}
                </span>
            );
        } else {
            parts.push(content.slice(start, end));
        }

        lastIndex = end;
    }

    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
};

export const getMentionQueryAtCursor = (value, cursorPosition) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    return match ? match[1] : null;
};

export const insertMention = (value, cursorPosition, username) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex === -1) {
        return { nextValue: value, nextCursor: cursorPosition };
    }

    const nextValue = `${value.slice(0, atIndex)}@${username} ${textAfterCursor}`;
    const nextCursor = atIndex + username.length + 2;

    return { nextValue, nextCursor };
};

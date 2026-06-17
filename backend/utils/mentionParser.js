export const MENTION_PATTERN = /@([a-zA-Z0-9_]{1,50})/g;

export const parseMentionsFromContent = (content, members) => {
    if (!content || !members?.length) {
        return [];
    }

    const mentions = [];
    const seenUserIds = new Set();
    const regex = new RegExp(MENTION_PATTERN.source, 'g');
    let match;

    while ((match = regex.exec(content)) !== null) {
        const username = match[1];
        const member = members.find(
            (entry) => entry.username.toLowerCase() === username.toLowerCase()
        );

        if (member && !seenUserIds.has(member.user_id)) {
            seenUserIds.add(member.user_id);
            mentions.push({
                user_id: member.user_id,
                username: member.username
            });
        }
    }

    return mentions;
};

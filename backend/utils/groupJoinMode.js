export const JOIN_MODES = ['public', 'password', 'approval'];

export const getJoinMode = (group) => {
    if (!group) {
        return 'public';
    }

    if (group.join_mode && JOIN_MODES.includes(group.join_mode)) {
        return group.join_mode;
    }

    if (group.is_public) {
        return 'public';
    }

    if (group.join_password_hash) {
        return 'password';
    }

    return 'approval';
};

export const formatGroupForResponse = (group) => {
    if (!group) {
        return null;
    }

    const { join_password_hash, ...rest } = group;

    return {
        ...rest,
        join_mode: getJoinMode(group),
        has_join_password: Boolean(join_password_hash)
    };
};

export const validateJoinMode = (joinMode) => {
    if (!JOIN_MODES.includes(joinMode)) {
        throw new Error(`Invalid join mode. Must be one of: ${JOIN_MODES.join(', ')}`);
    }

    return joinMode;
};

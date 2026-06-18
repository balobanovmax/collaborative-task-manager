export const isTaskOverdueByDate = (dueDate, status = 'todo') => {
    if (status === 'done' || !dueDate) {
        return false;
    }

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return due < today;
};

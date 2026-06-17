export const TASK_STATUSES = ['todo', 'doing', 'done'];

export const STATUS_LABELS = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done'
};

export const getTaskStatus = (task) => {
  if (task?.status && TASK_STATUSES.includes(task.status)) {
    return task.status;
  }

  return task?.is_completed ? 'done' : 'todo';
};

export const getNextStatus = (currentStatus) => {
  const current = TASK_STATUSES.includes(currentStatus) ? currentStatus : 'todo';
  const index = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(index + 1) % TASK_STATUSES.length];
};

export const getStatusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS.todo;

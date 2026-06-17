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

export const isTaskOverdue = (task) => {
  const status = getTaskStatus(task);
  if (status === 'done' || !task?.due_date) {
    return false;
  }

  const due = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
};

export const isTaskDueToday = (task) => {
  const status = getTaskStatus(task);
  if (status === 'done' || !task?.due_date) {
    return false;
  }

  const due = new Date(task.due_date);
  const today = new Date();
  return due.toDateString() === today.toDateString();
};

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

export const PRIORITY_WEIGHT = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

export const getTaskPriority = (task) => {
  if (task?.priority && TASK_PRIORITIES.includes(task.priority)) {
    return task.priority;
  }

  return 'medium';
};

export const getPriorityLabel = (priority) => PRIORITY_LABELS[priority] || PRIORITY_LABELS.medium;

export const getNextPriority = (currentPriority) => {
  const current = TASK_PRIORITIES.includes(currentPriority) ? currentPriority : 'medium';
  const index = TASK_PRIORITIES.indexOf(current);
  return TASK_PRIORITIES[(index + 1) % TASK_PRIORITIES.length];
};

export const compareTaskPriority = (taskA, taskB) => {
  const weightA = PRIORITY_WEIGHT[getTaskPriority(taskA)] ?? 2;
  const weightB = PRIORITY_WEIGHT[getTaskPriority(taskB)] ?? 2;
  return weightA - weightB;
};

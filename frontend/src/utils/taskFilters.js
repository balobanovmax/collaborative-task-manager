import { getTaskStatus, isTaskOverdue } from './taskStatus';
import { getTaskPriority } from './taskPriority';

export const DEFAULT_TASK_FILTERS = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  dueFrom: '',
  dueTo: '',
  overdueOnly: false
};

const matchesDueRange = (task, dueFrom, dueTo) => {
  if (!dueFrom && !dueTo) {
    return true;
  }

  if (!task.due_date) {
    return false;
  }

  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);

  if (dueFrom) {
    const from = new Date(dueFrom);
    from.setHours(0, 0, 0, 0);
    if (due < from) {
      return false;
    }
  }

  if (dueTo) {
    const to = new Date(dueTo);
    to.setHours(0, 0, 0, 0);
    if (due > to) {
      return false;
    }
  }

  return true;
};

export const applyTaskFilters = (tasks, filters, currentUserId) => {
  const search = filters.search?.trim().toLowerCase() || '';
  const status = filters.status || 'all';
  const priority = filters.priority || 'all';
  const assignee = filters.assignee || 'all';
  const dueFrom = filters.dueFrom || '';
  const dueTo = filters.dueTo || '';
  const overdueOnly = Boolean(filters.overdueOnly);

  return tasks.filter((task) => {
    if (search) {
      const title = (task.title || '').toLowerCase();
      const description = (task.description || '').toLowerCase();
      if (!title.includes(search) && !description.includes(search)) {
        return false;
      }
    }

    if (status !== 'all' && getTaskStatus(task) !== status) {
      return false;
    }

    if (priority !== 'all' && getTaskPriority(task) !== priority) {
      return false;
    }

    if (assignee === 'unassigned' && task.assigned_to) {
      return false;
    }

    if (assignee === 'me' && Number(task.assigned_to) !== Number(currentUserId)) {
      return false;
    }

    if (assignee !== 'all' && assignee !== 'unassigned' && assignee !== 'me') {
      if (Number(task.assigned_to) !== Number(assignee)) {
        return false;
      }
    }

    if (overdueOnly && !isTaskOverdue(task)) {
      return false;
    }

    if (!matchesDueRange(task, dueFrom, dueTo)) {
      return false;
    }

    return true;
  });
};

export const buildTaskFilterParams = (filters, { includeDone } = {}) => {
  const params = new URLSearchParams();

  if (includeDone !== undefined) {
    params.set('includeDone', String(includeDone));
  }

  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }

  if (filters.priority && filters.priority !== 'all') {
    params.set('priority', filters.priority);
  }

  if (filters.dueFrom) {
    params.set('dueFrom', filters.dueFrom);
  }

  if (filters.dueTo) {
    params.set('dueTo', filters.dueTo);
  }

  if (filters.overdueOnly) {
    params.set('overdueOnly', 'true');
  }

  return params;
};

import styles from './TaskFiltersBar.module.css';
import { TASK_STATUSES, getStatusLabel } from '../../utils/taskStatus';
import { TASK_PRIORITIES, getPriorityLabel } from '../../utils/taskPriority';

function TaskFiltersBar({
  filters,
  onChange,
  members = [],
  showAssignee = true,
  currentUserId
}) {
  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onChange({
      search: '',
      status: 'all',
      priority: 'all',
      assignee: 'all',
      dueFrom: '',
      dueTo: '',
      overdueOnly: false
    });
  };

  const hasActiveFilters =
    filters.search
    || filters.status !== 'all'
    || filters.priority !== 'all'
    || (showAssignee && filters.assignee !== 'all')
    || filters.dueFrom
    || filters.dueTo
    || filters.overdueOnly;

  return (
    <div className={styles.bar}>
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search title or description..."
        value={filters.search}
        onChange={(event) => updateFilter('search', event.target.value)}
        aria-label="Search tasks"
      />

      <select
        className={styles.select}
        value={filters.status}
        onChange={(event) => updateFilter('status', event.target.value)}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>{getStatusLabel(status)}</option>
        ))}
      </select>

      <select
        className={styles.select}
        value={filters.priority}
        onChange={(event) => updateFilter('priority', event.target.value)}
        aria-label="Filter by priority"
      >
        <option value="all">All priorities</option>
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>{getPriorityLabel(priority)}</option>
        ))}
      </select>

      {showAssignee && (
        <select
          className={styles.select}
          value={filters.assignee}
          onChange={(event) => updateFilter('assignee', event.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          <option value="me">Assigned to me</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.username}
            </option>
          ))}
        </select>
      )}

      <input
        type="date"
        className={styles.dateInput}
        value={filters.dueFrom}
        onChange={(event) => updateFilter('dueFrom', event.target.value)}
        aria-label="Due from"
        title="Due from"
      />

      <input
        type="date"
        className={styles.dateInput}
        value={filters.dueTo}
        onChange={(event) => updateFilter('dueTo', event.target.value)}
        aria-label="Due to"
        title="Due to"
      />

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(event) => updateFilter('overdueOnly', event.target.checked)}
        />
        Overdue
      </label>

      {hasActiveFilters && (
        <button type="button" className={styles.clearButton} onClick={handleClear}>
          Clear
        </button>
      )}
    </div>
  );
}

export default TaskFiltersBar;

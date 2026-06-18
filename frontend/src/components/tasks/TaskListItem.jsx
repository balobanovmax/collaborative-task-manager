import styles from './TaskListItem.module.css';
import TaskStatusControl from './TaskStatusControl';
import TaskCommentThread from './TaskCommentThread';
import TaskChecklist from './TaskChecklist';
import TaskActivityLog from './TaskActivityLog';
import TaskAttachments from './TaskAttachments';
import TaskDrawings from './TaskDrawings';
import TaskPriorityBadge from './TaskPriorityBadge';
import TaskInlineActions from './TaskInlineActions';
import UserAvatar from '../common/UserAvatar';
import { getTaskStatus } from '../../utils/taskStatus';

function TaskListItem({
  task,
  groupId,
  groupOwnerId,
  members = [],
  assignee,
  isExpanded,
  onExpand,
  onCollapse,
  onStatusChange,
  onPriorityChange,
  isUpdatingStatus,
  onCommentAdded,
  onAttachmentAdded,
  onDrawingAdded,
  onSubtaskUpdated,
  onEdit,
  onDelete
}) {
  const status = getTaskStatus(task);
  const commentCount = task.comment_count || 0;
  const attachmentCount = task.attachment_count || 0;
  const drawingCount = task.drawing_count || 0;
  const subtaskCount = task.subtask_count || 0;
  const subtaskCompletedCount = task.subtask_completed_count || 0;
  const hasCounts = commentCount + attachmentCount + drawingCount + subtaskCount > 0;

  const handleSummaryClick = () => {
    if (!isExpanded) {
      onExpand(task.id);
    }
  };

  const handleSummaryKeyDown = (event) => {
    if (isExpanded) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onExpand(task.id);
    }
  };

  return (
    <article className={`${styles.item} ${isExpanded ? styles.itemExpanded : ''}`}>
      <div
        className={styles.summary}
        onClick={handleSummaryClick}
        onKeyDown={handleSummaryKeyDown}
        role={isExpanded ? undefined : 'button'}
        tabIndex={isExpanded ? -1 : 0}
        aria-expanded={isExpanded}
      >
        <div className={styles.summaryMain}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{task.title}</h3>
            <TaskPriorityBadge
              task={task}
              compact
              onPriorityChange={onPriorityChange}
              disabled={isUpdatingStatus}
            />
          </div>
          {!isExpanded && task.description && (
            <p className={styles.summaryDescription}>{task.description}</p>
          )}
        </div>

        <div className={styles.summaryMeta}>
          {!isExpanded && assignee && (
            <span className={styles.summaryAssignee}>{assignee.username}</span>
          )}
          {!isExpanded && !assignee && (
            <span className={styles.summaryUnassigned}>Unassigned</span>
          )}
          {!isExpanded && task.due_date && (
            <span className={styles.summaryDue}>
              Due {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
          {!isExpanded && hasCounts && (
            <span className={styles.summaryCounts}>
              {subtaskCount > 0 && `${subtaskCompletedCount}/${subtaskCount} steps`}
              {subtaskCount > 0 && (commentCount > 0 || attachmentCount > 0 || drawingCount > 0) && ' · '}
              {commentCount > 0 && `${commentCount} comment${commentCount === 1 ? '' : 's'}`}
              {commentCount > 0 && (attachmentCount > 0 || drawingCount > 0) && ' · '}
              {attachmentCount > 0 && `${attachmentCount} file${attachmentCount === 1 ? '' : 's'}`}
              {attachmentCount > 0 && drawingCount > 0 && ' · '}
              {drawingCount > 0 && `${drawingCount} drawing${drawingCount === 1 ? '' : 's'}`}
            </span>
          )}
        </div>

        <div className={styles.summaryActions} onClick={(event) => event.stopPropagation()}>
          {(onEdit || onDelete) && (
            <TaskInlineActions
              onEdit={() => onEdit?.(task)}
              onDelete={() => onDelete?.(task)}
              disabled={isUpdatingStatus}
            />
          )}
          <TaskStatusControl
            task={task}
            onStatusChange={onStatusChange}
            disabled={isUpdatingStatus}
            compact
          />
          {!isExpanded && (
            <span className={styles.expandHint} aria-hidden="true">▾</span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.details}>
          <div className={styles.detailsHeader}>
            <span className={styles.detailsLabel}>Task details</span>
            <button
              type="button"
              className={styles.minimizeButton}
              onClick={onCollapse}
            >
              Minimize
            </button>
          </div>

          {task.description && (
            <p className={styles.description}>{task.description}</p>
          )}

          <div className={styles.assigneeRow}>
            {assignee ? (
              <>
                <UserAvatar
                  username={assignee.username}
                  profilePictureUrl={assignee.profile_picture_url}
                  size="sm"
                />
                <span className={styles.assigneeLabel}>
                  Assigned to <strong>{assignee.username}</strong>
                </span>
              </>
            ) : (
              <span className={styles.unassignedLabel}>Unassigned</span>
            )}
          </div>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              Created by: {task.creator_username || task.creator?.username || 'Unknown'}
            </span>
            {task.due_date && (
              <span className={styles.metaItem}>
                Due: {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {status === 'done' && (task.completer_username || task.completer?.username) && (
            <div className={styles.completedInfo}>
              Done by {task.completer_username || task.completer?.username}
            </div>
          )}

          <TaskChecklist
            taskId={task.id}
            initialCount={subtaskCount}
            initialCompletedCount={subtaskCompletedCount}
            onSubtaskUpdated={onSubtaskUpdated}
          />

          <TaskCommentThread
            taskId={task.id}
            groupId={groupId}
            members={members}
            initialCount={commentCount}
            onCommentAdded={onCommentAdded}
          />

          <TaskAttachments
            taskId={task.id}
            initialCount={attachmentCount}
            taskCreatedBy={task.created_by}
            groupOwnerId={groupOwnerId}
            onAttachmentAdded={onAttachmentAdded}
          />

          <TaskDrawings
            taskId={task.id}
            initialCount={drawingCount}
            taskCreatedBy={task.created_by}
            groupOwnerId={groupOwnerId}
            onDrawingAdded={onDrawingAdded}
          />

          <TaskActivityLog taskId={task.id} />
        </div>
      )}
    </article>
  );
}

export default TaskListItem;

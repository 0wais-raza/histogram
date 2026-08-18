/**
 * LoadingSkeleton — reusable shimmer placeholders
 */

export function PostSkeleton() {
  return (
    <div className="skeleton-post">
      <div className="skeleton-header">
        <div className="skeleton-avatar" />
        <div className="skeleton-lines">
          <div className="skeleton-line short" />
          <div className="skeleton-line tiny" />
        </div>
      </div>
      <div className="skeleton-image" />
      <div className="skeleton-actions">
        <div className="skeleton-icon" />
        <div className="skeleton-icon" />
      </div>
      <div className="skeleton-lines">
        <div className="skeleton-line" />
        <div className="skeleton-line medium" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="skeleton-profile">
      <div className="skeleton-avatar-large" />
      <div className="skeleton-lines center">
        <div className="skeleton-line short" />
        <div className="skeleton-line medium" />
      </div>
      <div className="skeleton-stats">
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="skeleton-feed">
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}

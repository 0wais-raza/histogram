/**
 * LoadingSkeleton — reusable shimmer placeholders
 * Each page gets its own skeleton shape for a polished feel
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

/** Explore / Users list skeleton — shows user rows */
export function UserListSkeleton() {
  return (
    <div className="skeleton-feed">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-user-row">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line medium" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Discover grid skeleton — 3x3 grid of blurred squares */
export function DiscoverSkeleton() {
  return (
    <div className="skeleton-discover-grid">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={i} className="skeleton-discover-item" />
      ))}
    </div>
  );
}

/** Music page skeleton — list of track rows */
export function MusicSkeleton() {
  return (
    <div className="skeleton-music-list">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="skeleton-music-row">
          <div className="skeleton-music-play" />
          <div className="skeleton-lines">
            <div className="skeleton-line medium" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Notifications skeleton — list of notif rows */
export function NotifSkeleton() {
  return (
    <div className="skeleton-notif-list">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-notif-row">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line" />
            <div className="skeleton-line tiny" />
          </div>
          <div className="skeleton-icon" />
        </div>
      ))}
    </div>
  );
}

/** Messages list skeleton */
export function MessagesSkeleton() {
  return (
    <div className="skeleton-msg-list">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-msg-row">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line medium" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

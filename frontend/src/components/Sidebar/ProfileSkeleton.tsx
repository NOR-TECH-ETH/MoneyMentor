import React from 'react';

interface ProfileSkeletonProps {
  theme?: 'light' | 'dark';
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({ theme = 'light' }) => {
  const shimmerClass = theme === 'dark' ? 'shimmer-dark' : 'shimmer-light';
  
  return (
    <div className={`profile-skeleton ${theme}`} data-testid="profile-skeleton">
      {/* Profile Header Skeleton */}
      <div className="profile-header-skeleton">
        <div className={`avatar-skeleton ${shimmerClass}`}></div>
        <div className="profile-details-skeleton">
          <div className={`name-skeleton ${shimmerClass}`}></div>
          <div className={`email-skeleton ${shimmerClass}`}></div>
          <div className={`date-skeleton ${shimmerClass}`}></div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="stats-grid-skeleton">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-item-skeleton">
            <div className={`stat-value-skeleton ${shimmerClass}`}></div>
            <div className={`stat-label-skeleton ${shimmerClass}`}></div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .profile-skeleton {
          padding: 20px;
        }

        .profile-header-skeleton {
          display: flex;
          align-items: center;
          margin-bottom: 30px;
          gap: 20px;
        }

        .avatar-skeleton {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          animation: shimmer 2s infinite linear;
        }

        .profile-details-skeleton {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .name-skeleton {
          height: 24px;
          width: 60%;
          border-radius: 4px;
          animation: shimmer 2s infinite linear;
        }

        .email-skeleton {
          height: 16px;
          width: 80%;
          border-radius: 4px;
          animation: shimmer 2s infinite linear;
        }

        .date-skeleton {
          height: 14px;
          width: 40%;
          border-radius: 4px;
          animation: shimmer 2s infinite linear;
        }

        .stats-grid-skeleton {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .stat-item-skeleton {
          text-align: center;
          padding: 15px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
        }

        .stat-value-skeleton {
          height: 32px;
          width: 60%;
          margin: 0 auto 8px;
          border-radius: 4px;
          animation: shimmer 2s infinite linear;
        }

        .stat-label-skeleton {
          height: 14px;
          width: 80%;
          margin: 0 auto;
          border-radius: 4px;
          animation: shimmer 2s infinite linear;
        }

        .shimmer-light {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
        }

        .shimmer-dark {
          background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
          background-size: 200% 100%;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}; 
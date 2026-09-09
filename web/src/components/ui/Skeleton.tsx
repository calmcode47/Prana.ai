import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const baseStyles = 'animate-pulse bg-surface-vanilla-strong/70 border border-outline-variant/40';

  const variantStyles = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'h-32 w-full rounded-xl',
  };

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={computedStyle}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="p-space-md rounded-xl border border-ink-black bg-surface-vanilla shadow-[3px_3px_0px_#18181B] space-y-3">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="100%" height={16} />
      <div className="space-y-2 pt-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${85 - i * 15}%`} height={14} />
        ))}
      </div>
    </div>
  );
};

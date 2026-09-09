import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe' | 'emergency' | 'warning' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] font-bold shadow-[1px_1px_0px_#18181B]',
    md: 'px-2.5 py-1 text-xs font-bold shadow-[1.5px_1.5px_0px_#18181B]',
  };

  const variantStyles = {
    good: 'bg-[#00C781] text-ink-black border border-ink-black',
    satisfactory: 'bg-[#92D050] text-ink-black border border-ink-black',
    moderate: 'bg-[#FFFF00] text-ink-black border border-ink-black',
    poor: 'bg-[#FF7800] text-white border border-ink-black',
    very_poor: 'bg-[#FF0000] text-white border border-ink-black',
    severe: 'bg-[#8F3F97] text-white border border-ink-black',
    emergency: 'bg-coral-watermelon-vivid text-white border border-ink-black animate-pulse',
    warning: 'bg-terracotta-deep text-white border border-ink-black',
    neutral: 'bg-surface-vanilla text-ink-black border border-ink-black',
  };

  return (
    <span
      className={`inline-flex items-center uppercase tracking-wider rounded-md font-label-md ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'vanilla' | 'cream' | 'accent';
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'vanilla',
  elevation = 'md',
  header,
  footer,
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-surface text-ink-black border border-ink-black',
    vanilla: 'bg-surface-vanilla text-ink-black border border-ink-black',
    cream: 'bg-canvas-cream text-ink-black border border-ink-black',
    accent: 'bg-surface-vanilla-strong text-ink-black border border-ink-black',
  };

  const elevationStyles = {
    none: 'shadow-none',
    sm: 'shadow-[2px_2px_0px_#18181B]',
    md: 'shadow-[3px_3px_0px_#18181B]',
    lg: 'shadow-[5px_5px_0px_#18181B]',
  };

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-150 ${variantStyles[variant]} ${elevationStyles[elevation]} ${className}`}
      {...props}
    >
      {header && (
        <div className="px-space-md py-space-sm border-b border-outline-variant/60 bg-surface-vanilla-strong/40">
          {header}
        </div>
      )}
      <div className="p-space-md">{children}</div>
      {footer && (
        <div className="px-space-md py-space-sm border-t border-outline-variant/60 bg-surface-vanilla-strong/30">
          {footer}
        </div>
      )}
    </div>
  );
};

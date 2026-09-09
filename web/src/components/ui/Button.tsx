import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-label-md rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px]';

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 shadow-[1px_1px_0px_#18181B]',
    md: 'px-4 py-2 text-sm gap-2 shadow-[2px_2px_0px_#18181B]',
    lg: 'px-6 py-3 text-base gap-2.5 shadow-[3px_3px_0px_#18181B]',
  };

  const variantStyles = {
    primary:
      'bg-primary text-on-primary hover:bg-primary/95 focus:ring-primary border border-ink-black',
    secondary:
      'bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed/90 focus:ring-secondary border border-ink-black',
    outline:
      'bg-surface-vanilla text-ink-black border border-ink-black hover:bg-surface-vanilla-strong focus:ring-ink-black',
    danger:
      'bg-error text-on-error hover:bg-error/90 focus:ring-error border border-ink-black',
    ghost:
      'bg-transparent text-ink-black hover:bg-ink-black/5 shadow-none active:translate-x-0 active:translate-y-0',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

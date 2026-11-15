import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const baseClasses =
    'min-h-[48px] px-6 py-3 rounded-xl font-bold text-lg transition-colors focus:outline-none focus:ring-4 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-blue-900 text-white hover:bg-blue-800 focus:ring-blue-600',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-slate-400',
    outline: 'border-2 border-blue-900 bg-white text-blue-950 hover:bg-blue-50 focus:ring-blue-600',
  }[variant];

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

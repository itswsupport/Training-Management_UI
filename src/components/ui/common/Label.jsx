import { memo } from 'react';
import { createMemoizedComponent } from '@/lib/optimizeComponent';

const labelVariants = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  default: '',
};

const labelSizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
  lg: 'px-3 py-1 text-base',
};

const Label = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <span
      className={`
        text-[12px] font-bold text-[#3482AE] uppercase
        ${labelVariants[variant]}
        ${labelSizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

export default createMemoizedComponent(Label);

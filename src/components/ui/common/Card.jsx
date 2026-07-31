import { memo } from 'react';
import { createMemoizedComponent } from '@/lib/optimizeComponent';

const cardVariants = {
  default: 'bg-white border border-gray-200',
  elevated: 'bg-white shadow-lg',
  outlined: 'border-2 border-gray-200',
};

const Card = ({
  children,
  variant = 'default',
  className = '',
  title,
  subtitle,
  footer,
  ...props
}) => {
  const baseClasses = 'rounded-lg overflow-hidden';

  return (
    <div
      className={`${baseClasses} ${cardVariants[variant]} ${className}`}
      {...props}
    >
      {(title || subtitle) && (
        <div className="p-4 border-b border-gray-200">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="p-4 border-t border-gray-200">{footer}</div>}
    </div>
  );
};

export default createMemoizedComponent(Card);

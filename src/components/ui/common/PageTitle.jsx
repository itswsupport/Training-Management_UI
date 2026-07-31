import { memo } from 'react';
import { createMemoizedComponent } from '@/lib/optimizeComponent';

const PageTitle = ({
  title,
  subtitle,
  actions,
  className = '',
  ...props
}) => {
  return (
    <div className={`mb-6 ${className}`} {...props}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[16px] font-semibold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default createMemoizedComponent(PageTitle);

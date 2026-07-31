import { memo } from 'react';
import { createMemoizedComponent } from '@/lib/optimizeComponent';

export const FormGroup = memo(({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
));

export const Label = memo(({ children, required, className = '', ...props }) => (
  <label
    className={`block text-[12px] font-medium text-gray-700 mb-1 ${className}`}
    {...props}
  >
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
));

export const Input = memo(({ error, className = '', ...props }) => (
  <input
    className={`
      w-full px-3 py-2 border rounded-md text-[12px]
      focus:outline-none focus:ring-2 focus:ring-blue-400
      ${error ? 'border-red-500' : 'border-gray-300'}
      ${className}
    `}
    {...props}
  />
));

export const TextArea = memo(({ error, className = '', ...props }) => (
  <textarea
    className={`
      w-full px-3 py-2 border rounded-md text-[12px]
      focus:outline-none focus:ring-2 focus:ring-blue-400
      ${error ? 'border-red-500' : 'border-gray-300'}
      ${className}
    `}
    {...props}
  />
));

export const Select = memo(({ children, error, className = '', ...props }) => (
  <select
    className={`
      w-full px-3 py-2 border rounded-md text-[12px]
      focus:outline-none focus:ring-2 focus:ring-blue-400
      ${error ? 'border-red-500' : 'border-gray-300'}
      ${className}
    `}
    {...props}
  >
    {children}
  </select>
));

export const ErrorMessage = memo(({ children, className = '', ...props }) => (
  <p className={`mt-1 text-[12px] text-red-500 ${className}`} {...props}>
    {children}
  </p>
));

// Form wrapper with common functionality
export const Form = createMemoizedComponent(({ 
  children, 
  onSubmit, 
  className = '',
  ...props 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <form onSubmit={handleSubmit} className={className} {...props}>
      {children}
    </form>
  );
});

// Date utility functions for consistent formatting across the application
import React from 'react';

// Calendar icon SVG component
export const CalendarIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

/**
 * Formats a date to dd/mm/yyyy format
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date as dd/mm/yyyy
 */
export const formatDateToDDMMYYYY = (date) => {
  if (!date) return "";

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Formats a date to dd-mm-yyyy format (for API calls)
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date as dd-mm-yyyy
 */
export const formatDateToDDMMYYYYDash = (date) => {
  if (!date) return "";

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Formats a date to yyyy-mm-dd format (for HTML5 date inputs)
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date as yyyy-mm-dd
 */
export const formatDateToYYYYMMDD = (date) => {
  if (!date) return "";

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "";

  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Converts dd/mm/yyyy or dd-mm-yyyy format to yyyy-mm-dd for HTML5 date inputs
 * @param {string} dateString - Date in dd/mm/yyyy or dd-mm-yyyy format
 * @returns {string} - Date in yyyy-mm-dd format
 */
export const convertDDMMYYYYToYYYYMMDD = (dateString) => {
  if (!dateString) return "";

  const parts = dateString.split(/[\/\-]/);
  if (parts.length !== 3) return "";

  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * Gets current date in yyyy-mm-dd format for HTML5 date inputs
 * @returns {string} - Current date in yyyy-mm-dd format
 */
export const getCurrentDateYYYYMMDD = () => {
  return formatDateToYYYYMMDD(new Date());
};

/**
 * Gets current date in dd/mm/yyyy format
 * @returns {string} - Current date in dd/mm/yyyy format
 */
export const getCurrentDateDDMMYYYY = () => {
  return formatDateToDDMMYYYY(new Date());
};

/**
 * Custom date input component that displays dd/mm/yyyy format
 * @param {Object} props - Component props
 * @returns {JSX.Element} - Custom date input
 */
export const DateDisplayDDMMYYYY = ({ value, onChange, className, disabled, required, min, max, ...props }) => {
  const displayValue = value ? formatDateToDDMMYYYY(value) : "";
  const dateInputRef = React.useRef(null);

  // Handle wrapper click to open date picker
  const handleWrapperClick = (e) => {
    if (disabled) return;

    e.preventDefault();

    if (dateInputRef.current) {
      // Multiple approaches to ensure calendar opens
      dateInputRef.current.focus();

      setTimeout(() => {
        if (dateInputRef.current) {
          // Try showPicker first (modern browsers)
          if (typeof dateInputRef.current.showPicker === 'function') {
            try {
              dateInputRef.current.showPicker();
            } catch (err) {
              // If showPicker fails, try click
              dateInputRef.current.click();
            }
          } else {
            // For older browsers, dispatch a click event
            dateInputRef.current.click();
          }
        }
      }, 50);
    }
  };

  return (
    <div
      className="relative cursor-pointer"
      onClick={handleWrapperClick}
    >
      {/* Hidden actual date input - positioned to cover entire area */}
      <input
        ref={dateInputRef}
        type="date"
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        {...props}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={-1}
      />

      {/* Visible formatted display with calendar icon */}
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          placeholder="dd/mm/yyyy"
          readOnly
          disabled={disabled}
          required={required}
          className={`w-full pl-3 pr-10 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#3482AE] cursor-pointer ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          } ${className || ''}`}
          onFocus={(e) => {
            // When display input gets focus, transfer it to date input
            e.target.blur();
            if (dateInputRef.current) {
              dateInputRef.current.focus();
            }
          }}
        />

        {/* Calendar icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <CalendarIcon className={`w-5 h-5 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
      </div>
    </div>
  );
};
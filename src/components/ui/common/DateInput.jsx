"use client";
import React, { useState, useRef } from 'react';
import moment from 'moment';

const DateInput = ({ value, onChange, className = "", placeholder = "DD/MM/YYYY", ...props }) => {
  const [displayValue, setDisplayValue] = useState(value || "");
  const hiddenDateInputRef = useRef(null);

  // Helper function to validate DD/MM/YYYY format
  const isValidDateFormat = (dateStr) => {
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    if (!regex.test(dateStr)) return false;

    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    const date = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    return date.isValid() && date.year() === year && date.month() + 1 === month && date.date() === day;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for date input
  const convertToDateInputFormat = (ddmmyyyy) => {
    if (!ddmmyyyy || !isValidDateFormat(ddmmyyyy)) return "";
    const parts = ddmmyyyy.split('/');
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY
  const convertFromDateInputFormat = (yyyymmdd) => {
    if (!yyyymmdd) return "";
    return moment(yyyymmdd).format("DD/MM/YYYY");
  };

  // Handle text input changes (manual typing)
  const handleTextInputChange = (e) => {
    let inputValue = e.target.value;

    // Auto-format while typing (add slashes)
    if (inputValue.length === 2 && !inputValue.includes('/')) {
      inputValue = inputValue + '/';
    } else if (inputValue.length === 5 && inputValue.split('/').length === 2) {
      inputValue = inputValue + '/';
    }

    // Remove invalid characters (only allow digits and slashes)
    inputValue = inputValue.replace(/[^\d/]/g, '');

    // Limit to DD/MM/YYYY format length
    if (inputValue.length > 10) {
      inputValue = inputValue.substring(0, 10);
    }

    setDisplayValue(inputValue);

    // Only call onChange if it's a valid date or empty
    if (inputValue === "" || isValidDateFormat(inputValue)) {
      onChange(inputValue);
    }
  };

  // Handle date picker changes
  const handleDatePickerChange = (e) => {
    const dateValue = e.target.value;
    const formattedDate = convertFromDateInputFormat(dateValue);
    setDisplayValue(formattedDate);
    onChange(formattedDate);
  };

  // Handle calendar icon click
  const openDatePicker = () => {
    if (hiddenDateInputRef.current) {
      // Set the hidden input value before opening
      hiddenDateInputRef.current.value = convertToDateInputFormat(displayValue);

      // Try using showPicker() if available (Chrome 99+)
      if (hiddenDateInputRef.current.showPicker) {
        try {
          hiddenDateInputRef.current.showPicker();
        } catch (error) {
          // Fallback: focus and click
          hiddenDateInputRef.current.focus();
          hiddenDateInputRef.current.click();
        }
      } else {
        // Fallback for older browsers
        hiddenDateInputRef.current.focus();
        hiddenDateInputRef.current.click();
      }
    }
  };

  // Update display value when prop value changes
  React.useEffect(() => {
    setDisplayValue(value || "");
  }, [value]);

  return (
    <div className="relative w-full">
      {/* Main text input for DD/MM/YYYY */}
      <input
        type="text"
        value={displayValue || ''}
        onChange={handleTextInputChange}
        placeholder={placeholder}
        className={`${className} pr-8 w-full min-w-0`}
        maxLength={10}
        title="Date format: DD/MM/YYYY"
        {...props}
      />

      {/* Calendar icon */}
      <button
        type="button"
        onClick={openDatePicker}
        className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 touch-manipulation"
        tabIndex={-1}
        aria-label="Open calendar picker"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 sm:h-4 sm:w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Hidden date input for picker */}
      <input
        ref={hiddenDateInputRef}
        type="date"
        value={convertToDateInputFormat(displayValue) || ''}
        onChange={handleDatePickerChange}
        className="absolute opacity-0 pointer-events-none w-full h-full top-0 left-0"
        tabIndex={-1}
      />
    </div>
  );
};

export default DateInput;
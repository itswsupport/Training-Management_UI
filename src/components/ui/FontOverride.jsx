"use client";
import { useEffect } from 'react';

const FontOverride = () => {
  useEffect(() => {
    // Runtime font override for Material-UI components
    const overrideFonts = () => {
      // Comprehensive list of Material-UI selectors for MaterialReactTable
      const selectors = [
        // Form components
        '[class*="MuiFormLabel-root"]',
        '[class*="MuiInputLabel-root"]',
        '[class*="MuiFormControlLabel"]',
        '[class*="MuiFormControl"]',

        // Typography
        '[class*="MuiTypography-root"]',

        // Table components
        '[class*="MuiTablePagination"]',
        '[class*="MuiTableCell"]',
        '[class*="MuiTable"]',
        '[class*="MuiTableHead"]',
        '[class*="MuiTableBody"]',
        '[class*="MuiTableRow"]',

        // Input components
        '[class*="MuiInputBase"]',
        '[class*="MuiInput-"]',
        '[class*="MuiOutlinedInput"]',
        '[class*="MuiFilledInput"]',
        '[class*="MuiSelect"]',
        '[class*="MuiMenuItem"]',

        // Button components
        '[class*="MuiButton"]',
        '[class*="MuiIconButton"]',

        // Toolbar and navigation
        '[class*="MuiToolbar"]',
        '[class*="MuiAppBar"]',

        // Other interactive components
        '[class*="MuiChip"]',
        '[class*="MuiTooltip"]',
        '[class*="MuiCheckbox"]',
        '[class*="MuiRadio"]',
        '[class*="MuiSwitch"]',
        '[class*="MuiAutocomplete"]',

        // CSS-in-JS specific selectors
        '[class*="css-"][class*="MuiFormLabel-root"]',
        '[class*="css-"][class*="MuiInputLabel-root"]',
        '[class*="css-"][class*="MuiTypography-root"]',
        '[class*="css-"][class*="MuiTablePagination"]',
        '[class*="css-"][class*="MuiTableCell"]',
        '[class*="css-"][class*="MuiButton"]',
        '[class*="css-"][class*="MuiFormControl"]',
        '[class*="css-"][class*="MuiSelect"]',
        '[class*="css-"][class*="MuiMenuItem"]',

        // MaterialReactTable specific selectors
        '[class*="MRT"]',
        '.MuiDataGrid-root',
        '.MuiDataGrid-cell',
        '.MuiDataGrid-columnHeader',
        '.MuiDataGrid-footerContainer'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.style.fontFamily = 'var(--font-exo), sans-serif';
        });
      });
    };

    // Run immediately
    overrideFonts();

    // Run after a short delay to catch dynamically rendered components
    const timeout1 = setTimeout(overrideFonts, 100);
    const timeout2 = setTimeout(overrideFonts, 500);
    const timeout3 = setTimeout(overrideFonts, 1000);

    // Use MutationObserver to catch new elements being added
    const observer = new MutationObserver((mutations) => {
      let shouldOverride = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const className = node.className || '';
            if (typeof className === 'string' && (
              className.includes('Mui') ||
              className.includes('MRT') ||
              className.includes('MuiFormLabel-root') ||
              className.includes('MuiInputLabel-root') ||
              className.includes('MuiTypography-root') ||
              className.includes('MuiTablePagination') ||
              className.includes('MuiTableCell') ||
              className.includes('MuiButton') ||
              className.includes('MuiSelect') ||
              className.includes('MuiMenuItem') ||
              className.includes('MuiFormControl')
            )) {
              shouldOverride = true;
            }
          }
        });
      });
      if (shouldOverride) {
        setTimeout(overrideFonts, 10);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      observer.disconnect();
    };
  }, []);

  return null; // This component doesn't render anything
};

export default FontOverride;
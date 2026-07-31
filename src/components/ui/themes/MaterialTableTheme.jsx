"use client";

import { createTheme } from '@mui/material/styles';

// Comprehensive Exo font theme for MaterialReactTable
export const exoTheme = createTheme({
  typography: {
    fontFamily: ['Exo'].join(','),
    fontSize: 12,
  },
  components: {
    // Table Cell Components
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
          padding: '8px 16px',
        },
        head: {
          fontFamily: 'Exo',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#f5f5f5',
        },
        body: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Table Container
    MuiTable: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
      },
    },


    // Table Pagination
    MuiTablePagination: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        toolbar: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        caption: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        select: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        actions: {
          fontFamily: 'Exo'
        },
        selectLabel: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        displayedRows: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Form Controls and Inputs
    MuiSelect: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        select: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    MuiFormControl: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo'
        },
      },
    },

    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        input: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Typography
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
        body1: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        body2: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        caption: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Buttons
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
          textTransform: 'none',
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
      },
    },

    // Toolbar and Action components
    MuiToolbar: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
      },
    },

    // Checkbox and other form elements
    MuiCheckbox: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
      },
    },

    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Tooltip
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Chip
    MuiChip: {
      styleOverrides: {
        label: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },

    // Progress indicators
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
        },
      },
    },

    // Autocomplete
    MuiAutocomplete: {
      styleOverrides: {
        input: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
        option: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },
  },

  // Custom CSS variables for additional styling
  palette: {
    primary: {
      main: '#3482AE',
    },
    secondary: {
      main: '#5DADE2',
    },
  },
});

// Alternative compact theme for smaller screens
export const compactExoTheme = createTheme({
  ...exoTheme,
  components: {
    ...exoTheme.components,
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily: 'Exo',
          fontSize: '12px',
          padding: '6px 12px',
        },
        head: {
          fontFamily: 'Exo',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#f5f5f5',
        },
        body: {
          fontFamily: 'Exo',
          fontSize: '12px',
        },
      },
    },
  },
});

export default exoTheme;
"use client";

import React from 'react';
import {
  MaterialReactTable,
  MRT_ShowHideColumnsButton,
  MRT_ToggleDensePaddingButton,
  MRT_ToggleFiltersButton,
  MRT_ToggleFullScreenButton,
  MRT_ToggleGlobalFilterButton,
} from "material-react-table";
import { IconButton, InputAdornment, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ThemeProvider } from '@mui/material/styles';
import { exoTheme, compactExoTheme } from '../themes/MaterialTableTheme';
import FontOverride from '../FontOverride';

/**
 * ExoMaterialTable - A wrapper component for MaterialReactTable with consistent Exo font styling
 *
 * @param {Object} props - All MaterialReactTable props plus additional styling options
 * @param {boolean} props.compact - Use compact theme for smaller screens (default: false)
 * @param {Object} props.customTheme - Override default theme (optional)
 * @param {string} props.fontFamily - Override font family (default: 'Exo, Arial, sans-serif')
 * @param {...any} props.rest - All other MaterialReactTable props
 */
const ExoMaterialTable = ({
  compact = false,
  customTheme,
  fontFamily = 'Exo, Arial, sans-serif',
  ...props
}) => {
  // Select theme based on compact prop
  const selectedTheme = customTheme || (compact ? compactExoTheme : exoTheme);

  // Default table styling options that ensure Exo font
  const defaultTableOptions = {
    muiTableProps: {
      sx: {
        fontFamily: fontFamily,
        '& .MuiTableCell-root': {
          fontFamily: fontFamily,
        },
        '& .MuiTableCell-head': {
          fontFamily: fontFamily,
          fontWeight: 600,
        },
        '& .MuiTableCell-body': {
          fontFamily: fontFamily,
        },
        '& .MuiTableCell-footer': {
          fontFamily: fontFamily,
          fontWeight: 700,
        },
      },
    },
    muiTableHeadCellProps: {
      sx: {
        fontFamily: fontFamily,
        fontWeight: 600,
        fontSize: '12px',
      },
    },
    muiTableBodyCellProps: {
      sx: {
        fontFamily: fontFamily,
        fontSize: '12px',
      },
    },
    muiTableFooterCellProps: {
      sx: {
        fontFamily: fontFamily,
        fontWeight: 700,
        fontSize: '11px',
        backgroundColor: '#eff6ff',
        borderTop: '2px solid #9ca3af',
      },
    },
    muiTablePaginationProps: {
      sx: {
        fontFamily: fontFamily,
        fontSize: '12px',
        '& .MuiTablePagination-toolbar': {
          fontFamily: fontFamily,
        },
        '& .MuiTablePagination-caption': {
          fontFamily: fontFamily,
        },
        '& .MuiTablePagination-select': {
          fontFamily: fontFamily,
        },
        '& .MuiTablePagination-actions': {
          fontFamily: fontFamily,
        },
      },
    },
    muiTopToolbarProps: {
      sx: {
        fontFamily: fontFamily,
        '& .MuiButton-root': {
          fontFamily: fontFamily,
          fontSize: '12px',
        },
        '& .MuiTypography-root': {
          fontFamily: fontFamily,
        },
      },
    },
    muiBottomToolbarProps: {
      sx: {
        fontFamily: fontFamily,
        '& .MuiButton-root': {
          fontFamily: fontFamily,
          fontSize: '12px',
        },
      },
    },
    // The stock clear button only empties the box — it never closes it, and
    // every grid here opens the box on mount (showGlobalFilter in initialState)
    // rather than behind the toolbar's magnifier. So pressing X appeared to do
    // nothing once the text was already gone, and there was no obvious way to
    // put the search bar away again. This one clears AND closes; the magnifier
    // in the toolbar brings it back.
    muiSearchTextFieldProps: ({ table }) => ({
      sx: {
        fontFamily: fontFamily,
        fontSize: '12px',
        '& .MuiInputBase-root': {
          fontFamily: fontFamily,
        },
        '& .MuiInputLabel-root': {
          fontFamily: fontFamily,
        },
      },
      // Merged over MRT's own InputProps, so the leading search icon stays.
      InputProps: {
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title="Clear and close search">
              <IconButton
                aria-label="Clear and close search"
                size="small"
                onClick={() => {
                  table.setGlobalFilter(undefined);
                  table.setShowGlobalFilter(false);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      },
    }),
    // The stock toolbar drops the search toggle whenever `showGlobalFilter` is
    // in initialState, on the assumption that a box which starts open never
    // closes. Ours does close, so the button has to be here or there would be
    // no way back. The rest of the row is MRT's own default set, in its order.
    renderToolbarInternalActions: ({ table }) => (
      <>
        <MRT_ToggleGlobalFilterButton table={table} />
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
        <MRT_ToggleFullScreenButton table={table} />
      </>
    ),

    muiSelectProps: {
      sx: {
        fontFamily: fontFamily,
        fontSize: '12px',
        '& .MuiSelect-select': {
          fontFamily: fontFamily,
        },
        '& .MuiMenuItem-root': {
          fontFamily: fontFamily,
        },
      },
    },
  };

  // Merge default options with user provided options
  const mergedProps = {
    ...defaultTableOptions,
    ...props,
    // Deep merge the sx properties
    muiTableProps: {
      ...defaultTableOptions.muiTableProps,
      ...props.muiTableProps,
      sx: {
        ...defaultTableOptions.muiTableProps.sx,
        ...props.muiTableProps?.sx,
      },
    },
    muiTableHeadCellProps: {
      ...defaultTableOptions.muiTableHeadCellProps,
      ...props.muiTableHeadCellProps,
      sx: {
        ...defaultTableOptions.muiTableHeadCellProps.sx,
        ...props.muiTableHeadCellProps?.sx,
      },
    },
    muiTableBodyCellProps: {
      ...defaultTableOptions.muiTableBodyCellProps,
      ...props.muiTableBodyCellProps,
      sx: {
        ...defaultTableOptions.muiTableBodyCellProps.sx,
        ...props.muiTableBodyCellProps?.sx,
      },
    },
    muiTableFooterCellProps: {
      ...defaultTableOptions.muiTableFooterCellProps,
      ...props.muiTableFooterCellProps,
      sx: {
        ...defaultTableOptions.muiTableFooterCellProps.sx,
        ...props.muiTableFooterCellProps?.sx,
      },
    },
  };

  return (
    <ThemeProvider theme={selectedTheme}>
      <FontOverride />
      <div style={{ fontFamily: fontFamily }}>
        <MaterialReactTable {...mergedProps} />
      </div>
    </ThemeProvider>
  );
};

export default ExoMaterialTable;

// Export themes for direct use if needed
export { exoTheme, compactExoTheme } from '../themes/MaterialTableTheme';
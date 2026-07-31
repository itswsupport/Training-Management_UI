"use client";

import React, { useMemo, useState } from 'react';
import ExoMaterialTable from './ExoMaterialTable';
import { Box, Button, Chip } from '@mui/material';
import { FileDown, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

/**
 * ExoMaterialTableExample - Complete example showcasing all Material React Table features
 *
 * This component demonstrates:
 * - Column configuration (text, numeric, date, status, actions)
 * - Sorting, filtering, pagination
 * - Row selection
 * - Export to Excel, PDF, Print
 * - Custom cell renderers
 * - Status badges
 * - Clickable reference numbers
 * - Authority vs User view
 * - Compact mode
 *
 * Use this as a reference template for implementing tables across all modules
 */

const ExoMaterialTableExample = ({
  // Data props
  data = [],

  // View configuration
  isAuthorityView = false,

  // Table configuration
  enableRowSelection = false,
  enableExport = true,
  compact = false,

  // Event handlers
  onRowClick,
  onRefClick,

  // Custom columns (optional - will be merged with default columns)
  customColumns = [],

  // Module-specific config
  moduleName = "Example Module",
  refKeyName = "refNo", // Key name for reference number in data
  statusKeyName = "status", // Key name for status in data
}) => {
  const [rowSelection, setRowSelection] = useState({});

  /**
   * STANDARD STATUS CONFIGURATION
   * Use these across all modules for consistency
   */
  const getStatusConfig = (status) => {
    const statusMap = {
      0: { text: "PENDING", color: "#f59e0b", bgColor: "#fef3c7" },
      1: { text: "APPROVED", color: "#10b981", bgColor: "#d1fae5" },
      2: { text: "REJECTED", color: "#ef4444", bgColor: "#fee2e2" },
      3: { text: "DRAFT", color: "#6b7280", bgColor: "#f3f4f6" },
      4: { text: "SUBMITTED", color: "#3b82f6", bgColor: "#dbeafe" },
    };
    return statusMap[status] || { text: "UNKNOWN", color: "#6b7280", bgColor: "#f3f4f6" };
  };

  /**
   * STANDARD COLUMN DEFINITIONS
   * Customize these based on your module's needs
   */
  const columns = useMemo(() => {
    const baseColumns = [
      // ========== REFERENCE NUMBER COLUMN ==========
      // Always make this clickable and styled
      {
        accessorKey: refKeyName,
        header: "REF NO",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Box
              onClick={(e) => {
                e.stopPropagation();
                if (onRefClick) onRefClick(cell.row.original);
              }}
              sx={{
                display: 'inline-block',
                backgroundColor: "#3482AE",
                color: "white",
                padding: "4px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "Exo",
                "&:hover": {
                  backgroundColor: "#2a6a8f",
                  transform: "scale(1.05)",
                },
              }}
            >
              {value || 'N/A'}
            </Box>
          );
        },
      },

      // ========== EMPLOYEE NAME COLUMN ==========
      // Only show in authority view
      ...(isAuthorityView ? [{
        accessorKey: "empName",
        header: "EMPLOYEE NAME",
        size: 180,
        Cell: ({ cell }) => (
          <Box sx={{ fontFamily: "Exo", fontSize: "12px", fontWeight: 500 }}>
            {cell.getValue() || 'N/A'}
          </Box>
        ),
      }] : []),

      // ========== TEXT COLUMNS ==========
      {
        accessorKey: "description",
        header: "DESCRIPTION",
        size: 250,
        Cell: ({ cell }) => (
          <Box sx={{ fontFamily: "Exo", fontSize: "12px" }}>
            {cell.getValue() || '-'}
          </Box>
        ),
      },

      // ========== NUMERIC COLUMN ==========
      {
        accessorKey: "amount",
        header: "AMOUNT",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Box sx={{ fontFamily: "Exo", fontSize: "12px", fontWeight: 600, color: "#10b981" }}>
              {value ? `₹${parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </Box>
          );
        },
      },

      // ========== DATE COLUMNS ==========
      {
        accessorKey: "fromDate",
        header: "FROM DATE",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Box sx={{ fontFamily: "Exo", fontSize: "12px" }}>
              {value ? formatDateToDDMMYYYY(value) : '-'}
            </Box>
          );
        },
      },
      {
        accessorKey: "toDate",
        header: "TO DATE",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Box sx={{ fontFamily: "Exo", fontSize: "12px" }}>
              {value ? formatDateToDDMMYYYY(value) : '-'}
            </Box>
          );
        },
      },

      // ========== STATUS COLUMN ==========
      // Always use consistent color coding
      {
        accessorKey: statusKeyName,
        header: "STATUS",
        size: 120,
        Cell: ({ cell }) => {
          const status = cell.getValue();
          const config = getStatusConfig(status);
          return (
            <Chip
              label={config.text}
              size="small"
              sx={{
                backgroundColor: config.bgColor,
                color: config.color,
                fontWeight: 600,
                fontSize: "11px",
                fontFamily: "Exo",
                border: `1px solid ${config.color}`,
              }}
            />
          );
        },
      },

      // ========== CREATED DATE COLUMN ==========
      {
        accessorKey: "createdDate",
        header: "CREATED DATE",
        size: 140,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Box sx={{ fontFamily: "Exo", fontSize: "12px", color: "#6b7280" }}>
              {value ? formatDateTimeToDDMMYYYY(value) : '-'}
            </Box>
          );
        },
      },

      // Merge custom columns if provided
      ...customColumns,
    ];

    return baseColumns;
  }, [isAuthorityView, refKeyName, statusKeyName, customColumns, onRefClick]);

  /**
   * EXPORT FUNCTIONS
   * Use these across all modules
   */

  // Export to Excel
  const handleExportToExcel = () => {
    try {
      const selectedRows = Object.keys(rowSelection).length > 0
        ? data.filter((_, index) => rowSelection[index])
        : data;

      if (selectedRows.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Prepare data for export
      const exportData = selectedRows.map(row => ({
        'Ref No': row[refKeyName] || '',
        ...(isAuthorityView ? { 'Employee Name': row.empName || '' } : {}),
        'Description': row.description || '',
        'Amount': row.amount ? `₹${parseFloat(row.amount).toFixed(2)}` : '',
        'From Date': row.fromDate ? formatDateToDDMMYYYY(row.fromDate) : '',
        'To Date': row.toDate ? formatDateToDDMMYYYY(row.toDate) : '',
        'Status': getStatusConfig(row[statusKeyName]).text,
        'Created Date': row.createdDate ? formatDateTimeToDDMMYYYY(row.createdDate) : '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, moduleName);

      // Auto-size columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, ...Object.values(r).map(v => String(v).length)), 10);
      ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: Math.min(maxWidth, 50) }));

      XLSX.writeFile(wb, `${moduleName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export to Excel failed:', error);
      toast.error('Failed to export to Excel');
    }
  };

  // Export to PDF
  const handleExportToPDF = () => {
    try {
      const selectedRows = Object.keys(rowSelection).length > 0
        ? data.filter((_, index) => rowSelection[index])
        : data;

      if (selectedRows.length === 0) {
        toast.error('No data to export');
        return;
      }

      const doc = new jsPDF('landscape');

      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(moduleName, 14, 15);

      // Add date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

      // Prepare table headers and data
      const headers = [
        'Ref No',
        ...(isAuthorityView ? ['Employee Name'] : []),
        'Description',
        'Amount',
        'From Date',
        'To Date',
        'Status',
        'Created Date',
      ];

      const tableData = selectedRows.map(row => [
        row[refKeyName] || '',
        ...(isAuthorityView ? [row.empName || ''] : []),
        row.description || '',
        row.amount ? `₹${parseFloat(row.amount).toFixed(2)}` : '',
        row.fromDate ? formatDateToDDMMYYYY(row.fromDate) : '',
        row.toDate ? formatDateToDDMMYYYY(row.toDate) : '',
        getStatusConfig(row[statusKeyName]).text,
        row.createdDate ? formatDateTimeToDDMMYYYY(row.createdDate) : '',
      ]);

      doc.autoTable({
        head: [headers],
        body: tableData,
        startY: 28,
        styles: { fontSize: 8, font: 'helvetica', fontFamily: 'Exo' },
        headStyles: { fillColor: [52, 130, 174], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.save(`${moduleName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Export to PDF failed:', error);
      toast.error('Failed to export to PDF');
    }
  };

  // Print function
  const handlePrint = () => {
    try {
      const selectedRows = Object.keys(rowSelection).length > 0
        ? data.filter((_, index) => rowSelection[index])
        : data;

      if (selectedRows.length === 0) {
        toast.error('No data to print');
        return;
      }

      const printWindow = window.open('', '', 'width=800,height=600');
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${moduleName} - Print</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Exo:wght@400;600&display=swap');
              body { font-family: 'Exo', Arial, sans-serif; padding: 20px; }
              h1 { color: #3482AE; font-size: 20px; margin-bottom: 10px; }
              .meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #3482AE; color: white; font-weight: 600; }
              tr:nth-child(even) { background-color: #f5f5f5; }
              @media print {
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>${moduleName}</h1>
            <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
            <table>
              <thead>
                <tr>
                  <th>Ref No</th>
                  ${isAuthorityView ? '<th>Employee Name</th>' : ''}
                  <th>Description</th>
                  <th>Amount</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                ${selectedRows.map(row => `
                  <tr>
                    <td>${row[refKeyName] || ''}</td>
                    ${isAuthorityView ? `<td>${row.empName || ''}</td>` : ''}
                    <td>${row.description || ''}</td>
                    <td>${row.amount ? `₹${parseFloat(row.amount).toFixed(2)}` : ''}</td>
                    <td>${row.fromDate ? formatDateToDDMMYYYY(row.fromDate) : ''}</td>
                    <td>${row.toDate ? formatDateToDDMMYYYY(row.toDate) : ''}</td>
                    <td>${getStatusConfig(row[statusKeyName]).text}</td>
                    <td>${row.createdDate ? formatDateTimeToDDMMYYYY(row.createdDate) : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Failed to print');
    }
  };

  /**
   * RENDER TOP TOOLBAR WITH EXPORT ACTIONS
   */
  const renderTopToolbarCustomActions = () => {
    if (!enableExport) return null;

    const selectedCount = Object.keys(rowSelection).length;

    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', fontFamily: 'Exo' }}>
        {selectedCount > 0 && (
          <Box sx={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#3482AE',
            marginRight: 1,
            fontFamily: 'Exo'
          }}>
            {selectedCount} selected
          </Box>
        )}
        <Button
          onClick={handleExportToExcel}
          startIcon={<FileSpreadsheet size={16} />}
          variant="outlined"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '12px',
            fontFamily: 'Exo',
            borderColor: '#10b981',
            color: '#10b981',
            '&:hover': {
              borderColor: '#059669',
              backgroundColor: '#d1fae5',
            }
          }}
        >
          Excel
        </Button>
        <Button
          onClick={handleExportToPDF}
          startIcon={<FileDown size={16} />}
          variant="outlined"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '12px',
            fontFamily: 'Exo',
            borderColor: '#ef4444',
            color: '#ef4444',
            '&:hover': {
              borderColor: '#dc2626',
              backgroundColor: '#fee2e2',
            }
          }}
        >
          PDF
        </Button>
        <Button
          onClick={handlePrint}
          startIcon={<Printer size={16} />}
          variant="outlined"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '12px',
            fontFamily: 'Exo',
            borderColor: '#6b7280',
            color: '#6b7280',
            '&:hover': {
              borderColor: '#4b5563',
              backgroundColor: '#f3f4f6',
            }
          }}
        >
          Print
        </Button>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', fontFamily: 'Exo' }}>
      <ExoMaterialTable
        columns={columns}
        data={data}
        compact={compact}

        // Row selection configuration
        enableRowSelection={enableRowSelection}
        onRowSelectionChange={setRowSelection}
        state={{ rowSelection }}

        // Pagination configuration
        enablePagination={true}
        initialState={{
          pagination: { pageSize: 10, pageIndex: 0 },
          sorting: [{ id: refKeyName, desc: true }], // Default sort by ref no descending
        }}
        muiPaginationProps={{
          rowsPerPageOptions: [5, 10, 25, 50, 100],
          showFirstButton: true,
          showLastButton: true,
        }}

        // Sorting configuration
        enableSorting={true}
        enableMultiSort={false}

        // Filtering configuration
        enableColumnFilters={true}
        enableGlobalFilter={true}

        // Column configuration
        enableColumnResizing={true}
        enableColumnActions={true}
        enableHiding={true}
        enableDensityToggle={true}

        // Table styling
        muiTableProps={{
          sx: {
            fontFamily: 'Exo',
            '& .MuiTableCell-root': {
              fontFamily: 'Exo',
            }
          }
        }}

        // Row click handler
        muiTableBodyRowProps={({ row }) => ({
          onClick: () => {
            if (onRowClick) onRowClick(row.original);
          },
          sx: {
            cursor: onRowClick ? 'pointer' : 'default',
            '&:hover': {
              backgroundColor: onRowClick ? '#f5f5f5' : 'transparent',
            },
          },
        })}

        // Top toolbar with export actions
        renderTopToolbarCustomActions={renderTopToolbarCustomActions}

        // Empty state message
        muiTableBodyProps={{
          sx: {
            '& .MuiTableRow-root:last-of-type .MuiTableCell-root': {
              borderBottom: 'none',
            }
          }
        }}

        // Localization
        localization={{
          noRecordsToDisplay: 'No records found',
          pagination: {
            rowsPerPage: 'Rows per page:',
          },
        }}
      />
    </Box>
  );
};

/**
 * UTILITY FUNCTIONS
 * Use these across all modules for consistency
 */

// Format date to DD/MM/YYYY
const formatDateToDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';

  try {
    // Handle array format [year, month, day]
    if (Array.isArray(dateInput)) {
      const [year, month, day] = dateInput;
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }

    // Handle string format
    if (typeof dateInput === 'string') {
      // Check if already in DD/MM/YYYY or DD-MM-YYYY format
      if (dateInput.match(/^\d{2}[/-]\d{2}[/-]\d{4}$/)) {
        return dateInput.replace(/-/g, '/');
      }

      // Handle YYYY-MM-DD format
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateInput.split('-');
        return `${day}/${month}/${year}`;
      }
    }

    // Try parsing as Date object
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return String(dateInput);
  }
};

// Format datetime to DD/MM/YYYY HH:MM
const formatDateTimeToDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('DateTime formatting error:', error);
    return String(dateInput);
  }
};

export default ExoMaterialTableExample;

// Export utility functions for use in other components
export { formatDateToDDMMYYYY, formatDateTimeToDDMMYYYY };

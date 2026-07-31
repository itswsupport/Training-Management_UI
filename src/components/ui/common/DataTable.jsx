"use client";
import { createMemoizedComponent } from '@/lib/optimizeComponent';
import { useState, useMemo, useEffect } from 'react';
import { FaSort, FaSortUp, FaSortDown, FaChevronLeft, FaChevronRight, FaSearch } from 'react-icons/fa';

const DataTable = createMemoizedComponent(({
  data = [],
  columns = [],
  pagination = true,
  sorting = true,
  search = false,
  searchPlaceholder = 'Search...',
  searchableColumns = [],
  title = '',
  pageSize = 10,
  headerClassName = 'bg-[#5a9ec9] text-white',
  rowClassName = 'hover:bg-gray-50',
  containerClassName = 'bg-white rounded shadow mt-4',
  onRowClick,
  loading = false,
  emptyMessage = 'No records found',
  showFooter = false,
  footerData = {},
  footerClassName = 'bg-gray-100 text-gray-900 font-bold'
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Search filtering
  const filteredData = useMemo(() => {
    if (!search || !searchTerm.trim()) return data;

    const term = searchTerm.toLowerCase().trim();
    const columnsToSearch = searchableColumns.length > 0
      ? searchableColumns
      : columns.map(col => col.accessorKey || col.key).filter(Boolean);

    return data.filter(row => {
      return columnsToSearch.some(key => {
        const value = row[key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [data, search, searchTerm, searchableColumns, columns]);

  // Sorting functionality
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Pagination
  const paginatedData = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * pageSize;
    const lastPageIndex = firstPageIndex + pageSize;
    return sortedData.slice(firstPageIndex, lastPageIndex);
  }, [currentPage, pageSize, sortedData]);

  const handleSort = (key) => {
    if (!sorting) return;
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (loading) {
    return (
      <div className={containerClassName}>
        <div className="flex justify-center items-center p-8">
          <div className="w-12 h-12 border-4 border-[#3482AE] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {/* Title and Search Row */}
      {(title || search) && (
        <div className="p-4 border-b flex items-center justify-between">
          {title && (
            <h3 className="text-xl font-semibold text-gray-700">{title}</h3>
          )}
          {!title && <div />}
          {search && (
            <div className="relative w-64">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3482AE] focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className={headerClassName}>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.accessorKey || column.key || index}
                  onClick={() => handleSort(column.accessorKey || column.key)}
                  className={`
                    px-4 py-3 text-center font-semibold text-sm select-none
                    ${sorting ? 'cursor-pointer hover:bg-opacity-90' : ''}
                  `}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>{column.header}</span>
                    {sorting && (
                      <span className="text-xs">
                        {sortConfig.key === (column.accessorKey || column.key) ? (
                          sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />
                        ) : (
                          <FaSort className="opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b ${rowClassName} ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((column, colIndex) => (
                    <td key={column.accessorKey || column.key || colIndex} className="px-4 py-3 text-sm text-center">
                      {column.render ? column.render(row) : row[column.accessorKey || column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {showFooter && (
            <tfoot className={footerClassName}>
              <tr>
                {columns.map((column, colIndex) => (
                  <td key={column.accessorKey || column.key || colIndex} className="px-4 py-3 text-sm text-center">
                    {footerData[column.accessorKey || column.key] !== undefined
                      ? footerData[column.accessorKey || column.key]
                      : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default DataTable;

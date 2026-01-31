import React, { useState, useMemo, useCallback } from 'react';
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Clipboard,
  Trash2,
  Filter,
  Check,
} from 'lucide-react';
import { GanttItem } from '../../types';
import { Button, Badge } from '../UI';
import { useStore } from '../../services/store';
import GanttRow from './GanttRow';
import GanttItemModal from './GanttItemModal';

interface GanttChartProps {
  items: GanttItem[];
  projectId: string;
  onItemCreate: (item: Partial<GanttItem>) => Promise<void>;
  onItemUpdate: (id: string, item: Partial<GanttItem>) => Promise<void>;
  onItemDelete: (id: string) => Promise<void>;
  onBulkCreate: (items: Partial<GanttItem>[]) => Promise<void>;
  readOnly?: boolean;
}

const GANTT_TYPES = [
  'Crew Hotel',
  'Equipment List',
  'Photos',
  'Heavy Equipment',
  'Invoices & Quotes',
  'Hours',
  'Recap',
  'Custom',
];

const GanttChart: React.FC<GanttChartProps> = ({
  items,
  projectId,
  onItemCreate,
  onItemUpdate,
  onItemDelete,
  onBulkCreate,
  readOnly = false,
}) => {
  const { ganttClipboard, setGanttClipboard, clearGanttClipboard } = useStore();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GanttItem | null>(null);

  // Calculate date range for the visual chart
  const dateRange = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!filterType) return items;
    return items.filter((item) =>
      item.type.toLowerCase().includes(filterType.toLowerCase())
    );
  }, [items, filterType]);

  // Get unique types for filter
  const uniqueTypes = useMemo(() => {
    const types = new Set(items.map((item) => item.type));
    return Array.from(types);
  }, [items]);

  // Calculate item position on chart
  const getItemPosition = useCallback(
    (item: GanttItem) => {
      const startDate = parseISO(item.startDate);
      const endDate = parseISO(item.endDate);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const visibleStart = startDate < monthStart ? monthStart : startDate;
      const visibleEnd = endDate > monthEnd ? monthEnd : endDate;

      const startOffset = differenceInDays(visibleStart, monthStart);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;
      const totalDays = dateRange.length;

      return {
        left: `${(startOffset / totalDays) * 100}%`,
        width: `${(duration / totalDays) * 100}%`,
        isPartialStart: startDate < monthStart,
        isPartialEnd: endDate > monthEnd,
      };
    },
    [currentMonth, dateRange.length]
  );

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((item) => item.id)));
    }
  };

  // Copy/Paste handlers
  const copySelected = () => {
    const itemsToCopy = items.filter((item) => selectedItems.has(item.id));
    setGanttClipboard(itemsToCopy);
    setSelectedItems(new Set());
  };

  const pasteItems = async () => {
    if (ganttClipboard.length === 0) return;

    const newItems = ganttClipboard.map((item) => ({
      type: item.type,
      description: item.description,
      startDate: item.startDate,
      endDate: item.endDate,
      strikeStartDate: item.strikeStartDate,
      strikeEndDate: item.strikeEndDate,
      crewNumber: item.crewNumber,
      color: item.color,
      isCompleted: false,
    }));

    await onBulkCreate(newItems);
    clearGanttClipboard();
  };

  // Delete selected
  const deleteSelected = async () => {
    for (const id of selectedItems) {
      await onItemDelete(id);
    }
    setSelectedItems(new Set());
  };

  // Modal handlers
  const openCreateModal = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: GanttItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSaveItem = async (data: Partial<GanttItem>) => {
    if (editingItem) {
      await onItemUpdate(editingItem.id, data);
    } else {
      await onItemCreate(data);
    }
    setModalOpen(false);
    setEditingItem(null);
  };

  // Navigation
  const prevMonth = () => {
    setCurrentMonth((prev) => addDays(startOfMonth(prev), -1));
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => addDays(endOfMonth(prev), 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Gantt Chart</h3>
          <Badge variant="info">{filteredItems.length} items</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              icon={<Filter className="w-4 h-4" />}
              onClick={() => setShowTypeFilter(!showTypeFilter)}
            >
              {filterType || 'Filter'}
            </Button>
            {showTypeFilter && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="p-2">
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                    onClick={() => {
                      setFilterType('');
                      setShowTypeFilter(false);
                    }}
                  >
                    All Types
                  </button>
                  {uniqueTypes.map((type) => (
                    <button
                      key={type}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${
                        filterType === type ? 'bg-primary-50 text-primary-700' : ''
                      }`}
                      onClick={() => {
                        setFilterType(type);
                        setShowTypeFilter(false);
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selection actions */}
          {selectedItems.size > 0 && !readOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="w-4 h-4" />}
                onClick={copySelected}
              >
                Copy ({selectedItems.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={deleteSelected}
              >
                Delete
              </Button>
            </>
          )}

          {/* Paste */}
          {ganttClipboard.length > 0 && !readOnly && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Clipboard className="w-4 h-4" />}
              onClick={pasteItems}
            >
              Paste ({ganttClipboard.length})
            </Button>
          )}

          {/* Add new */}
          {!readOnly && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium min-w-[150px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Chart Header - Days */}
      <div className="flex border-b border-gray-200">
        <div className="w-80 flex-shrink-0 border-r border-gray-200 p-2 bg-gray-50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                selectedItems.size === filteredItems.length &&
                filteredItems.length > 0
              }
              onChange={selectAll}
              className="rounded text-primary-600 focus:ring-primary-500"
              disabled={readOnly}
            />
            <span className="text-sm font-medium text-gray-600">Type / Description</span>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {dateRange.map((date, index) => (
            <div
              key={index}
              className={`flex-1 min-w-[30px] text-center text-xs py-1 border-r border-gray-100 ${
                !isSameMonth(date, currentMonth)
                  ? 'bg-gray-100 text-gray-400'
                  : date.getDay() === 0 || date.getDay() === 6
                  ? 'bg-gray-50'
                  : ''
              }`}
            >
              <div className="font-medium">{format(date, 'd')}</div>
              <div className="text-gray-400">{format(date, 'EEE')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Body */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No items to display. {!readOnly && 'Click "Add Item" to create one.'}
          </div>
        ) : (
          filteredItems.map((item) => (
            <GanttRow
              key={item.id}
              item={item}
              dateRange={dateRange}
              currentMonth={currentMonth}
              isSelected={selectedItems.has(item.id)}
              onSelect={() => toggleSelection(item.id)}
              onClick={() => openEditModal(item)}
              onToggleComplete={
                readOnly
                  ? undefined
                  : () =>
                      onItemUpdate(item.id, { isCompleted: !item.isCompleted })
              }
              getItemPosition={getItemPosition}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary-500 rounded" />
          <span>Work Period</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded" />
          <span>Strike Period</span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <span>Completed</span>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <GanttItemModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSaveItem}
        ganttTypes={GANTT_TYPES}
        allItems={items}
      />
    </div>
  );
};

export default GanttChart;

import React from 'react';
import { format, parseISO, isSameMonth, isWithinInterval } from 'date-fns';
import { Check, GripVertical } from 'lucide-react';
import { GanttItem } from '../../types';

interface GanttRowProps {
  item: GanttItem;
  dateRange: Date[];
  currentMonth: Date;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onToggleComplete?: () => void;
  getItemPosition: (item: GanttItem) => {
    left: string;
    width: string;
    isPartialStart: boolean;
    isPartialEnd: boolean;
  };
  readOnly?: boolean;
}

const GanttRow: React.FC<GanttRowProps> = ({
  item,
  dateRange,
  currentMonth,
  isSelected,
  onSelect,
  onClick,
  onToggleComplete,
  getItemPosition,
  readOnly = false,
}) => {
  const position = getItemPosition(item);
  const startDate = parseISO(item.startDate);
  const endDate = parseISO(item.endDate);

  // Check if item is visible in current month
  const isVisible =
    dateRange.length > 0 &&
    (isWithinInterval(startDate, {
      start: dateRange[0],
      end: dateRange[dateRange.length - 1],
    }) ||
      isWithinInterval(endDate, {
        start: dateRange[0],
        end: dateRange[dateRange.length - 1],
      }) ||
      (startDate <= dateRange[0] && endDate >= dateRange[dateRange.length - 1]));

  // Strike period position
  const hasStrike = item.strikeStartDate && item.strikeEndDate;
  const strikePosition = hasStrike
    ? getItemPosition({
        ...item,
        startDate: item.strikeStartDate!,
        endDate: item.strikeEndDate!,
      })
    : null;

  const isStrikeVisible =
    hasStrike &&
    dateRange.length > 0 &&
    (isWithinInterval(parseISO(item.strikeStartDate!), {
      start: dateRange[0],
      end: dateRange[dateRange.length - 1],
    }) ||
      isWithinInterval(parseISO(item.strikeEndDate!), {
        start: dateRange[0],
        end: dateRange[dateRange.length - 1],
      }));

  return (
    <div
      className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        item.isCompleted ? 'opacity-60' : ''
      }`}
    >
      {/* Info Column */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 p-2 flex items-center gap-2">
        {!readOnly && (
          <>
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="rounded text-primary-600 focus:ring-primary-500 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          </>
        )}
        <button
          onClick={onClick}
          className="flex-1 text-left hover:text-primary-600 truncate"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color || '#3b82f6' }}
            />
            <span className="font-medium text-sm truncate">{item.type}</span>
          </div>
          <p className="text-xs text-gray-500 truncate pl-5">
            {item.description || 'No description'}
          </p>
        </button>
        {onToggleComplete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              item.isCompleted
                ? 'bg-green-100 text-green-600'
                : 'hover:bg-gray-200 text-gray-400'
            }`}
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chart Column */}
      <div className="flex-1 relative h-14">
        {/* Day grid */}
        <div className="absolute inset-0 flex">
          {dateRange.map((date, index) => (
            <div
              key={index}
              className={`flex-1 border-r border-gray-50 ${
                !isSameMonth(date, currentMonth)
                  ? 'bg-gray-50'
                  : date.getDay() === 0 || date.getDay() === 6
                  ? 'bg-gray-25'
                  : ''
              }`}
            />
          ))}
        </div>

        {/* Work period bar */}
        {isVisible && (
          <div
            className={`absolute top-2 h-5 rounded-md transition-all cursor-pointer hover:opacity-80 ${
              item.isCompleted ? 'bg-green-500' : ''
            }`}
            style={{
              left: position.left,
              width: position.width,
              backgroundColor: item.isCompleted
                ? undefined
                : item.color || '#3b82f6',
              borderTopLeftRadius: position.isPartialStart ? 0 : undefined,
              borderBottomLeftRadius: position.isPartialStart ? 0 : undefined,
              borderTopRightRadius: position.isPartialEnd ? 0 : undefined,
              borderBottomRightRadius: position.isPartialEnd ? 0 : undefined,
            }}
            onClick={onClick}
            title={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')} (${item.numberOfDays} days)`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium truncate px-1">
              {item.numberOfDays}d
            </span>
          </div>
        )}

        {/* Strike period bar */}
        {isStrikeVisible && strikePosition && (
          <div
            className="absolute top-8 h-4 bg-orange-500 rounded-md transition-all cursor-pointer hover:opacity-80"
            style={{
              left: strikePosition.left,
              width: strikePosition.width,
              borderTopLeftRadius: strikePosition.isPartialStart ? 0 : undefined,
              borderBottomLeftRadius: strikePosition.isPartialStart ? 0 : undefined,
              borderTopRightRadius: strikePosition.isPartialEnd ? 0 : undefined,
              borderBottomRightRadius: strikePosition.isPartialEnd ? 0 : undefined,
            }}
            onClick={onClick}
            title={`Strike: ${format(parseISO(item.strikeStartDate!), 'MMM d')} - ${format(parseISO(item.strikeEndDate!), 'MMM d')} (${item.numberOfStrikeDays} days)`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium truncate px-1">
              {item.numberOfStrikeDays}d
            </span>
          </div>
        )}

        {/* Crew number indicator */}
        {item.crewNumber > 0 && (
          <div className="absolute right-1 top-1 text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded">
            {item.crewNumber} crew
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttRow;

import React, { useState, useEffect } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { GanttItem } from '../../types';
import { Modal, Button, Input, Select, DatePicker } from '../UI';

interface GanttItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: GanttItem | null;
  onSave: (data: Partial<GanttItem>) => Promise<void>;
  ganttTypes: string[];
  allItems: GanttItem[];
}

const COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Lime' },
];

const GanttItemModal: React.FC<GanttItemModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  ganttTypes,
  allItems,
}) => {
  const [formData, setFormData] = useState({
    type: '',
    customType: '',
    description: '',
    startDate: '',
    endDate: '',
    strikeStartDate: '',
    strikeEndDate: '',
    crewNumber: 0,
    color: '#3b82f6',
    dependsOnId: '',
    isCompleted: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setFormData({
        type: ganttTypes.includes(item.type) ? item.type : 'Custom',
        customType: ganttTypes.includes(item.type) ? '' : item.type,
        description: item.description || '',
        startDate: item.startDate?.split('T')[0] || '',
        endDate: item.endDate?.split('T')[0] || '',
        strikeStartDate: item.strikeStartDate?.split('T')[0] || '',
        strikeEndDate: item.strikeEndDate?.split('T')[0] || '',
        crewNumber: item.crewNumber || 0,
        color: item.color || '#3b82f6',
        dependsOnId: item.dependsOnId || '',
        isCompleted: item.isCompleted || false,
      });
    } else {
      setFormData({
        type: '',
        customType: '',
        description: '',
        startDate: '',
        endDate: '',
        strikeStartDate: '',
        strikeEndDate: '',
        crewNumber: 0,
        color: '#3b82f6',
        dependsOnId: '',
        isCompleted: false,
      });
    }
    setErrors({});
  }, [item, isOpen, ganttTypes]);

  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    return differenceInDays(parseISO(end), parseISO(start)) + 1;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) {
      newErrors.type = 'Type is required';
    }
    if (formData.type === 'Custom' && !formData.customType.trim()) {
      newErrors.customType = 'Custom type name is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (
      formData.strikeStartDate &&
      formData.strikeEndDate &&
      formData.strikeStartDate > formData.strikeEndDate
    ) {
      newErrors.strikeEndDate = 'Strike end date must be after strike start date';
    }
    if (
      (formData.strikeStartDate && !formData.strikeEndDate) ||
      (!formData.strikeStartDate && formData.strikeEndDate)
    ) {
      newErrors.strikeStartDate = 'Both strike dates are required if one is set';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const type =
        formData.type === 'Custom' ? formData.customType.trim() : formData.type;

      const data: Partial<GanttItem> = {
        type,
        description: formData.description.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        numberOfDays: calculateDays(formData.startDate, formData.endDate),
        strikeStartDate: formData.strikeStartDate || null,
        strikeEndDate: formData.strikeEndDate || null,
        numberOfStrikeDays: formData.strikeStartDate && formData.strikeEndDate
          ? calculateDays(formData.strikeStartDate, formData.strikeEndDate)
          : 0,
        crewNumber: formData.crewNumber,
        color: formData.color,
        dependsOnId: formData.dependsOnId || null,
        isCompleted: formData.isCompleted,
      };

      await onSave(data);
    } catch (error) {
      console.error('Error saving gantt item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
          ? parseInt(value) || 0
          : value,
    }));
  };

  const numberOfDays = calculateDays(formData.startDate, formData.endDate);
  const numberOfStrikeDays = calculateDays(formData.strikeStartDate, formData.strikeEndDate);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Gantt Item' : 'Add Gantt Item'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type */}
          <Select
            label="Type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            options={[
              { value: '', label: 'Select type...' },
              ...ganttTypes.map((t) => ({ value: t, label: t })),
            ]}
            error={errors.type}
            required
          />

          {/* Custom Type */}
          {formData.type === 'Custom' && (
            <Input
              label="Custom Type Name"
              name="customType"
              value={formData.customType}
              onChange={handleChange}
              error={errors.customType}
              placeholder="Enter custom type..."
              required
            />
          )}

          {/* Description */}
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input min-h-[80px]"
              placeholder="Enter description..."
            />
          </div>
        </div>

        {/* Work Period */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3">Work Period</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DatePicker
              label="Start Date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              error={errors.startDate}
              required
            />
            <DatePicker
              label="End Date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              error={errors.endDate}
              required
            />
            <div>
              <label className="label">Number of Days</label>
              <div className="input bg-gray-100 text-gray-600">
                {numberOfDays > 0 ? `${numberOfDays} days` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Strike Period */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3">Strike Period (Optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DatePicker
              label="Strike Start Date"
              name="strikeStartDate"
              value={formData.strikeStartDate}
              onChange={handleChange}
              error={errors.strikeStartDate}
            />
            <DatePicker
              label="Strike End Date"
              name="strikeEndDate"
              value={formData.strikeEndDate}
              onChange={handleChange}
              error={errors.strikeEndDate}
            />
            <div>
              <label className="label">Strike Days</label>
              <div className="input bg-gray-100 text-gray-600">
                {numberOfStrikeDays > 0 ? `${numberOfStrikeDays} days` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Fields */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Crew Number */}
            <Input
              label="Crew Number"
              name="crewNumber"
              type="number"
              min="0"
              value={formData.crewNumber}
              onChange={handleChange}
            />

            {/* Color */}
            <div>
              <label className="label">Color</label>
              <div className="flex items-center gap-2">
                <select
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="input flex-1"
                >
                  {COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
                <div
                  className="w-10 h-10 rounded-lg border border-gray-300"
                  style={{ backgroundColor: formData.color }}
                />
              </div>
            </div>

            {/* Dependency */}
            <Select
              label="Depends On"
              name="dependsOnId"
              value={formData.dependsOnId}
              onChange={handleChange}
              options={[
                { value: '', label: 'None' },
                ...allItems
                  .filter((i) => i.id !== item?.id)
                  .map((i) => ({ value: i.id, label: i.type })),
              ]}
            />
          </div>
        </div>

        {/* Completed checkbox */}
        {item && (
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isCompleted"
                checked={formData.isCompleted}
                onChange={handleChange}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Mark as completed
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="border-t pt-4 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {item ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default GanttItemModal;

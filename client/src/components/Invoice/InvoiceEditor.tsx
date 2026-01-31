import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  GripVertical,
  Image as ImageIcon,
} from 'lucide-react';
import { Invoice, InvoiceLineItem, CompanySettings } from '../../types';
import { Button, Input, Select, DatePicker, Modal, Badge } from '../UI';
import { format } from 'date-fns';

interface InvoiceEditorProps {
  invoice: Invoice | null;
  companySettings: CompanySettings | null;
  onSave: (data: Partial<Invoice>) => Promise<void>;
  onAddLineItem: (item: Partial<InvoiceLineItem>) => Promise<void>;
  onUpdateLineItem: (id: string, item: Partial<InvoiceLineItem>) => Promise<void>;
  onDeleteLineItem: (id: string) => Promise<void>;
  onGeneratePdf: () => void;
  onSendEmail: (email: string) => Promise<void>;
  readOnly?: boolean;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({
  invoice,
  companySettings,
  onSave,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onGeneratePdf,
  onSendEmail,
  readOnly = false,
}) => {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<string | null>(null);
  const [newLineItem, setNewLineItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: 0,
  });

  useEffect(() => {
    if (invoice) {
      setFormData({
        companyName: invoice.companyName || companySettings?.name || '',
        companyAddress: invoice.companyAddress || companySettings?.address || '',
        companyPhone: invoice.companyPhone || companySettings?.phone || '',
        companyEmail: invoice.companyEmail || companySettings?.email || '',
        companyLogo: invoice.companyLogo || companySettings?.logo || '',
        clientName: invoice.clientName || '',
        clientAddress: invoice.clientAddress || '',
        clientEmail: invoice.clientEmail || '',
        issueDate: invoice.issueDate || format(new Date(), 'yyyy-MM-dd'),
        dueDate: invoice.dueDate || '',
        terms: invoice.terms || companySettings?.defaultTerms || 'Net 30',
        notes: invoice.notes || '',
        taxRate: invoice.taxRate ?? companySettings?.defaultTaxRate ?? 0,
      });
      setEmailAddress(invoice.clientEmail || '');
    }
  }, [invoice, companySettings]);

  // Calculate totals
  const totals = useMemo(() => {
    const lineItems = invoice?.lineItems || [];
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * ((formData.taxRate || 0) / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [invoice?.lineItems, formData.taxRate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...formData,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLineItem = async () => {
    if (!newLineItem.description.trim()) return;

    await onAddLineItem({
      description: newLineItem.description,
      quantity: newLineItem.quantity,
      unitPrice: newLineItem.unitPrice,
      total: newLineItem.quantity * newLineItem.unitPrice,
    });

    setNewLineItem({ description: '', quantity: 1, unitPrice: 0 });
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) return;

    setSending(true);
    try {
      await onSendEmail(emailAddress);
      setShowEmailModal(false);
    } finally {
      setSending(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      draft: 'default',
      sent: 'info',
      paid: 'success',
      overdue: 'danger',
      cancelled: 'warning',
    };
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  if (!invoice) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
        Select an invoice to edit or create a new one.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Invoice #{invoice.invoiceNumber}</h3>
          {getStatusBadge(invoice.status)}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSave}
              loading={saving}
            >
              Save
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={onGeneratePdf}
          >
            PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Send className="w-4 h-4" />}
            onClick={() => setShowEmailModal(true)}
          >
            Email
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Company Info (Editable) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h4 className="font-medium text-gray-700 mb-3">From (Your Company)</h4>
            <div className="space-y-3">
              {formData.companyLogo && (
                <div className="mb-3">
                  <img
                    src={formData.companyLogo}
                    alt="Company Logo"
                    className="h-16 object-contain"
                  />
                </div>
              )}
              <Input
                label="Company Name"
                name="companyName"
                value={formData.companyName || ''}
                onChange={handleChange}
                disabled={readOnly}
              />
              <div>
                <label className="label">Address</label>
                <textarea
                  name="companyAddress"
                  value={formData.companyAddress || ''}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="input min-h-[80px]"
                />
              </div>
              <Input
                label="Phone"
                name="companyPhone"
                value={formData.companyPhone || ''}
                onChange={handleChange}
                disabled={readOnly}
              />
              <Input
                label="Email"
                name="companyEmail"
                type="email"
                value={formData.companyEmail || ''}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Client Info */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Bill To</h4>
            <div className="space-y-3">
              <Input
                label="Client Name"
                name="clientName"
                value={formData.clientName || ''}
                onChange={handleChange}
                disabled={readOnly}
              />
              <div>
                <label className="label">Address</label>
                <textarea
                  name="clientAddress"
                  value={formData.clientAddress || ''}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="input min-h-[80px]"
                />
              </div>
              <Input
                label="Email"
                name="clientEmail"
                type="email"
                value={formData.clientEmail || ''}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <DatePicker
            label="Issue Date"
            name="issueDate"
            value={formData.issueDate || ''}
            onChange={handleChange}
            disabled={readOnly}
          />
          <DatePicker
            label="Due Date"
            name="dueDate"
            value={formData.dueDate || ''}
            onChange={handleChange}
            disabled={readOnly}
          />
          <Input
            label="Terms"
            name="terms"
            value={formData.terms || ''}
            onChange={handleChange}
            disabled={readOnly}
            placeholder="e.g., Net 30"
          />
          <Input
            label="Tax Rate (%)"
            name="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.taxRate || 0}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <h4 className="font-medium text-gray-700 mb-3">Line Items</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 w-24">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 w-32">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 w-32">
                    Total
                  </th>
                  {!readOnly && <th className="px-4 py-3 w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {(invoice.lineItems || []).map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      {editingLineItem === item.id ? (
                        <input
                          type="text"
                          defaultValue={item.description}
                          onBlur={(e) => {
                            onUpdateLineItem(item.id, { description: e.target.value });
                            setEditingLineItem(null);
                          }}
                          className="input"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={readOnly ? '' : 'cursor-pointer hover:text-primary-600'}
                          onClick={() => !readOnly && setEditingLineItem(item.id)}
                        >
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateLineItem(item.id, {
                            quantity: parseInt(e.target.value) || 1,
                            total: (parseInt(e.target.value) || 1) * item.unitPrice,
                          })
                        }
                        disabled={readOnly}
                        className="w-20 text-right input"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          onUpdateLineItem(item.id, {
                            unitPrice: parseFloat(e.target.value) || 0,
                            total: item.quantity * (parseFloat(e.target.value) || 0),
                          })
                        }
                        disabled={readOnly}
                        className="w-28 text-right input"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${item.total.toFixed(2)}
                    </td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onDeleteLineItem(item.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {/* Add new line item */}
                {!readOnly && (
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Description"
                        value={newLineItem.description}
                        onChange={(e) =>
                          setNewLineItem((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="input"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={newLineItem.quantity}
                        onChange={(e) =>
                          setNewLineItem((prev) => ({
                            ...prev,
                            quantity: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-20 text-right input"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newLineItem.unitPrice}
                        onChange={(e) =>
                          setNewLineItem((prev) => ({
                            ...prev,
                            unitPrice: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28 text-right input"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${(newLineItem.quantity * newLineItem.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={handleAddLineItem}
                        disabled={!newLineItem.description.trim()}
                      >
                        Add
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax ({formData.taxRate || 0}%):</span>
              <span className="font-medium">${totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            disabled={readOnly}
            className="input min-h-[100px]"
            placeholder="Additional notes or payment instructions..."
          />
        </div>
      </div>

      {/* Email Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Send Invoice"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="client@example.com"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowEmailModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Send className="w-4 h-4" />}
              onClick={handleSendEmail}
              loading={sending}
              disabled={!emailAddress.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceEditor;

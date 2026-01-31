import React from 'react';
import { format } from 'date-fns';
import { Plus, FileText } from 'lucide-react';
import { Invoice } from '../../types';
import { Button, Badge, Card } from '../UI';

interface InvoiceListProps {
  invoices: Invoice[];
  selectedId: string | null;
  onSelect: (invoice: Invoice) => void;
  onCreate: () => void;
  readOnly?: boolean;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  selectedId,
  onSelect,
  onCreate,
  readOnly = false,
}) => {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      draft: 'default',
      sent: 'info',
      paid: 'success',
      overdue: 'danger',
      cancelled: 'warning',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold">Invoices</h3>
        {!readOnly && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onCreate}
          >
            New
          </Button>
        )}
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No invoices yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => onSelect(invoice)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selectedId === invoice.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">#{invoice.invoiceNumber}</span>
                  {getStatusBadge(invoice.status)}
                </div>
                <p className="text-sm text-gray-600 truncate">{invoice.clientName}</p>
                <div className="flex items-center justify-between mt-1 text-sm">
                  <span className="text-gray-500">
                    {format(new Date(invoice.issueDate), 'MMM d, yyyy')}
                  </span>
                  <span className="font-medium">${invoice.total.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default InvoiceList;

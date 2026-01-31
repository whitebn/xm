import React, { useEffect, useState } from 'react';
import {
  Building,
  Save,
  Upload,
  Palette,
  Bell,
  Shield,
  Database,
} from 'lucide-react';
import { Card, Button, Input } from '../components/UI';
import { settingsApi, categoriesApi } from '../services/api';
import { CompanySettings, CategoryTemplate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../services/store';

const Settings: React.FC = () => {
  const { isAdmin, canManage } = useAuth();
  const { setCompanySettings, categoryTemplates, setCategoryTemplates } = useStore();

  const [activeTab, setActiveTab] = useState('company');
  const [companyData, setCompanyData] = useState<Partial<CompanySettings>>({
    name: '',
    address: '',
    phone: '',
    email: '',
    defaultTerms: 'Net 30',
    defaultTaxRate: 0,
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, categoriesRes] = await Promise.all([
        settingsApi.get(),
        categoriesApi.getAll(),
      ]);

      if (settingsRes.data.data) {
        setCompanyData(settingsRes.data.data);
        setLogoPreview(settingsRes.data.data.logo || null);
        setCompanySettings(settingsRes.data.data);
      }

      if (categoriesRes.data.data) {
        setCategoryTemplates(categoriesRes.data.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      // Upload logo if changed
      if (logoFile) {
        const logoRes = await settingsApi.uploadLogo(logoFile);
        if (logoRes.data.data?.url) {
          companyData.logo = logoRes.data.data.url;
        }
      }

      const response = await settingsApi.update(companyData);
      if (response.data.data) {
        setCompanySettings(response.data.data);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompanyChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setCompanyData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building },
    { id: 'categories', label: 'Categories', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(isAdmin() ? [{ id: 'security', label: 'Security', icon: Shield }] : []),
    ...(isAdmin() ? [{ id: 'data', label: 'Data', icon: Database }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">Manage your application settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <div className="lg:col-span-1">
          <Card padding="sm">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'company' && (
            <Card>
              <h2 className="font-semibold text-lg mb-6">Company Information</h2>
              <div className="space-y-6">
                {/* Logo */}
                <div>
                  <label className="label">Company Logo</label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-20 w-auto object-contain border border-gray-200 rounded-lg p-2"
                      />
                    ) : (
                      <div className="h-20 w-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        No logo
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Upload className="w-4 h-4" />}
                        onClick={() => {}}
                      >
                        Upload Logo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Company Name"
                    name="name"
                    value={companyData.name || ''}
                    onChange={handleCompanyChange}
                  />
                  <Input
                    label="Phone"
                    name="phone"
                    value={companyData.phone || ''}
                    onChange={handleCompanyChange}
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={companyData.email || ''}
                    onChange={handleCompanyChange}
                  />
                  <Input
                    label="Default Tax Rate (%)"
                    name="defaultTaxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={companyData.defaultTaxRate || 0}
                    onChange={handleCompanyChange}
                  />
                </div>

                <div>
                  <label className="label">Address</label>
                  <textarea
                    name="address"
                    value={companyData.address || ''}
                    onChange={handleCompanyChange}
                    className="input min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="label">Default Invoice Terms</label>
                  <textarea
                    name="defaultTerms"
                    value={companyData.defaultTerms || ''}
                    onChange={handleCompanyChange}
                    className="input min-h-[80px]"
                    placeholder="e.g., Net 30, Payment due upon receipt, etc."
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    icon={<Save className="w-4 h-4" />}
                    onClick={handleSaveCompany}
                    loading={saving}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'categories' && (
            <Card>
              <h2 className="font-semibold text-lg mb-6">Project Categories</h2>
              <p className="text-gray-500 mb-4">
                Define default categories that can be added to project templates.
              </p>

              <div className="space-y-3">
                {[
                  { name: 'Crew Hotel', color: '#3b82f6', icon: 'hotel' },
                  { name: 'Equipment List', color: '#10b981', icon: 'list' },
                  { name: 'Photos', color: '#f59e0b', icon: 'camera' },
                  { name: 'Heavy Equipment', color: '#ef4444', icon: 'truck' },
                  { name: 'Invoices & Quotes', color: '#8b5cf6', icon: 'file' },
                  { name: 'Hours', color: '#ec4899', icon: 'clock' },
                  { name: 'Recap', color: '#06b6d4', icon: 'document' },
                ].map((cat, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button variant="secondary">Add Category</Button>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <h2 className="font-semibold text-lg mb-6">Notification Settings</h2>
              <div className="space-y-4">
                {[
                  {
                    id: 'upcoming_installs',
                    label: 'Upcoming Installs',
                    description: 'Get notified about installations starting soon',
                  },
                  {
                    id: 'overdue_tasks',
                    label: 'Overdue Tasks',
                    description: 'Get notified when Gantt items are overdue',
                  },
                  {
                    id: 'invoice_status',
                    label: 'Invoice Updates',
                    description: 'Get notified about invoice payments',
                  },
                  {
                    id: 'project_updates',
                    label: 'Project Updates',
                    description: 'Get notified about project status changes',
                  },
                ].map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{setting.label}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'security' && isAdmin() && (
            <Card>
              <h2 className="font-semibold text-lg mb-6">Security Settings</h2>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-800">Microsoft Authentication</h3>
                  <p className="text-sm text-blue-600 mt-1">
                    Authentication is handled through Microsoft 365. Configure your
                    Azure AD settings in the environment variables.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Session Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Session timeout (minutes)</span>
                      <input
                        type="number"
                        defaultValue={60}
                        className="w-24 input"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Require re-authentication for sensitive actions</span>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'data' && isAdmin() && (
            <Card>
              <h2 className="font-semibold text-lg mb-6">Data Management</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Export Data</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Export all your data in a portable format.
                  </p>
                  <Button variant="secondary">Export All Data</Button>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-3 text-red-600">Danger Zone</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    These actions are irreversible. Please proceed with caution.
                  </p>
                  <Button variant="danger">Delete All Data</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

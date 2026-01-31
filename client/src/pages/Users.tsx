import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Shield,
  Mail,
  MoreVertical,
  UserCheck,
  UserX,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, Button, Badge, Table, Modal, Select } from '../components/UI';
import { usersApi } from '../services/api';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

const Users: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('view_only');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await usersApi.getAll();
      if (response.data.data) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      // Mock data for demo
      setUsers([
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          email: 'vp@example.com',
          name: 'VP Operations',
          role: 'vp',
          createdAt: '2024-01-05T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
        },
        {
          id: '3',
          email: 'manager@example.com',
          name: 'Project Manager',
          role: 'manager',
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-12T10:00:00Z',
        },
        {
          id: '4',
          email: 'viewer@example.com',
          name: 'Team Member',
          role: 'view_only',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      await usersApi.updateRole(selectedUser.id, newRole);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, role: newRole } : u
        )
      );
      setEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    const variants: Record<UserRole, { variant: 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'info'; label: string }> = {
      admin: { variant: 'danger', label: 'Admin' },
      vp: { variant: 'primary', label: 'VP' },
      manager: { variant: 'info', label: 'Manager' },
      view_only: { variant: 'default', label: 'View Only' },
    };
    return <Badge variant={variants[role].variant}>{variants[role].label}</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-medium">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => getRoleBadge(user.role),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user: User) =>
        format(new Date(user.createdAt), 'MMM d, yyyy'),
    },
    {
      key: 'actions',
      header: '',
      render: (user: User) =>
        isAdmin() && user.id !== currentUser?.id ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(user);
              setNewRole(user.role);
              setEditModalOpen(true);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500">Manage user access and roles</p>
        </div>
      </div>

      {/* Role Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { role: 'admin', label: 'Admins', icon: Shield, color: 'bg-red-100 text-red-600' },
          { role: 'vp', label: 'VPs', icon: UserCheck, color: 'bg-primary-100 text-primary-600' },
          { role: 'manager', label: 'Managers', icon: UserCheck, color: 'bg-blue-100 text-blue-600' },
          { role: 'view_only', label: 'Viewers', icon: UserX, color: 'bg-gray-100 text-gray-600' },
        ].map((item) => (
          <Card key={item.role} className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.role === item.role).length}
              </p>
              <p className="text-sm text-gray-500">{item.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="vp">VP</option>
            <option value="manager">Manager</option>
            <option value="view_only">View Only</option>
          </select>
        </div>
      </Card>

      {/* Users Table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={filteredUsers}
          keyField="id"
          loading={loading}
          emptyMessage="No users found"
        />
      </Card>

      {/* Permissions Info */}
      <Card>
        <h3 className="font-semibold mb-4">Role Permissions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4">Permission</th>
                <th className="text-center py-2 px-4">Admin</th>
                <th className="text-center py-2 px-4">VP</th>
                <th className="text-center py-2 px-4">Manager</th>
                <th className="text-center py-2 px-4">View Only</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'View Projects', admin: true, vp: true, manager: true, view_only: true },
                { name: 'Create/Edit Projects', admin: true, vp: true, manager: true, view_only: false },
                { name: 'Delete Projects', admin: true, vp: true, manager: false, view_only: false },
                { name: 'Manage Templates', admin: true, vp: true, manager: false, view_only: false },
                { name: 'Generate Reports', admin: true, vp: true, manager: true, view_only: true },
                { name: 'Manage Users', admin: true, vp: false, manager: false, view_only: false },
                { name: 'System Settings', admin: true, vp: true, manager: false, view_only: false },
              ].map((perm) => (
                <tr key={perm.name} className="border-b">
                  <td className="py-2 pr-4">{perm.name}</td>
                  <td className="text-center py-2 px-4">
                    {perm.admin ? '✓' : '—'}
                  </td>
                  <td className="text-center py-2 px-4">{perm.vp ? '✓' : '—'}</td>
                  <td className="text-center py-2 px-4">
                    {perm.manager ? '✓' : '—'}
                  </td>
                  <td className="text-center py-2 px-4">
                    {perm.view_only ? '✓' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Role Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        title="Change User Role"
        size="sm"
      >
        <div className="p-6 space-y-4">
          {selectedUser && (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-medium">
                    {selectedUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <Select
                label="New Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                options={[
                  { value: 'admin', label: 'Admin - Full access' },
                  { value: 'vp', label: 'VP - Manage projects and templates' },
                  { value: 'manager', label: 'Manager - Create and edit projects' },
                  { value: 'view_only', label: 'View Only - Read-only access' },
                ]}
              />

              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpdateRole}>
                  Update Role
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Users;

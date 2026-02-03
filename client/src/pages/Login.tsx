import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, LogIn } from 'lucide-react';
import { Button, Input } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await login(undefined, name || 'Demo User');
      navigate('/');
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Login error:', err);
    }
  };

  const handleQuickLogin = async () => {
    try {
      setError(null);
      await login();
      navigate('/');
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-xl mb-4">
            <FolderKanban className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Project Manager</h1>
          <p className="text-gray-500 mt-2">
            Photo library and project management
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Name Input */}
        <div className="mb-4">
          <Input
            label="Your Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        {/* Sign In Button */}
        <Button
          variant="primary"
          className="w-full py-3"
          onClick={handleLogin}
          loading={isLoading}
          icon={<LogIn className="w-5 h-5" />}
        >
          Sign In
        </Button>

        {/* Quick Demo Login */}
        <div className="mt-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleQuickLogin}
            loading={isLoading}
          >
            Quick Demo Login
          </Button>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>No account required - just enter your name or use demo mode.</p>
        </div>

        {/* Features */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            What you can do:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              Upload and organize photos
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              Tag photos by project or category
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              Search and filter your photo library
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              Manage projects with Gantt charts
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;

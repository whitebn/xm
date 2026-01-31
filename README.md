# Project Management System

A comprehensive project-based management system for construction events with Gantt charts, file management, invoicing, and OneDrive integration.

## Features

- **Project Management**: Create, edit, and track construction event projects
- **Custom Categories**: Add custom categories to project templates (Crew Hotel, Equipment List, Photos, Heavy Equipment, Invoices & Quotes, Hours, Recap)
- **Visual Gantt Chart**: Interactive Gantt chart with:
  - Type, start/end dates, calculated days
  - Strike start/end dates, calculated strike days
  - Crew number assignments
  - Copy/paste functionality
  - Filterable headers
  - Task dependencies
- **Project Information**: Track key project details:
  - Project name and contract number
  - Install dates (start/end)
  - Event dates (start/end)
  - Strike dates (start/end)
  - Project manager, crew lead, sales representative
- **File Management**:
  - Upload files from your computer
  - Link files from OneDrive (Microsoft 365)
  - Global file library and per-project files
- **Invoice Generator**:
  - Create invoices with line items
  - Editable company information
  - Custom terms and logo
  - PDF export
  - Email sending
- **User Roles**: Admin, VP, Manager, View-only access levels
- **Dashboard**: View upcoming projects and notifications
- **Reports**: Generate custom reports with PDF/CSV export
- **Mobile Responsive**: Works on desktop, tablet, and mobile

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Zustand for state management
- MSAL (Microsoft Authentication Library) for Microsoft 365 login
- Microsoft Graph API for OneDrive integration
- Recharts for data visualization
- jsPDF for PDF generation

### Backend
- Node.js with Express
- TypeScript
- SQLite with better-sqlite3
- Multer for file uploads

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Microsoft Azure AD app registration (for authentication)

### Azure AD Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Create a new registration
4. Configure:
   - Redirect URI: `http://localhost:3000` (for development)
   - API permissions: `User.Read`, `Files.Read.All`, `Files.ReadWrite.All`
5. Note your Client ID and Tenant ID

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd project-management-system
```

2. Install dependencies:
```bash
npm run install:all
```

3. Configure environment variables:

**Client** (create `client/.env`):
```
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
```

**Server** (copy and edit `server/.env.example` to `server/.env`):
```
PORT=3001
DATABASE_PATH=./data/database.db
AZURE_CLIENT_ID=your-azure-client-id
AZURE_TENANT_ID=your-azure-tenant-id
```

4. Initialize the database:
```bash
npm run db:setup
```

5. Start the development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── Gantt/      # Gantt chart components
│   │   │   ├── Files/      # File management
│   │   │   ├── Invoice/    # Invoice components
│   │   │   ├── Layout/     # Layout components
│   │   │   └── UI/         # Base UI components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context (Auth)
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── public/
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   └── db/             # Database setup
│   └── data/               # SQLite database
└── package.json
```

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access, manage users, system settings |
| VP | Manage projects, templates, settings |
| Manager | Create/edit projects, run reports |
| View Only | Read-only access to projects and reports |

## API Endpoints

### Authentication
- `GET /api/auth/me` - Get or create current user

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/templates` - List templates
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `POST /api/projects/from-template/:templateId` - Create from template
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Gantt Items
- `GET /api/projects/:id/gantt` - Get gantt items
- `POST /api/projects/:id/gantt` - Create gantt item
- `POST /api/projects/:id/gantt/bulk` - Bulk create
- `PUT /api/projects/:id/gantt/:itemId` - Update gantt item
- `DELETE /api/projects/:id/gantt/:itemId` - Delete gantt item

### Files
- `GET /api/files/global` - Get global files
- `POST /api/files/upload` - Upload file
- `POST /api/files/onedrive` - Link OneDrive file
- `GET /api/projects/:id/files` - Get project files

### Invoices
- `GET /api/projects/:id/invoices` - Get project invoices
- `POST /api/projects/:id/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `PUT /api/invoices/:id` - Update invoice
- `GET /api/invoices/:id/pdf` - Generate PDF
- `POST /api/invoices/:id/send` - Send via email

### Dashboard & Reports
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/upcoming` - Upcoming events
- `POST /api/reports/generate` - Generate report
- `POST /api/reports/export/pdf` - Export PDF
- `POST /api/reports/export/csv` - Export CSV

## License

MIT

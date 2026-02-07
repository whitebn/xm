# Setup Guide for Beginners

A complete, step-by-step guide to get this project running on your local machine. No prior experience required beyond basic computer use.

---

## What This Project Is

This is a **web application** that runs on your own computer. It has two parts:

- **Frontend (client)** — The website you see in your browser (React app on port 3000)
- **Backend (server)** — The behind-the-scenes server that stores data and handles requests (Express API on port 3001)

Both need to be running at the same time for the app to work.

---

## Step 1: Install Node.js

Node.js is the runtime that lets you run JavaScript outside a browser. This project requires **Node.js version 18 or higher**.

### On Windows:
1. Go to https://nodejs.org
2. Click the **LTS** (Long Term Support) download button
3. Run the downloaded `.msi` installer
4. Click "Next" through all the steps, keeping defaults
5. Check the box for "Automatically install the necessary tools" if prompted
6. Restart your computer after installation

### On Mac:
1. Go to https://nodejs.org
2. Click the **LTS** download button
3. Run the downloaded `.pkg` installer
4. Follow the prompts

### Verify Installation:
Open a terminal (or Command Prompt/PowerShell on Windows) and type:
```bash
node --version
```
You should see something like `v18.19.0` or `v20.x.x`. Any version 18+ is fine.

Also check npm (it comes bundled with Node.js):
```bash
npm --version
```
You should see a version number like `10.x.x`.

**If these commands don't work**, close your terminal and open a new one. If it still doesn't work, reinstall Node.js.

---

## Step 2: Install Git

Git is used to download (clone) the project code.

### On Windows:
1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Keep all default options during installation

### On Mac:
1. Open Terminal
2. Type `git --version`
3. If Git is not installed, macOS will prompt you to install the Xcode Command Line Tools — follow the prompts

### Verify Installation:
```bash
git --version
```
You should see something like `git version 2.x.x`.

---

## Step 3: Download the Project Code

Open your terminal and navigate to where you want the project folder to live. For example:

```bash
# Windows (in Command Prompt or PowerShell):
cd C:\Users\YourName\Documents

# Mac/Linux:
cd ~/Documents
```

Then clone (download) the project:
```bash
git clone <repository-url>
```

> Replace `<repository-url>` with the actual Git URL your team gave you.

This creates a folder with the project files. Enter it:
```bash
cd project-management-system
```

> The folder name depends on the repo name. Use whatever folder was created. You can rename it to anything you want (e.g., `pm-site`, `gantt-app`, etc.) — **the folder name does not matter**.

---

## Step 4: Install Project Dependencies

The project uses many third-party packages (libraries). You need to download them. Run this **from the project root folder**:

```bash
npm run install:all
```

**What this does:** It runs `npm install` three times — once in the root folder, once in `client/`, and once in `server/`. This downloads all required packages into `node_modules/` folders.

**This step may take 2-5 minutes** depending on your internet speed. You'll see a lot of text scrolling by — that's normal.

### If `npm run install:all` Fails

Try installing each part manually, one at a time:

```bash
# 1. Install root dependencies
npm install

# 2. Install frontend dependencies
cd client
npm install

# 3. Install backend dependencies
cd ../server
npm install

# 4. Go back to the project root
cd ..
```

---

## Step 5: Create Environment Configuration Files

The project needs `.env` files that hold settings like port numbers and API keys. These files are NOT included in the download for security reasons — you create them from the provided examples.

### 5a. Create the Server `.env` File

```bash
# Mac/Linux:
cp server/.env.example server/.env

# Windows (Command Prompt):
copy server\.env.example server\.env

# Windows (PowerShell):
Copy-Item server\.env.example server\.env
```

Now open `server/.env` in a text editor (VS Code, Notepad, etc.) and review it. **For basic local testing, the defaults work fine.** You only need to edit Azure/SMTP settings if you want authentication and email features.

The file looks like this:
```
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/database.db
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
SMTP_FROM=noreply@company.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
```

> **For now:** You can leave the Azure and SMTP values as-is if you just want to see the app run. Authentication and email won't work, but the rest of the app will load.

### 5b. Create the Client `.env` File

```bash
# Mac/Linux:
cp client/.env.example client/.env

# Windows (Command Prompt):
copy client\.env.example client\.env

# Windows (PowerShell):
Copy-Item client\.env.example client\.env
```

The file looks like this:
```
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
```

> **For now:** Leave these as-is. You'll need real Azure credentials later for login to work (see Step 7).

---

## Step 6: Set Up the Database

The app uses SQLite — a lightweight database stored as a single file on your computer (no separate database server required). Run this command **from the project root**:

```bash
npm run db:setup
```

**What this does:**
- Creates the `server/data/` folder if it doesn't exist
- Creates the file `server/data/database.db`
- Creates all the database tables (users, projects, gantt items, invoices, etc.)
- Inserts default data (7 category templates, default company settings)

You should see output confirming the tables were created. If you see errors about the `data` directory not existing, create it manually first:

```bash
mkdir server/data
npm run db:setup
```

---

## Step 7: Start the Application

From the **project root folder**, run:

```bash
npm run dev
```

**What this does:** Starts BOTH the frontend and backend servers simultaneously using a tool called `concurrently`.

You should see output like:
```
[server] Server running on port 3001
[client] Local: http://localhost:3000/
```

Now open your web browser and go to: **http://localhost:3000**

You should see the application load.

> **To stop the servers:** Press `Ctrl + C` in the terminal.

### If Port 3000 or 3001 Is Already in Use

Something else on your computer is using that port. You can either:
- Close whatever is using the port, OR
- Start client and server separately to troubleshoot:

```bash
# Terminal 1 — start the backend:
npm run dev:server

# Terminal 2 (open a new terminal window) — start the frontend:
npm run dev:client
```

---

## Step 8 (Optional): Set Up Azure AD for Login

This is only needed if you want the Microsoft login and OneDrive features to work. **You can skip this for basic local testing.**

1. Go to https://portal.azure.com and sign in with a Microsoft account
2. Search for **"App registrations"** in the top search bar
3. Click **"New registration"**
4. Fill in:
   - **Name:** `PM System Local` (or anything you want)
   - **Supported account types:** "Accounts in this organizational directory only"
   - **Redirect URI:** Select "Single-page application (SPA)" and enter `http://localhost:3000`
5. Click **Register**
6. On the overview page, copy:
   - **Application (client) ID** — this is your Client ID
   - **Directory (tenant) ID** — this is your Tenant ID
7. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
   - Add: `User.Read`, `Files.Read.All`, `Files.ReadWrite.All`
8. Put these values in BOTH `.env` files:

   In `client/.env`:
   ```
   VITE_AZURE_CLIENT_ID=paste-your-client-id-here
   VITE_AZURE_TENANT_ID=paste-your-tenant-id-here
   ```

   In `server/.env`:
   ```
   AZURE_CLIENT_ID=paste-your-client-id-here
   AZURE_TENANT_ID=paste-your-tenant-id-here
   ```

9. Restart both servers (`Ctrl + C`, then `npm run dev`)

---

## Quick Reference

| What you want to do | Command | Where to run it |
|---|---|---|
| Install everything | `npm run install:all` | Project root |
| Set up the database | `npm run db:setup` | Project root |
| Start the app | `npm run dev` | Project root |
| Start only the frontend | `npm run dev:client` | Project root |
| Start only the backend | `npm run dev:server` | Project root |
| Build for production | `npm run build` | Project root |
| Stop the servers | Press `Ctrl + C` | In the terminal running the servers |

---

## Troubleshooting

### "command not found: node" or "node is not recognized"
Node.js is not installed or not in your system PATH. Reinstall Node.js and restart your terminal.

### "npm ERR! code ENOENT" during install
You're in the wrong folder. Make sure you're in the project root (the folder that contains `package.json`, `client/`, and `server/`).

### "EADDRINUSE: address already in use :::3001"
Port 3001 is already taken. Either close whatever is using it, or change `PORT=3001` to another number (e.g., `PORT=3002`) in `server/.env`.

### Database errors
Try deleting the database and recreating it:
```bash
rm server/data/database.db
npm run db:setup
```

### The page loads but shows a blank screen or login errors
This is likely because Azure AD is not configured. If you just want to test locally without login, see Step 8 to set up Azure, or check if the app has a dev/bypass mode.

### "Cannot find module" errors
Dependencies are missing. Run `npm run install:all` again.

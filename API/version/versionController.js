import jwt from 'jsonwebtoken';
import { config } from '../../config/config.js';
import VersionConfig from './versionSchema.js';

const DEFAULT_VERSION_DATA = {
    key: 'default',
    version: '1.2.0',
    url: 'https://www.dropbox.com/scl/fi/42gj17a24f2wgm1ie3nxl/electron.exe?rlkey=798i6xnpza1oai8e9fxkqopfg&st=dqfk33yz&dl=1',
    status: 'success',
    changeLog: 'Added Version Update',
};

const COOKIE_MAX_AGE = 1000 * 60 * 60 * 12;

const getCookieOptions = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
});

const getVersionRecord = async () => {
    let versionRecord = await VersionConfig.findOne({ key: 'default' }).lean();

    if (!versionRecord) {
        const created = await VersionConfig.create(DEFAULT_VERSION_DATA);
        versionRecord = created.toObject();
    }

    return {
        version: versionRecord.version,
        url: versionRecord.url,
        status: versionRecord.status || 'success',
        changeLog: versionRecord.changeLog,
    };
};

const isAdminAuthenticated = (req) => {
    try {
        const token = req.cookies?.[config.versionAdminCookieName];

        if (!token) {
            return false;
        }

        const payload = jwt.verify(token, config.jwtSecret);
        return payload?.scope === 'version-admin';
    } catch (error) {
        return false;
    }
};

const renderAdminPage = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Electron by Envy</title>
  <style>
    :root {
      --bg-color: #F4F5F9;
      --text-main: #1A1D2D;
      --text-muted: #6E7587;
      --primary: #1A1D2D;
      --primary-hover: #3D445A;
      --surface: #FFFFFF;
      --input-bg: #F4F5F9;
      --border: #E2E8F0;
      --success: #10B981;
      --error: #EF4444;
      --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }

    body {
      font-family: var(--font-family);
      color: var(--text-main);
      background-color: var(--bg-color);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* --- Landing Page Styles --- */
    .landing {
      text-align: center;
      padding: 40px 20px;
      animation: fadeIn 0.6s ease-out;
      width: 100%;
      max-width: 800px;
    }

    .landing h1 {
      font-size: clamp(2rem, 8vw, 4rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #1A1D2D 0%, #4F46E5 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1.1;
    }

    .landing p {
      font-size: clamp(1rem, 4vw, 1.125rem);
      color: var(--text-muted);
      margin-bottom: 40px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.5;
    }

    .button-group {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* --- Common Button Styles --- */
    button {
      border: none;
      border-radius: 9999px;
      padding: 14px 28px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      width: 100%;
      max-width: 250px;
    }

    button:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--primary);
      color: white;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    .btn-secondary {
      background: white;
      color: var(--text-main);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: #F8FAFC;
      border-color: #CBD5E1;
    }

    /* --- Modal Styles --- */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 100;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }

    .modal-overlay.open {
      opacity: 1;
      visibility: visible;
    }

    .modal-content {
      background: var(--surface);
      width: 100%;
      max-width: 500px;
      max-height: 90vh; /* Prevents vertical overflow */
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      transform: scale(0.95) translateY(10px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-overlay.open .modal-content {
      transform: scale(1) translateY(0);
    }

    .modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--input-bg);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0; /* Keeps header fixed */
    }

    .modal-header h2 {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .close-btn {
      background: var(--input-bg);
      color: var(--text-muted);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.2rem;
      transition: background 0.2s;
      padding: 0;
      max-width: 32px;
    }

    .close-btn:hover {
      background: #E2E8F0;
      color: var(--text-main);
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto; /* Makes body scrollable on small screens */
      flex: 1;
    }

    /* --- Form Styles --- */
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #3D445A;
    }

    input, textarea {
      width: 100%;
      padding: 14px 16px;
      font-family: inherit;
      font-size: 1rem;
      border-radius: 16px;
      border: 2px solid transparent;
      background: var(--input-bg);
      color: var(--text-main);
      transition: all 0.2s ease;
      outline: none;
      -webkit-appearance: none; /* Prevents iOS styling issues */
    }

    textarea {
      min-height: 100px;
      resize: vertical;
    }

    input:focus, textarea:focus {
      background: white;
      border-color: #E0E7FF;
      box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      flex-wrap: wrap; /* Helps on very small screens */
    }

    .form-actions button {
      flex: 1;
      max-width: 100%;
    }

    .message {
      font-size: 0.875rem;
      font-weight: 600;
      text-align: center;
      min-height: 20px;
      margin-top: 4px;
    }

    .message.error { color: var(--error); }
    .message.success { color: var(--success); }

    .meta {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--input-bg);
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hidden {
      display: none !important;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <main class="landing">
    <h1>Welcome to Electron</h1>
    <p>by Envy. Manage your application distribution, versioning, and changelogs seamlessly.</p>
    
    <div class="button-group">
      <button class="btn-secondary" onclick="alert('Download started!')">
        Download App
      </button>
      <button class="btn-primary" id="openModalBtn">
        Version Control
      </button>
    </div>
  </main>

  <div class="modal-overlay" id="modalOverlay">
    <div class="modal-content">
      
      <div class="modal-header">
        <h2>Version Control</h2>
        <button class="close-btn" id="closeModalBtn">&times;</button>
      </div>

      <div class="modal-body">
        
        <div id="loadingState" class="message">
          Checking secure session...
        </div>

        <section id="loginCard" class="hidden">
          <form id="loginForm">
            <label>
              Admin Password
              <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter password to unlock" required />
            </label>
            <div class="form-actions">
              <button class="btn-primary" type="submit">Unlock Editor</button>
            </div>
            <p id="loginMessage" class="message"></p>
          </form>
        </section>

        <section id="editorCard" class="hidden">
          <form id="editorForm">
            <label>
              Version Number
              <input id="version" name="version" type="text" placeholder="e.g. 1.2.1" required />
            </label>
            <label>
              Download URL
              <input id="url" name="url" type="url" placeholder="https://example.com/app.exe" required />
            </label>
            <label>
              Change Log
              <textarea id="changeLog" name="changeLog" placeholder="Describe what changed in this release..." required></textarea>
            </label>
            <div class="form-actions">
              <button class="btn-secondary" id="logoutButton" type="button">Logout</button>
              <button class="btn-primary" type="submit">Save Changes</button>
            </div>
            <p id="editorMessage" class="message"></p>
          </form>
          
          <div class="meta">
            <span>Public API: <code>/api/version</code></span>
            <span>Changes are stored securely in MongoDB.</span>
          </div>
        </section>

      </div>
    </div>
  </div>

  <script>
    // --- UI Logic (Modal) ---
    const modalOverlay = document.getElementById('modalOverlay');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');

    openModalBtn.addEventListener('click', () => {
      modalOverlay.classList.add('open');
    });

    closeModalBtn.addEventListener('click', () => {
      modalOverlay.classList.remove('open');
    });

    // Close modal on clicking outside the content box
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('open');
      }
    });

    // --- Original Application Logic ---
    const loadingState = document.getElementById('loadingState');
    const loginCard = document.getElementById('loginCard');
    const editorCard = document.getElementById('editorCard');
    const loginForm = document.getElementById('loginForm');
    const editorForm = document.getElementById('editorForm');
    const loginMessage = document.getElementById('loginMessage');
    const editorMessage = document.getElementById('editorMessage');
    const logoutButton = document.getElementById('logoutButton');

    const setMessage = (element, text, type) => {
      element.textContent = text;
      element.className = 'message' + (type ? ' ' + type : '');
    };

    const fillVersionForm = async () => {
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        document.getElementById('version').value = data.version || '';
        document.getElementById('url').value = data.url || '';
        document.getElementById('changeLog').value = data.changeLog || '';
      } catch (e) {
        console.error("Failed to fetch version data", e);
      }
    };

    const showAuthenticatedState = async () => {
      loadingState.classList.add('hidden');
      loginCard.classList.add('hidden');
      editorCard.classList.remove('hidden');
      setMessage(loginMessage, '', '');
      await fillVersionForm();
    };

    const showLoggedOutState = () => {
      loadingState.classList.add('hidden');
      editorCard.classList.add('hidden');
      loginCard.classList.remove('hidden');
      setMessage(editorMessage, '', '');
      loginForm.reset();
    };

    // RUNS IMMEDIATELY ON PAGE LOAD (Restores strict password protection flow)
    const loadSession = async () => {
      try {
        const response = await fetch('/api/version/admin/session');
        const data = await response.json();
        if (data.authenticated) {
          await showAuthenticatedState();
        } else {
          showLoggedOutState();
        }
      } catch (e) {
        showLoggedOutState(); // Fallback to login if API fails
      }
    };
    
    // Trigger session check immediately
    loadSession();

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(loginMessage, 'Authenticating...', '');

      try {
        const response = await fetch('/api/version/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: document.getElementById('password').value })
        });

        const data = await response.json();
        if (!response.ok) {
          setMessage(loginMessage, data.message || 'Login failed', 'error');
          return;
        }

        setMessage(loginMessage, '', ''); // Clear message on success
        await showAuthenticatedState();
      } catch (e) {
        setMessage(loginMessage, 'Network error occurred', 'error');
      }
    });

    editorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(editorMessage, 'Saving...', '');

      const payload = {
        version: document.getElementById('version').value,
        url: document.getElementById('url').value,
        changeLog: document.getElementById('changeLog').value
      };

      try {
        const response = await fetch('/api/version/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          setMessage(editorMessage, data.message || 'Could not save changes', 'error');
          return;
        }

        setMessage(editorMessage, 'Version details updated successfully.', 'success');
        await fillVersionForm();
        
        // Hide success message after 3 seconds
        setTimeout(() => setMessage(editorMessage, '', ''), 3000);
      } catch (e) {
        setMessage(editorMessage, 'Network error occurred', 'error');
      }
    });

    logoutButton.addEventListener('click', async () => {
      try {
        await fetch('/api/version/admin/logout', { method: 'POST' });
        showLoggedOutState();
      } catch (e) {
        console.error("Logout failed", e);
      }
    });
  </script>
</body>
</html>
`;

export const getVersion = async (req, res, next) => {
    try {
        const versionData = await getVersionRecord();
        res.status(200).json(versionData);
    } catch (error) {
        next(error);
    }
};

export const getVersionAdminPage = (req, res) => {
    res.status(200).type('html').send(renderAdminPage());
};

export const getAdminSession = (req, res) => {
    res.status(200).json({ authenticated: isAdminAuthenticated(req) });
};

export const loginVersionAdmin = (req, res) => {
    const { password } = req.body ?? {};

    if (!config.versionAdminPassword) {
        return res.status(500).json({ message: 'VERSION_ADMIN_PASSWORD is not configured.' });
    }

    if (!password || password !== config.versionAdminPassword) {
        return res.status(401).json({ message: 'Incorrect password.' });
    }

    const token = jwt.sign({ scope: 'version-admin' }, config.jwtSecret, { expiresIn: '12h' });

    res.cookie(config.versionAdminCookieName, token, getCookieOptions());
    return res.status(200).json({ message: 'Login successful.' });
};

export const logoutVersionAdmin = (req, res) => {
    res.clearCookie(config.versionAdminCookieName, {
        ...getCookieOptions(),
        maxAge: undefined,
    });
    return res.status(200).json({ message: 'Logged out.' });
};

export const updateVersion = async (req, res, next) => {
    try {
        if (!isAdminAuthenticated(req)) {
            return res.status(401).json({ message: 'Unauthorized.' });
        }

        const { version, url, changeLog } = req.body ?? {};

        if (!version || !url || !changeLog) {
            return res.status(400).json({ message: 'version, url, and changeLog are required.' });
        }

        const updated = await VersionConfig.findOneAndUpdate(
            { key: 'default' },
            {
                key: 'default',
                version: String(version).trim(),
                url: String(url).trim(),
                changeLog: String(changeLog).trim(),
                status: 'success',
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        ).lean();

        return res.status(200).json({
            message: 'Version updated successfully.',
            version: updated.version,
            url: updated.url,
            status: updated.status,
            changeLog: updated.changeLog,
        });
    } catch (error) {
        next(error);
    }
};

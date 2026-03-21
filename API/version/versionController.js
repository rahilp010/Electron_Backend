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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Version Control Admin</title>
  <style>
    :root {
      --bg: #f5efe4;
      --panel: rgba(255, 250, 242, 0.92);
      --accent: #b85042;
      --accent-dark: #7b2d26;
      --text: #1f1a17;
      --muted: #6f6258;
      --border: rgba(31, 26, 23, 0.12);
      --success: #1f7a4d;
      --error: #a12727;
      --shadow: 0 24px 60px rgba(71, 47, 33, 0.18);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(184, 80, 66, 0.22), transparent 34%),
        radial-gradient(circle at bottom right, rgba(136, 109, 84, 0.22), transparent 32%),
        linear-gradient(135deg, #f9f3ea 0%, #efe2d0 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .shell {
      width: min(100%, 760px);
      background: var(--panel);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      border-radius: 24px;
      overflow: hidden;
      backdrop-filter: blur(10px);
    }

    .hero {
      padding: 28px 28px 18px;
      background: linear-gradient(135deg, rgba(184, 80, 66, 0.14), rgba(123, 45, 38, 0.04));
      border-bottom: 1px solid var(--border);
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1;
    }

    .sub {
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 1rem;
    }

    .content {
      padding: 28px;
    }

    .card {
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.58);
    }

    form {
      display: grid;
      gap: 16px;
    }

    label {
      display: grid;
      gap: 8px;
      font-weight: 700;
    }

    input, textarea {
      width: 100%;
      padding: 12px 14px;
      font: inherit;
      border-radius: 12px;
      border: 1px solid rgba(31, 26, 23, 0.18);
      background: rgba(255, 255, 255, 0.88);
      color: var(--text);
    }

    textarea {
      min-height: 140px;
      resize: vertical;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease;
    }

    button:hover {
      transform: translateY(-1px);
    }

    .primary {
      background: var(--accent);
      color: #fff9f6;
    }

    .secondary {
      background: rgba(31, 26, 23, 0.08);
      color: var(--text);
    }

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .message {
      min-height: 24px;
      margin-top: 4px;
      font-weight: 700;
    }

    .message.error { color: var(--error); }
    .message.success { color: var(--success); }

    .meta {
      display: grid;
      gap: 10px;
      color: var(--muted);
      margin-top: 16px;
      font-size: 0.95rem;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <h1>Version Control</h1>
      <p class="sub">Update your Electron app version, download URL, and changelog from this protected page.</p>
    </section>
    <section class="content">
      <section id="loginCard" class="card hidden">
        <form id="loginForm">
          <label>
            Password
            <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter admin password" required />
          </label>
          <div class="actions">
            <button class="primary" type="submit">Unlock editor</button>
          </div>
          <p id="loginMessage" class="message"></p>
        </form>
      </section>

      <section id="editorCard" class="card hidden">
        <form id="editorForm">
          <label>
            Version
            <input id="version" name="version" type="text" placeholder="1.2.1" required />
          </label>
          <label>
            Download URL
            <input id="url" name="url" type="url" placeholder="https://example.com/app.exe" required />
          </label>
          <label>
            Change Log
            <textarea id="changeLog" name="changeLog" placeholder="Describe what changed in this release" required></textarea>
          </label>
          <div class="actions">
            <button class="primary" type="submit">Save changes</button>
            <button id="logoutButton" class="secondary" type="button">Logout</button>
          </div>
          <p id="editorMessage" class="message"></p>
        </form>
        <div class="meta">
          <span>Public API: <code>/api/version</code></span>
          <span>Changes are stored in MongoDB, so they persist on Vercel.</span>
        </div>
      </section>
    </section>
  </main>

  <script>
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
      const response = await fetch('/api/version');
      const data = await response.json();
      document.getElementById('version').value = data.version || '';
      document.getElementById('url').value = data.url || '';
      document.getElementById('changeLog').value = data.changeLog || '';
    };

    const showAuthenticatedState = async () => {
      loginCard.classList.add('hidden');
      editorCard.classList.remove('hidden');
      setMessage(loginMessage, '', '');
      await fillVersionForm();
    };

    const showLoggedOutState = () => {
      editorCard.classList.add('hidden');
      loginCard.classList.remove('hidden');
      setMessage(editorMessage, '', '');
      loginForm.reset();
    };

    const loadSession = async () => {
      const response = await fetch('/api/version/admin/session');
      const data = await response.json();
      if (data.authenticated) {
        await showAuthenticatedState();
      } else {
        showLoggedOutState();
      }
    };

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(loginMessage, '', '');

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

      setMessage(loginMessage, 'Access granted.', 'success');
      await showAuthenticatedState();
    });

    editorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage(editorMessage, '', '');

      const payload = {
        version: document.getElementById('version').value,
        url: document.getElementById('url').value,
        changeLog: document.getElementById('changeLog').value
      };

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
    });

    logoutButton.addEventListener('click', async () => {
      await fetch('/api/version/admin/logout', { method: 'POST' });
      showLoggedOutState();
    });

    loadSession();
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

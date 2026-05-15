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

const renderAdminPage = (currentData) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Electron by Envy | Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #03060c;
      --accent-blue: #7ba2db;
      --accent-bg: rgba(18, 33, 56, 0.6);
      --border-color: rgba(123, 162, 219, 0.25);
      --text-main: #ffffff;
      --text-dim: rgba(255, 255, 255, 0.6);
      --error-red: #ff4d4d;
      --success-green: #4ade80;
      --modal-bg: rgba(5, 10, 20, 0.95);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: radial-gradient(rgba(123, 162, 219, 0.15) 1px, transparent 1px);
      background-size: 24px 24px;
      background-position: center top;
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .mountain-bg {
      position: absolute;
      bottom: -10%;
      left: -5%;
      width: 110%;
      height: 110%;
      background: url('https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=2000&auto=format&fit=crop') no-repeat center bottom;
      background-size: cover;
      opacity: 0.6;
      mix-blend-mode: screen;
      filter: grayscale(100%) sepia(30%) hue-rotate(185deg) brightness(1.1) contrast(1.4);
      z-index: 1;
      pointer-events: none;
    }

    .ascii-overlay {
      position: absolute;
      color: rgba(123, 162, 219, 0.3);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      line-height: 12px;
      white-space: pre;
      z-index: 2;
      pointer-events: none;
    }
    
    .ascii-overlay.left { bottom: 15%; left: 5%; }
    .ascii-overlay.top-center { top: 5%; left: 45%; }

    .tech-frame {
      position: absolute;
      top: 30px;
      left: 30px;
      right: 30px;
      bottom: 30px;
      border: 1px solid var(--border-color);
      z-index: 10;
      pointer-events: none;
    }

    .crosshair {
      position: absolute;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-blue);
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
    }

    .crosshair.tl { top: -10px; left: -10px; }
    .crosshair.tr { top: -10px; right: -10px; }
    .crosshair.bl { bottom: -10px; left: -10px; }
    .crosshair.br { bottom: -10px; right: -10px; }

    .ui-tags {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 20;
    }

    .ui-tags.tl { top: 24px; left: 24px; align-items: flex-start; }
    .ui-tags.tr { top: 24px; right: 24px; align-items: flex-end; }

    .tag {
      background-color: var(--accent-bg);
      border: 1px solid var(--border-color);
      color: var(--accent-blue);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      letter-spacing: 0.05em;
      backdrop-filter: blur(4px);
    }

    .hero-content {
      position: relative;
      z-index: 30;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .hero-title {
      font-size: clamp(80px, 16vw, 200px);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--text-main);
      line-height: 0.9;
      margin-bottom: 20px;
      text-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); 
    }

    .update-btn {
      background-color: var(--text-main);
      color: #000;
      border: none;
      padding: 12px 32px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: 'Inter', sans-serif;
      margin-top: 20px;
    }

    .update-btn:hover {
      background-color: var(--accent-blue);
      color: #fff;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(123, 162, 219, 0.3);
    }

    /* Modal Styling */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 100;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .modal-overlay.active {
      display: flex;
      opacity: 1;
    }

    .modal-content {
      background: var(--modal-bg);
      border: 1px solid var(--border-color);
      width: 100%;
      max-width: 450px;
      padding: 40px;
      position: relative;
      transform: translateY(20px);
      transition: transform 0.3s ease;
    }

    .modal-overlay.active .modal-content {
      transform: translateY(0);
    }

    .modal-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: var(--accent-blue);
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-title::before {
      content: '>';
      color: var(--accent-blue);
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }

    .form-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      padding: 12px;
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      outline: none;
      transition: border-color 0.3s ease;
    }

    .form-input:focus {
      border-color: var(--accent-blue);
      background: rgba(255, 255, 255, 0.08);
    }

    .form-textarea {
      min-height: 100px;
      resize: vertical;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 32px;
    }

    .btn {
      flex: 1;
      padding: 12px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid transparent;
    }

    .btn-primary {
      background: var(--accent-blue);
      color: #000;
    }

    .btn-primary:hover {
      background: #9ab9e8;
    }

    .btn-secondary {
      background: transparent;
      border-color: var(--border-color);
      color: var(--text-dim);
    }

    .btn-secondary:hover {
      border-color: var(--text-main);
      color: var(--text-main);
    }

    .status-msg {
      margin-top: 16px;
      font-size: 12px;
      display: none;
    }

    .status-msg.error { color: var(--error-red); display: block; }
    .status-msg.success { color: var(--success-green); display: block; }

    /* Close button */
    .modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 20px;
      transition: color 0.2s ease;
    }

    .modal-close:hover {
      color: var(--text-main);
    }

    /* Current Info Tag */
    .current-info {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 20px;
      z-index: 20;
    }
  </style>
</head>
<body>

  <div class="mountain-bg"></div>

  <div class="ascii-overlay left">
      ::#<br>
      :####:<br>
     :######:<br>
    :########:<br>
   :##########:<br>
  :#::::::::::#:<br>
  :############:
  </div>

  <div class="ascii-overlay top-center">
    .::.<br>
    :####:<br>
   ::####::<br>
  :########:<br>
  ::::::::::
  </div>

  <div class="tech-frame">
    <div class="crosshair tl">+</div>
    <div class="crosshair tr">+</div>
    <div class="crosshair bl">+</div>
    <div class="crosshair br">+</div>

    <div class="ui-tags tl">
      <div class="tag">System Status: Online</div>
      <div class="tag">Security: Encrypted</div>
    </div>

    <div class="ui-tags tr">
      <div class="tag">Envy Core v${currentData.version}</div>
      <div class="tag">Admin Panel</div>
    </div>
  </div>

  <main class="hero-content">
    <h1 class="hero-title">ENVY</h1>  
    <button class="update-btn" id="openUpdateBtn">Version Control</button>
  </main>

  <div class="current-info">
    <div class="tag">Current: v${currentData.version}</div>
    <div class="tag">Last Updated: ${new Date().toLocaleDateString()}</div>
  </div>

  <!-- Password Modal -->
  <div class="modal-overlay" id="passwordModal">
    <div class="modal-content">
      <div class="modal-close" onclick="closeModal('passwordModal')">&times;</div>
      <div class="modal-title">Authentication Required</div>
      <p style="font-size: 13px; color: var(--text-dim); margin-bottom: 20px;">Please enter the administrator password to access version control.</p>
      
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" id="adminPassword" class="form-input" placeholder="••••••••" autofocus>
      </div>

      <div id="passwordError" class="status-msg error">Invalid password. Access denied.</div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal('passwordModal')">Cancel</button>
        <button class="btn btn-primary" id="submitPassword">Verify</button>
      </div>
    </div>
  </div>

  <!-- Update Modal -->
  <div class="modal-overlay" id="updateModal">
    <div class="modal-content">
      <div class="modal-close" onclick="closeModal('updateModal')">&times;</div>
      <div class="modal-title">Version Control</div>
      
      <div class="form-group">
        <label class="form-label">New Version</label>
        <input type="text" id="newVersion" class="form-input" value="${currentData.version}">
      </div>

      <div class="form-group">
        <label class="form-label">Download URL</label>
        <input type="text" id="downloadUrl" class="form-input" value="${currentData.url}">
      </div>

      <div class="form-group">
        <label class="form-label">Change Log</label>
        <textarea id="changeLog" class="form-input form-textarea">${currentData.changeLog}</textarea>
      </div>

      <div id="updateStatus" class="status-msg"></div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal('updateModal')">Discard</button>
        <button class="btn btn-primary" id="submitUpdate">Apply Update</button>
      </div>
    </div>
  </div>

  <script>
    const openUpdateBtn = document.getElementById('openUpdateBtn');
    const passwordModal = document.getElementById('passwordModal');
    const updateModal = document.getElementById('updateModal');
    
    const adminPasswordInput = document.getElementById('adminPassword');
    const submitPasswordBtn = document.getElementById('submitPassword');
    const passwordError = document.getElementById('passwordError');

    const submitUpdateBtn = document.getElementById('submitUpdate');
    const updateStatus = document.getElementById('updateStatus');

    // Open password modal on click
    openUpdateBtn.addEventListener('click', () => {
      adminPasswordInput.value = '';
      passwordError.classList.remove('error');
      openModal('passwordModal');
      setTimeout(() => adminPasswordInput.focus(), 100);
    });

    function openModal(id) {
      document.getElementById(id).classList.add('active');
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    // Handle Password Submission
    async function handleLogin() {
      const password = adminPasswordInput.value;
      if (!password) return;

      submitPasswordBtn.innerText = 'Verifying...';
      submitPasswordBtn.disabled = true;

      try {
        const response = await fetch('/api/version/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        if (response.ok) {
          closeModal('passwordModal');
          openModal('updateModal');
        } else {
          passwordError.classList.add('error');
        }
      } catch (err) {
        passwordError.innerText = 'Server error. Please try again.';
        passwordError.classList.add('error');
      } finally {
        submitPasswordBtn.innerText = 'Verify';
        submitPasswordBtn.disabled = false;
      }
    }

    submitPasswordBtn.addEventListener('click', handleLogin);
    adminPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // Handle Update Submission
    async function handleUpdate() {
      const data = {
        version: document.getElementById('newVersion').value,
        url: document.getElementById('downloadUrl').value,
        changeLog: document.getElementById('changeLog').value
      };

      if (!data.version || !data.url || !data.changeLog) {
        updateStatus.innerText = 'All fields are required.';
        updateStatus.className = 'status-msg error';
        return;
      }

      submitUpdateBtn.innerText = 'Processing...';
      submitUpdateBtn.disabled = true;

      try {
        const response = await fetch('/api/version/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          updateStatus.innerText = 'Database updated successfully.';
          updateStatus.className = 'status-msg success';
          
          // Clear session after update to satisfy "ask every time"
          await fetch('/api/version/admin/logout', { method: 'POST' });

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          updateStatus.innerText = result.message || 'Update failed.';
          updateStatus.className = 'status-msg error';
        }
      } catch (err) {
        updateStatus.innerText = 'Network error. Update failed.';
        updateStatus.className = 'status-msg error';
      } finally {
        submitUpdateBtn.innerText = 'Apply Update';
        submitUpdateBtn.disabled = false;
      }
    }

    submitUpdateBtn.addEventListener('click', handleUpdate);
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

export const getVersionAdminPage = async (req, res, next) => {
  try {
    const currentData = await getVersionRecord();
    res.status(200).type('html').send(renderAdminPage(currentData));
  } catch (error) {
    next(error);
  }
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

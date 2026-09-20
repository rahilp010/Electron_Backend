import jwt from 'jsonwebtoken';
import cloudinaryPkg from 'cloudinary';
import { config } from '../../config/config.js';
import VersionConfig from './versionSchema.js';

const { v2: cloudinary, utils: cloudinaryUtils } = cloudinaryPkg;

if (config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  });
}

const DEFAULT_VERSION_DATA = {
  key: 'default',
  version: '1.2.0',
  url: 'https://www.dropbox.com/scl/fi/42gj17a24f2wgm1ie3nxl/electron.exe?rlkey=798i6xnpza1oai8e9fxkqopfg&st=dqfk33yz&dl=1',
  status: 'success',
  changeLog: 'Added Version Update',
};

const COOKIE_MAX_AGE = 1000 * 60 * 60 * 12;
const VERSION_UPLOAD_FOLDER = 'electron-backend-updates';

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.env === 'production',
  maxAge: COOKIE_MAX_AGE,
  path: '/',
});

const getVersionRecord = async (activationKey = null) => {
  try {
    if (activationKey) {
      const rawKey = String(activationKey).trim().toUpperCase();
      const strippedKey = rawKey.replace(/[^A-Za-z0-9]/g, '');

      const targetedRecord = await VersionConfig.findOne({
        targetKeys: { $in: [rawKey, strippedKey] },
        active: { $ne: false },
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (targetedRecord) {
        return {
          version: targetedRecord.version,
          url: targetedRecord.url,
          status: targetedRecord.status || 'success',
          changeLog: targetedRecord.changeLog,
          isTargeted: true,
        };
      }
    }

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
  } catch (error) {
    console.warn('⚠️ MongoDB query failed in getVersionRecord. Falling back to default data.', error.message);
    return {
      version: DEFAULT_VERSION_DATA.version,
      url: DEFAULT_VERSION_DATA.url,
      status: DEFAULT_VERSION_DATA.status || 'success',
      changeLog: DEFAULT_VERSION_DATA.changeLog,
    };
  }
};

const sanitizeFileName = (fileName) => {
  const safeName = String(fileName || 'electron-update.zip')
    .trim()
    .replace(/[^\w.\- ]+/g, '-')
    .replace(/\s+/g, '-');

  return safeName.toLowerCase().endsWith('.zip') ? safeName : `${safeName}.zip`;
};

const buildCloudinaryDownloadUrl = (secureUrl, fileName = '') => {
  if (!secureUrl) {
    return '';
  }

  if (secureUrl.includes('fl_attachment:')) {
    return secureUrl;
  }

  const derivedName = fileName || (() => {
    try {
      const url = new URL(secureUrl);
      return decodeURIComponent(url.pathname.split('/').pop() || 'electron-update.zip');
    } catch (error) {
      return 'electron-update.zip';
    }
  })();
  const safeName = sanitizeFileName(derivedName);
  const attachmentTransform = `fl_attachment:${encodeURIComponent(safeName)}`;

  if (secureUrl.includes('/upload/')) {
    return secureUrl.replace('/upload/', `/upload/${attachmentTransform}/`);
  }

  return secureUrl;
};

const isZipFile = (file) => {
  if (!file) {
    return false;
  }

  const lowerName = String(file.originalname || file.name || '').toLowerCase();
  return lowerName.endsWith('.zip');
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
  <link rel="icon" type="image/png" href="/updates/services/Envy.png" />
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      width: 100%;
      min-height: 100%;
    }
    body {
      background-color: var(--bg-dark);
      background-image: radial-gradient(rgba(123, 162, 219, 0.15) 1px, transparent 1px);
      background-size: 24px 24px;
      background-position: center top;
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      width: 100%;
      min-height: 100dvh;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .mountain-bg {
      position: absolute;
      bottom: -10%; left: -5%; width: 110%; height: 110%;
      background: url('https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=2000&auto=format&fit=crop') no-repeat center bottom;
      background-size: cover; opacity: 0.6; mix-blend-mode: screen;
      filter: grayscale(100%) sepia(30%) hue-rotate(185deg) brightness(1.1) contrast(1.4);
      z-index: 1; pointer-events: none;
    }
    .ascii-overlay {
      position: absolute; color: rgba(123, 162, 219, 0.3); font-family: 'JetBrains Mono', monospace;
      font-size: 10px; line-height: 12px; white-space: pre; z-index: 2; pointer-events: none;
    }
    .ascii-overlay.left { bottom: 15%; left: 5%; }
    .ascii-overlay.top-center { top: 5%; left: 45%; }
    .tech-frame {
      position: absolute;
      top: clamp(12px, 3vw, 30px);
      left: clamp(12px, 3vw, 30px);
      right: clamp(12px, 3vw, 30px);
      bottom: clamp(12px, 3vw, 30px);
      border: 1px solid var(--border-color);
      z-index: 10;
      pointer-events: none;
    }
    .crosshair {
      position: absolute; width: 20px; height: 20px; display: flex;
      align-items: center; justify-content: center; color: var(--accent-blue);
      font-family: 'JetBrains Mono', monospace; font-size: 18px;
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
      max-width: calc(100vw - 32px);
    }
    .ui-tags.tl { top: clamp(12px, 2.5vw, 24px); left: clamp(12px, 2.5vw, 24px); align-items: flex-start; }
    .ui-tags.tr { top: clamp(12px, 2.5vw, 24px); right: clamp(12px, 2.5vw, 24px); align-items: flex-end; }
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
      max-width: 100%;
      word-break: break-word;
    }
    .hero-content {
      position: relative;
      z-index: 30;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 16px;
      width: 100%;
      max-width: 100%;
    }
    .hero-title {
      font-size: clamp(56px, 15vw, 200px);
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--text-main);
      line-height: 0.9;
      margin-bottom: 20px;
      text-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      max-width: 100%;
      overflow-wrap: break-word;
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
      max-width: calc(100vw - 32px);
      width: auto;
      min-height: 44px;
    }
    .update-btn:hover {
      background-color: var(--accent-blue);
      color: #fff;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(123, 162, 219, 0.3);
    }
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
      padding: 16px;
      overflow-y: auto;
      box-sizing: border-box;
    }
    .modal-overlay.active { display: flex; opacity: 1; }
    .modal-content {
      background: var(--modal-bg);
      border: 1px solid var(--border-color);
      width: min(650px, 100%);
      padding: clamp(18px, 4vw, 30px);
      position: relative;
      transform: translateY(20px);
      transition: transform 0.3s ease;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    /* Hide scrollbar for Chrome, Safari and Opera */
    .modal-content::-webkit-scrollbar { display: none; }
    /* Hide scrollbar for IE, Edge and Firefox */
    .modal-content { -ms-overflow-style: none; scrollbar-width: none; }
    
    .modal-overlay.active .modal-content { transform: translateY(0); }
    .modal-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: var(--accent-blue);
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .modal-title::before { content: '>'; color: var(--accent-blue); }
    .form-group { margin-bottom: 16px; width: 100%; max-width: 100%; }
    .form-row {
      display: flex;
      gap: 16px;
      width: 100%;
    }
    .form-row .form-group { flex: 1; margin-bottom: 0; min-width: 0; }
    .form-row .form-group.version-field { flex: 0 0 150px; }
    .form-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 6px;
      letter-spacing: 0.05em;
    }
    .form-input {
      width: 100%;
      max-width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.3s ease;
      box-sizing: border-box;
    }
    .form-input:focus { border-color: var(--accent-blue); background: rgba(255, 255, 255, 0.08); }
    .form-textarea {
      min-height: 60px;
      resize: vertical;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    /* Side by side upload layout */
    .upload-split-container {
      display: flex;
      gap: 20px;
      align-items: stretch;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(123, 162, 219, 0.2);
      padding: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .upload-box {
      flex: 1;
      border: 1px dashed rgba(123, 162, 219, 0.45);
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 100px;
      min-width: 0;
    }
    .upload-box.dragover { border-color: var(--accent-blue); background: rgba(123, 162, 219, 0.12); }
    .upload-box-title { font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; }
    .upload-box-copy { font-size: 11px; color: var(--text-dim); }
    .upload-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
    .upload-file-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--accent-blue);
      word-break: break-all;
      margin-bottom: 8px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .upload-actions { display: flex; gap: 8px; margin-top: auto; }
    .mini-btn {
      padding: 8px 12px;
      font-size: 10px;
      flex: 1;
      text-align: center;
      min-height: 40px;
      box-sizing: border-box;
    }
    /* Progress bar styles */
    .progress-container {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;
      display: none;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: var(--success-green);
      transition: width 0.2s ease, background 0.2s ease;
    }
    .progress-text {
      font-size: 10px;
      color: var(--text-dim);
      margin-top: 4px;
      text-align: right;
      display: none;
      font-family: 'JetBrains Mono', monospace;
    }
    .download-link-row {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
    }
    .download-link-row .form-input { flex: 1; min-width: 0; }
    .download-link-row .btn { flex: 0 0 auto; }
    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      width: 100%;
    }
    
    .btn {
      padding: 12px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid transparent;
      display: inline-block;
      text-decoration: none;
      box-sizing: border-box;
      max-width: 100%;
      min-height: 44px;
    }
    .modal-actions .btn { flex: 1; }
    .btn-primary { background: var(--accent-blue); color: #000; }
    .btn-primary:hover { background: #9ab9e8; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: transparent; border-color: var(--border-color); color: var(--text-dim); }
    .btn-secondary:hover { border-color: var(--text-main); color: var(--text-main); }
    .status-msg { margin-top: 12px; font-size: 12px; display: none; }
    .status-msg.error { color: var(--error-red); display: block; }
    .status-msg.success { color: var(--success-green); display: block; }
    .modal-close {
      position: absolute;
      top: 16px;
      right: 20px;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 24px;
      line-height: 1;
      transition: color 0.2s ease;
    }
    .modal-close:hover { color: var(--text-main); }
    .current-info {
      position: absolute;
      bottom: clamp(16px, 3vw, 24px);
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      z-index: 20;
      flex-wrap: wrap;
      justify-content: center;
      max-width: calc(100% - 32px);
    }
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      margin-top: 10px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }
    .release-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      text-align: left;
    }
    .release-table th {
      background: rgba(123, 162, 219, 0.1);
      color: var(--accent-blue);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }
    .release-table td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(123, 162, 219, 0.1);
      color: var(--text-main);
      vertical-align: middle;
    }
    .release-table tr:last-child td {
      border-bottom: none;
    }
    .release-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .badge-global {
      background: rgba(74, 222, 128, 0.15);
      color: var(--success-green);
      border: 1px solid rgba(74, 222, 128, 0.3);
      padding: 2px 6px;
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      border-radius: 3px;
      white-space: nowrap;
    }
    .badge-targeted {
      background: rgba(123, 162, 219, 0.15);
      color: var(--accent-blue);
      border: 1px solid var(--border-color);
      padding: 2px 6px;
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      border-radius: 3px;
      word-break: break-all;
    }
    .action-btn-group {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .btn-edit {
      background: transparent;
      border: 1px solid var(--accent-blue);
      color: var(--accent-blue);
      padding: 4px 8px;
      font-size: 10px;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      border-radius: 3px;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-edit:hover {
      background: var(--accent-blue);
      color: #000;
    }
    .btn-danger {
      background: transparent;
      border: 1px solid var(--error-red);
      color: var(--error-red);
      padding: 4px 8px;
      font-size: 10px;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.2s ease;
      white-space: nowrap;
      border-radius: 3px;
    }
    .btn-danger:hover {
      background: var(--error-red);
      color: #fff;
    }
    .password-modal-content {
      width: min(400px, 100%);
    }

    /* ========== Responsive breakpoints ========== */
    @media (max-width: 700px) {
      .form-row {
        flex-direction: column;
        gap: 16px;
      }
      .form-row .form-group.version-field {
        flex: 1 1 auto;
        width: 100%;
      }
    }

    @media (max-width: 650px) {
      .upload-split-container {
        flex-direction: column;
        gap: 12px;
      }
      .upload-box {
        min-height: 120px;
        width: 100%;
      }
      .upload-details {
        width: 100%;
      }
    }

    @media (max-width: 600px) {
      .modal-content {
        padding: 20px;
      }
      .form-row {
        flex-direction: column;
        gap: 12px;
      }
      .form-row .version-field {
        flex: 1 1 auto !important;
      }
      .upload-split-container {
        flex-direction: column;
        gap: 12px;
      }
      .upload-box {
        min-height: 80px;
        padding: 14px 10px;
      }
      .ui-tags.tr {
        display: none;
      }
      .tag {
        font-size: 9px;
        padding: 3px 6px;
      }
      .current-info {
        gap: 8px;
        position: relative;
        bottom: auto;
        left: auto;
        transform: none;
        margin-top: 24px;
        margin-bottom: 16px;
      }
      .download-link-row {
        flex-direction: column;
        align-items: stretch;
      }
      .download-link-row .btn {
        width: 100%;
      }
      .modal-actions {
        flex-wrap: wrap;
      }
      .modal-actions .btn {
        min-width: 0;
      }
    }

    @media (max-width: 480px) {
      .modal-overlay {
        padding: 10px;
      }
      .modal-content {
        max-height: calc(100dvh - 20px);
        padding: 16px;
      }
      .hero-title {
        font-size: clamp(48px, 18vw, 120px);
      }
      .update-btn {
        padding: 12px 24px;
        font-size: 13px;
        width: 100%;
        max-width: calc(100vw - 48px);
      }
      .upload-actions {
        flex-direction: column;
      }
      .upload-actions .mini-btn {
        width: 100%;
        min-height: 44px;
      }
      .modal-actions {
        flex-direction: column;
      }
      .modal-actions .btn {
        width: 100%;
      }
      .ascii-overlay {
        display: none;
      }
    }

    @media (max-width: 360px) {
      .tag {
        font-size: 8px;
        padding: 2px 5px;
      }
      .modal-title {
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="mountain-bg"></div>
  <div class="ascii-overlay left">::#\n:####:\n:######:\n:########:\n:##########:\n:#::::::::::#:\n:############:</div>
  <div class="ascii-overlay top-center">.::.\n:####:\n::####::\n:########:\n::::::::::</div>
  <div class="tech-frame">
    <div class="crosshair tl">+</div><div class="crosshair tr">+</div>
    <div class="crosshair bl">+</div><div class="crosshair br">+</div>
    <div class="ui-tags tl">
      <div class="tag">System Status: Online</div><div class="tag">Security: Encrypted</div>
    </div>
    <div class="ui-tags tr">
      <div class="tag">Envy Core v${currentData.version}</div><div class="tag">Admin Panel</div>
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
  <div class="modal-overlay" id="passwordModal">
    <div class="modal-content password-modal-content">
      <div class="modal-close" onclick="closeModal('passwordModal')">&times;</div>
      <div class="modal-title">Authentication Required</div>
      <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 20px;">Please enter the administrator password to access version control.</p>
      
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
  <div class="modal-overlay" id="updateModal">
    <div class="modal-content">
      <div class="modal-close" onclick="closeModal('updateModal')">&times;</div>
      <div class="modal-title">Version Control</div>
      
      <input type="hidden" id="ruleId" value="">

      <div class="form-row">
        <div class="form-group version-field">
          <label class="form-label">New Version</label>
          <input type="text" id="newVersion" class="form-input" value="${currentData.version}">
        </div>
        <div class="form-group">
          <label class="form-label">Direct App Link (Optional)</label>
          <input type="text" id="downloadUrl" class="form-input" value="${currentData.url}">
        </div>
      </div>
      <div class="form-group" style="margin-top: 8px;">
        <label class="form-label">Upload ZIP Release</label>
        <input type="file" id="zipFileInput" accept=".zip,application/zip" hidden>
        
        <div class="upload-split-container">
          <div id="uploadBox" class="upload-box" role="button" tabindex="0">
            <div class="upload-box-title">Drop ZIP here</div>
            <div class="upload-box-copy">or click to browse</div>
          </div>
          
          <div class="upload-details">
            <div id="selectedFileName" class="upload-file-name">No file selected</div>
            
            <div class="progress-container" id="progressContainer">
              <div class="progress-bar-fill" id="progressBar"></div>
            </div>
            <div class="progress-text" id="progressText">0%</div>
            <div class="upload-actions">
              <button type="button" class="btn btn-secondary mini-btn" id="browseZipBtn">Browse</button>
              <button type="button" class="btn btn-primary mini-btn" id="uploadZipBtn">Upload</button>
            </div>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Auto-Download Link</label>
        <div class="download-link-row">
          <input type="text" id="generatedDownloadUrl" class="form-input" value="${currentData.url}" readonly>
          <button type="button" class="btn btn-secondary mini-btn" id="copyDownloadUrlBtn">Copy</button>
          <a id="openDownloadLink" class="btn btn-primary mini-btn" href="${currentData.url}" target="_blank" rel="noopener noreferrer">Test URL</a>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Target Activation Keys (Optional)</label>
        <input type="text" id="targetKeys" class="form-input" placeholder="e.g. 3CKG-CXBR-T7AT-GADM, 4XYZ-8899-AAAA-BBBB (Leave blank for Global Release)">
      </div>
      <div class="form-group">
        <label class="form-label">Change Log</label>
        <textarea id="changeLog" class="form-input form-textarea">${currentData.changeLog}</textarea>
      </div>
      <div id="updateStatus" class="status-msg"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="resetReleaseForm()">Reset Form</button>
        <button class="btn btn-primary" id="submitUpdate">Apply Update</button>
      </div>
      <div class="targeted-list-container">
        <div class="targeted-list-title">
          <span>Release Entries Management Table</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 10px; color: var(--text-dim);" id="targetedCount">0 Entries</span>
            <button type="button" class="btn btn-secondary mini-btn" style="min-height: 28px; padding: 4px 8px;" onclick="resetReleaseForm()">+ New Release</button>
          </div>
        </div>
        
        <div class="table-responsive">
          <table class="release-table">
            <thead>
              <tr>
                <th>Scope / Key(s)</th>
                <th>Version</th>
                <th>Download Link / File</th>
                <th>Changelog</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="releasesTableBody">
              <tr>
                <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 16px;">Loading releases table...</td>
              </tr>
            </tbody>
          </table>
        </div>
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
    const downloadUrlInput = document.getElementById('downloadUrl');
    const zipFileInput = document.getElementById('zipFileInput');
    const uploadBox = document.getElementById('uploadBox');
    const browseZipBtn = document.getElementById('browseZipBtn');
    const uploadZipBtn = document.getElementById('uploadZipBtn');
    const selectedFileName = document.getElementById('selectedFileName');
    
    // Progress bar elements
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const generatedDownloadUrl = document.getElementById('generatedDownloadUrl');
    const copyDownloadUrlBtn = document.getElementById('copyDownloadUrlBtn');
    const openDownloadLink = document.getElementById('openDownloadLink');
    let selectedZipFile = null;
    let allReleases = [];

    openUpdateBtn.addEventListener('click', () => {
      adminPasswordInput.value = '';
      passwordError.classList.remove('error');
      openModal('passwordModal');
      setTimeout(() => adminPasswordInput.focus(), 100);
    });
    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
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
          loadReleasesTable();
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
    function setStatus(message, type = 'error') {
      updateStatus.innerText = message;
      updateStatus.className = 'status-msg ' + type;
    }
    function updateSelectedFile(file) {
      selectedZipFile = file || null;
      selectedFileName.innerText = selectedZipFile ? selectedZipFile.name : 'No file selected';
      
      // Reset progress bar on new file selection
      progressContainer.style.display = 'none';
      progressText.style.display = 'none';
      progressBar.style.width = '0%';
      progressBar.style.backgroundColor = 'var(--accent-blue)';
    }
    function isZipFile(file) { return file && file.name && file.name.toLowerCase().endsWith('.zip'); }
    browseZipBtn.addEventListener('click', () => zipFileInput.click());
    uploadBox.addEventListener('click', () => zipFileInput.click());
    downloadUrlInput.addEventListener('input', () => {
      generatedDownloadUrl.value = downloadUrlInput.value;
      openDownloadLink.href = downloadUrlInput.value;
    });
    uploadBox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); zipFileInput.click();
      }
    });
    zipFileInput.addEventListener('change', () => {
      const file = zipFileInput.files && zipFileInput.files[0];
      if (!file) return updateSelectedFile(null);
      if (!isZipFile(file)) {
        setStatus('Please select a .zip file.', 'error');
        zipFileInput.value = ''; updateSelectedFile(null); return;
      }
      setStatus('ZIP selected and ready to upload.', 'success');
      updateSelectedFile(file);
    });
    uploadBox.addEventListener('dragover', (event) => {
      event.preventDefault(); uploadBox.classList.add('dragover');
    });
    uploadBox.addEventListener('dragleave', () => {
      uploadBox.classList.remove('dragover');
    });
    uploadBox.addEventListener('drop', (event) => {
      event.preventDefault(); uploadBox.classList.remove('dragover');
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      if (!isZipFile(file)) { setStatus('Only .zip files are supported.', 'error'); return; }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      zipFileInput.files = transfer.files;
      updateSelectedFile(file);
      setStatus('ZIP selected and ready to upload.', 'success');
    });
    async function uploadZipToCloudinary(file) {
      // 1. Get Signature via fetch
      const signatureResponse = await fetch('/api/version/admin/upload-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const signatureData = await signatureResponse.json();
      if (!signatureResponse.ok) {
        throw new Error(signatureData.message || 'Could not prepare upload.');
      }
      const uploadUrl = 'https://api.cloudinary.com/v1_1/' + signatureData.cloudName + '/raw/upload';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureData.apiKey);
      formData.append('timestamp', signatureData.timestamp);
      formData.append('signature', signatureData.signature);
      formData.append('folder', signatureData.folder);
      formData.append('public_id', signatureData.publicId);
      formData.append('overwrite', 'true');
      // 2. Upload via XHR to track progress
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        // Display progress bar UI
        progressContainer.style.display = 'block';
        progressText.style.display = 'block';
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressText.innerText = percentComplete + '%';
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const uploadData = JSON.parse(xhr.responseText);
            const downloadUrl = uploadData.secure_url.includes('/upload/')
              ? uploadData.secure_url.replace('/upload/', '/upload/fl_attachment:' + encodeURIComponent(file.name) + '/')
              : uploadData.secure_url;
            generatedDownloadUrl.value = downloadUrl;
            downloadUrlInput.value = downloadUrl;
            openDownloadLink.href = downloadUrl;
            progressBar.style.backgroundColor = 'var(--success-green)';
            progressText.innerText = 'Upload Complete';
            
            resolve({ downloadUrl, assetId: uploadData.public_id, fileName: file.name });
          } else {
            let errorMessage = 'ZIP upload failed.';
            try {
              const errorObj = JSON.parse(xhr.responseText);
              errorMessage = errorObj.error?.message || errorMessage;
            } catch(e) {}
            
            progressBar.style.backgroundColor = 'var(--error-red)';
            reject(new Error(errorMessage));
          }
        };
        xhr.onerror = () => {
          progressBar.style.backgroundColor = 'var(--error-red)';
          reject(new Error('Network error during upload.'));
        };
        xhr.send(formData);
      });
    }
    uploadZipBtn.addEventListener('click', async () => {
      if (!selectedZipFile) { setStatus('Choose a ZIP file first.', 'error'); return; }
      uploadZipBtn.innerText = 'Uploading...';
      uploadZipBtn.disabled = true;
      browseZipBtn.disabled = true;
      setStatus('Uploading ZIP and generating a download link...', 'success');
      try {
        const result = await uploadZipToCloudinary(selectedZipFile);
        setStatus('Download link created for ' + result.fileName + '.', 'success');
      } catch (error) {
        setStatus(error.message || 'Upload failed.', 'error');
      } finally {
        uploadZipBtn.innerText = 'Upload';
        uploadZipBtn.disabled = false;
        browseZipBtn.disabled = false;
      }
    });
    copyDownloadUrlBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(generatedDownloadUrl.value);
        copyDownloadUrlBtn.innerText = 'Copied!';
        setTimeout(() => { copyDownloadUrlBtn.innerText = 'Copy'; }, 1500);
      } catch (error) { setStatus('Could not copy the download link.', 'error'); }
    });
    async function loadReleasesTable() {
      const tbody = document.getElementById('releasesTableBody');
      const countEl = document.getElementById('targetedCount');
      if (!tbody) return;
      try {
        const res = await fetch('/api/version/admin/targeted');
        if (!res.ok) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error-red);">Failed to load release entries.</td></tr>';
          return;
        }
        allReleases = await res.json();
        if (countEl) countEl.innerText = (allReleases.length || 0) + ' Release(s)';
        if (!allReleases || allReleases.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); font-style: italic; padding: 16px;">No release entries found.</td></tr>';
          return;
        }
        tbody.innerHTML = allReleases.map((item) => {
          const isGlobal = item.key === 'default';
          const scopeBadge = isGlobal
            ? '<span class="badge-global">GLOBAL DEFAULT</span>'
            : \`<span class="badge-targeted">🔑 \${Array.isArray(item.targetKeys) ? item.targetKeys.join(', ') : (item.targetKeys || 'Key Specific')}</span>\`;
          const rawUrl = item.url || '';
          const truncatedUrl = rawUrl.length > 30 ? rawUrl.substring(0, 30) + '...' : rawUrl;
          return \`<tr>
              <td>\${scopeBadge}</td>
              <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--success-green);">v\${item.version}</td>
              <td>
                <a href="\${rawUrl}" target="_blank" style="color: var(--accent-blue); text-decoration: none;" title="\${rawUrl}">
                  \${truncatedUrl}
                </a>
              </td>
              <td style="max-width: 180px; white-space: pre-wrap; font-size: 11px; color: var(--text-dim);">\${item.changeLog || '-'}</td>
              <td>
                <div class="action-btn-group">
                  <button type="button" class="btn-edit" onclick="editReleaseRule('\${item._id}')">Edit</button>
                  \${!isGlobal ? \`<button type="button" class="btn-danger" onclick="deleteReleaseRule('\${item._id}')">Delete</button>\` : ''}
                </div>
              </td>
            </tr>\`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error-red);">Error loading release entries.</td></tr>';
      }
    }
    function editReleaseRule(id) {
      const item = allReleases.find(r => r._id === id);
      if (!item) return;
      document.getElementById('ruleId').value = item._id;
      document.getElementById('newVersion').value = item.version;
      document.getElementById('downloadUrl').value = item.url;
      document.getElementById('generatedDownloadUrl').value = item.url;
      document.getElementById('openDownloadLink').href = item.url;
      document.getElementById('changeLog').value = item.changeLog || '';
      if (item.key === 'default') {
        document.getElementById('targetKeys').value = '';
        submitUpdateBtn.innerText = 'Save Global Release (v' + item.version + ')';
      } else {
        document.getElementById('targetKeys').value = Array.isArray(item.targetKeys) ? item.targetKeys.join(', ') : (item.targetKeys || '');
        submitUpdateBtn.innerText = 'Save Key Release (v' + item.version + ')';
      }
      setStatus('Editing release entry. Upload new ZIP or change values and click Save.', 'success');
      document.querySelector('.modal-content').scrollTo({ top: 0, behavior: 'smooth' });
    }
    function resetReleaseForm() {
      document.getElementById('ruleId').value = '';
      document.getElementById('targetKeys').value = '';
      submitUpdateBtn.innerText = 'Apply Update';
      setStatus('Form ready for new key or global release.', 'success');
    }
    async function deleteReleaseRule(id) {
      if (!confirm('Are you sure you want to delete this targeted key release rule? Key(s) will revert to receiving the Global Release.')) return;
      try {
        const res = await fetch('/api/version/admin/targeted/' + id, { method: 'DELETE' });
        if (res.ok) {
          setStatus('Release rule deleted successfully.', 'success');
          loadReleasesTable();
        } else {
          setStatus('Failed to delete release rule.', 'error');
        }
      } catch (err) {
        setStatus('Network error when deleting release rule.', 'error');
      }
    }
    window.editReleaseRule = editReleaseRule;
    window.resetReleaseForm = resetReleaseForm;
    window.deleteReleaseRule = deleteReleaseRule;
    async function handleUpdate() {
      const data = {
        ruleId: document.getElementById('ruleId').value,
        version: document.getElementById('newVersion').value,
        url: downloadUrlInput.value,
        changeLog: document.getElementById('changeLog').value,
        targetKeys: document.getElementById('targetKeys').value
      };
      if (!data.version || !data.url || !data.changeLog) {
        setStatus('All fields except target keys are required.', 'error'); return;
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
          setStatus('Release updated successfully.', 'success');
          resetReleaseForm();
          loadReleasesTable();
        } else {
          setStatus(result.message || 'Update failed.', 'error');
        }
      } catch (err) {
        setStatus('Network error. Update failed.', 'error');
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
    const activationKey = req.query.key || req.headers['x-activation-key'] || req.body?.key;
    const versionData = await getVersionRecord(activationKey);
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

export const getUploadSignature = (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    return res.status(500).json({
      message: 'Cloudinary credentials are not configured.',
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${Date.now()}`;
  const paramsToSign = {
    timestamp,
    folder: VERSION_UPLOAD_FOLDER,
    public_id: publicId,
    overwrite: 'true',
  };

  const signature = cloudinaryUtils.api_sign_request(paramsToSign, config.cloudinaryApiSecret);

  return res.status(200).json({
    apiKey: config.cloudinaryApiKey,
    cloudName: config.cloudinaryCloudName,
    folder: VERSION_UPLOAD_FOLDER,
    publicId,
    signature,
    timestamp,
  });
};

export const updateVersion = async (req, res, next) => {
  try {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const { ruleId, version, url, changeLog, targetKeys } = req.body ?? {};

    if (!version || !url || !changeLog) {
      return res.status(400).json({ message: 'version, url, and changeLog are required.' });
    }

    const resolvedUrl = String(url).includes('cloudinary.com')
      ? buildCloudinaryDownloadUrl(String(url).trim())
      : String(url).trim();

    let rawKeys = [];
    if (Array.isArray(targetKeys)) {
      rawKeys = targetKeys;
    } else if (typeof targetKeys === 'string' && targetKeys.trim().length > 0) {
      rawKeys = targetKeys.split(',').map((k) => k.trim());
    }

    const formattedTargetKeys = rawKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean);

    // 1. If updating an existing rule by ID
    if (ruleId) {
      const updated = await VersionConfig.findByIdAndUpdate(
        ruleId,
        {
          version: String(version).trim(),
          url: resolvedUrl,
          changeLog: String(changeLog).trim(),
          targetKeys: formattedTargetKeys,
          active: true,
        },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ message: 'Release rule not found.' });
      }

      return res.status(200).json({
        message: 'Release rule updated successfully.',
        id: updated._id,
        version: updated.version,
        url: updated.url,
        changeLog: updated.changeLog,
        targetKeys: updated.targetKeys,
      });
    }

    // 2. If targetKeys specified, create targeted key release
    if (formattedTargetKeys.length > 0) {
      const uniqueKey = `targeted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const created = await VersionConfig.create({
        key: uniqueKey,
        version: String(version).trim(),
        url: resolvedUrl,
        changeLog: String(changeLog).trim(),
        targetKeys: formattedTargetKeys,
        status: 'success',
        active: true,
      });

      return res.status(200).json({
        message: `Targeted update created successfully for key(s): ${formattedTargetKeys.join(', ')}`,
        id: created._id,
        version: created.version,
        url: created.url,
        changeLog: created.changeLog,
        targetKeys: created.targetKeys,
        isTargeted: true,
      });
    }

    // 3. Otherwise update default release
    const updated = await VersionConfig.findOneAndUpdate(
      { key: 'default' },
      {
        key: 'default',
        version: String(version).trim(),
        url: resolvedUrl,
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
      message: 'Global version updated successfully.',
      version: updated.version,
      url: updated.url,
      status: updated.status,
      changeLog: updated.changeLog,
    });
  } catch (error) {
    next(error);
  }
};

export const getTargetedVersions = async (req, res, next) => {
  try {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }
    // Return all records (default first, then targeted entries by creation date)
    const allRules = await VersionConfig.find({}).sort({ key: 1, createdAt: -1 }).lean();
    return res.status(200).json(allRules);
  } catch (error) {
    next(error);
  }
};

export const deleteTargetedVersion = async (req, res, next) => {
  try {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }
    const { id } = req.params;
    await VersionConfig.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Release rule deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
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

const getVersionRecord = async (activationKey = null, clientPlatform = 'all') => {
  const normPlatform = String(clientPlatform || 'all').toLowerCase().trim();
  const platform = normPlatform === 'win32' ? 'windows' : normPlatform;

  try {
    // 1. If key provided, check targeted key rule for requested platform or universal
    if (activationKey) {
      const rawKey = String(activationKey).trim().toUpperCase();
      const strippedKey = rawKey.replace(/[^A-Za-z0-9]/g, '');

      const targetedRecord = await VersionConfig.findOne({
        targetKeys: { $in: [rawKey, strippedKey] },
        active: { $ne: false },
        $or: [{ platform }, { platform: 'all' }, { platform: {$exists: false } }],
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (targetedRecord) {
        return {
          version: targetedRecord.version,
          url: targetedRecord.url,
          platform: targetedRecord.platform || 'all',
          status: targetedRecord.status || 'success',
          changeLog: targetedRecord.changeLog,
          isTargeted: true,
        };
      }
    }

    // 2. Check platform-specific release rule (e.g. platform: 'android' or 'windows')
    if (platform !== 'all') {
      const platformRecord = await VersionConfig.findOne({
        $or: [{ platform }, { key: platform }],
        active: { $ne: false },
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (platformRecord) {
        return {
          version: platformRecord.version,
          url: platformRecord.url,
          platform: platformRecord.platform || platform,
          status: platformRecord.status || 'success',
          changeLog: platformRecord.changeLog,
        };
      }
    }

    // 3. Fallback to default release rule
    let versionRecord = await VersionConfig.findOne({ key: 'default' }).lean();

    if (!versionRecord) {
      const created = await VersionConfig.create(DEFAULT_VERSION_DATA);
      versionRecord = created.toObject();
    }

    return {
      version: versionRecord.version,
      url: versionRecord.url,
      platform: versionRecord.platform || 'all',
      status: versionRecord.status || 'success',
      changeLog: versionRecord.changeLog,
    };
  } catch (error) {
    console.warn('⚠️ MongoDB query failed in getVersionRecord. Falling back to default data.', error.message);
    return {
      version: DEFAULT_VERSION_DATA.version,
      url: DEFAULT_VERSION_DATA.url,
      platform: 'all',
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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  <title>Envy ERP | Version Control</title>
  <link rel="icon" type="image/png" href="/updates/services/Envy.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent-blue: #60a5fa;
      --bg-dark: #16161b;
      --bg-surface: #24242d;
      --bg-input: #16161b;
      --accent-primary: #daf4aa;
      --accent-hover: #cbe699;
      --border-color: rgba(255, 255, 255, 0.1);
      --border-focus: rgba(218, 244, 170, 0.4);
      --text-main: #ffffff;
      --text-dim: #9ca3af;
      --error-red: #f87171;
      --success-green: #34d399;
      --warning-amber: #fbbf24;
      --modal-bg: #24242d;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { width: 100%; min-height: 100%; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Poppins', sans-serif;
      width: 100%;
      min-height: 100dvh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    /* Background Orbs */
    .bg-orb-1 {
      position: absolute; top: -10%; left: -10%; width: 400px; height: 400px;
      background: rgba(218, 244, 170, 0.05); border-radius: 50%; filter: blur(100px); pointer-events: none; z-index: 1;
    }
    .bg-orb-2 {
      position: absolute; bottom: -10%; right: -10%; width: 500px; height: 500px;
      background: rgba(99, 102, 241, 0.05); border-radius: 50%; filter: blur(100px); pointer-events: none; z-index: 1;
    }

    .ui-tags {
      position: absolute; display: flex; flex-direction: column; gap: 8px; z-index: 20; max-width: calc(100vw - 32px);
    }
    .ui-tags.tl { top: clamp(16px, 3vw, 32px); left: clamp(16px, 3vw, 32px); align-items: flex-start; }
    .ui-tags.tr { top: clamp(16px, 3vw, 32px); right: clamp(16px, 3vw, 32px); align-items: flex-end; }
    .tag {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-dim);
      font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 6px 12px;
      letter-spacing: 0.05em; border-radius: 8px; backdrop-filter: blur(10px);
    }
    
    .hero-content {
      position: relative; z-index: 30; text-align: center; display: flex; flex-direction: column; align-items: center; padding: 0 16px; width: 100%; max-width: 100%;
    }
    .hero-title {
      font-size: clamp(48px, 12vw, 150px); font-weight: 300; letter-spacing: -0.04em; color: var(--text-main); line-height: 0.9; margin-bottom: 24px;
    }
    .hero-subtitle {
      font-size: 16px; color: var(--text-dim); margin-bottom: 32px; font-weight: 400; letter-spacing: 0.5px; text-transform: uppercase;
    }

    .update-btn {
      background-color: var(--accent-primary); color: #16161b; border: none; padding: 14px 40px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; transition: all 0.3s ease; border-radius: 12px; font-family: 'Poppins', sans-serif; box-shadow: 0 4px 14px rgba(218, 244, 170, 0.15);
    }
    .update-btn:hover {
      background-color: var(--accent-hover); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(218, 244, 170, 0.25);
    }

    /* Modals */
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); z-index: 100; display: none; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; padding: 16px; overflow-y: auto; box-sizing: border-box;
    }
    .modal-overlay.active { display: flex; opacity: 1; }
    
    .modal-content {
      background: var(--bg-surface); border: 1px solid var(--border-color); width: min(1200px, 95%); padding: clamp(24px, 4vw, 40px); border-radius: 24px; position: relative; transform: translateY(20px); transition: transform 0.3s ease; max-height: calc(100dvh - 32px); overflow-y: auto; overflow-x: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .modal-content.small-modal { width: min(450px, 95%); }
    .modal-overlay.active .modal-content { transform: translateY(0); }
    
    /* Scrollbar */
    .modal-content::-webkit-scrollbar { width: 6px; height: 6px; }
    .modal-content::-webkit-scrollbar-track { background: transparent; }
    .modal-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
    .modal-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

    .modal-title {
      font-size: 24px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; letter-spacing: -0.5px; display: flex; align-items: center; gap: 12px;
    }
    .modal-subtitle { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; }
    
    .modal-close {
      position: absolute; top: 24px; right: 24px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-dim); border-radius: 50%; cursor: pointer; font-size: 18px; transition: all 0.2s ease;
    }
    .modal-close:hover { color: var(--text-main); background: rgba(255,255,255,0.1); }

    /* Forms */
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .form-group { width: 100%; display: flex; flex-direction: column; }
    .form-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; letter-spacing: 0.5px; }
    
    .form-input {
      width: 100%; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 16px; color: #fff; font-family: 'Poppins', sans-serif; font-size: 13px; outline: none; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-input:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(218, 244, 170, 0.1); }
    .form-input::placeholder { color: #6b7280; }
    
    .form-textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
    
    select.form-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5l3 3 3-3'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; padding-right: 40px; cursor: pointer; }

    /* Upload Box */
    .upload-split-container { display: flex; gap: 20px; align-items: stretch; background: var(--bg-input); border: 1px dashed rgba(255,255,255,0.2); border-radius: 16px; padding: 20px; width: 100%; transition: all 0.3s ease; }
    .upload-box { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; min-height: 120px; border-radius: 12px; padding: 20px; transition: all 0.2s ease; }
    .upload-box:hover { background: rgba(255,255,255,0.02); }
    .upload-box.dragover { border-color: var(--accent-primary); background: rgba(218, 244, 170, 0.05); }
    
    .upload-icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; color: var(--text-dim); }
    .upload-box-title { font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; }
    .upload-box-copy { font-size: 12px; color: var(--text-dim); }
    
    .upload-details { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
    .upload-file-name { font-size: 13px; font-weight: 600; color: var(--text-main); word-break: break-all; margin-bottom: 12px; }
    .upload-actions { display: flex; gap: 12px; margin-top: auto; }

    /* Progress bar */
    .progress-container { width: 100%; height: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden; margin-bottom: 8px; display: none; }
    .progress-bar-fill { height: 100%; width: 0%; background: var(--accent-primary); transition: width 0.2s ease; border-radius: 4px; }
    .progress-text { font-size: 11px; font-weight: 600; color: var(--accent-primary); text-align: right; display: none; }

    .download-link-row { display: flex; gap: 12px; align-items: stretch; width: 100%; }
    .download-link-row .form-input { flex: 1; min-width: 0; }
    
    /* Buttons */
    .modal-actions { display: flex; gap: 16px; margin-top: 32px; width: 100%; border-top: 1px solid var(--border-color); padding-top: 24px; justify-content: flex-end; }
    .btn { padding: 12px 24px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s ease; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border: 1px solid transparent; height: 46px; font-family: 'Poppins', sans-serif; gap: 8px; }
    .btn-primary { background: var(--accent-primary); color: #16161b; box-shadow: 0 4px 14px rgba(218, 244, 170, 0.15); }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(218, 244, 170, 0.25); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }\n    #submitPassword { position: relative; z-index: 5; pointer-events: auto; }
    .btn-secondary { background: var(--bg-input); border-color: var(--border-color); color: var(--text-main); }
    .btn-secondary:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); }
    .btn-danger { background: rgba(248, 113, 113, 0.1); color: var(--error-red); border-color: rgba(248, 113, 113, 0.2); }
    .btn-danger:hover { background: rgba(248, 113, 113, 0.2); }
    .btn-sm { height: 38px; padding: 8px 16px; font-size: 11px; }

    .status-msg { margin-top: 16px; font-size: 13px; padding: 12px 16px; border-radius: 12px; font-weight: 500; display: none; }
    .status-msg.error { background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.2); color: var(--error-red); display: block; }
    .status-msg.success { background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.2); color: var(--success-green); display: block; }
    
    .current-info { position: absolute; bottom: 32px; display: flex; gap: 16px; z-index: 20; flex-wrap: wrap; justify-content: center; }

    /* Data Table */
    .targeted-list-container { margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px; }
    .targeted-list-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .targeted-list-title h4 { font-size: 16px; color: var(--text-main); font-weight: 600; }
    
    .table-responsive { width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 16px; background: var(--bg-input); }
    .release-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; min-width: 800px; }
    .release-table th { background: var(--bg-surface); color: var(--text-dim); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 16px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    .release-table td { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-main); vertical-align: middle; }
    .release-table tr:last-child td { border-bottom: none; }
    .release-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
    
    .badge-global { background: rgba(52, 211, 153, 0.1); color: var(--success-green); border: 1px solid rgba(52, 211, 153, 0.2); padding: 4px 8px; font-size: 10px; font-weight: 700; border-radius: 6px; white-space: nowrap; }
    .badge-targeted { background: rgba(96, 165, 250, 0.1); color: var(--accent-blue); border: 1px solid rgba(96, 165, 250, 0.2); padding: 4px 8px; font-size: 10px; font-weight: 700; border-radius: 6px; word-break: break-all; }
    .badge-platform { background: rgba(255, 255, 255, 0.05); color: var(--text-main); border: 1px solid var(--border-color); padding: 4px 8px; font-size: 10px; font-weight: 600; border-radius: 6px; white-space: nowrap; }
    
    .action-btn-group { display: flex; gap: 8px; align-items: center; }

    /* Responsive */
    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; gap: 16px; }
      .upload-split-container { flex-direction: column; }
      .upload-box { min-height: 100px; padding: 16px; }
      .download-link-row { flex-direction: column; }
      .download-link-row .btn { width: 100%; }
      .modal-actions { flex-direction: column-reverse; gap: 12px; }
      .modal-actions .btn { width: 100%; }
    }
    
    @media (max-width: 480px) {
      .modal-overlay { padding: 8px; }
      .modal-content { padding: 20px; border-radius: 20px; }
      .hero-title { font-size: clamp(40px, 15vw, 80px); }
      .ui-tags { display: none; }
      .current-info { position: static; margin-top: 32px; width: 100%; }
      .update-btn { width: 100%; max-width: calc(100vw - 32px); }
    }
  
    body.modal-open { overflow: hidden; }
    #passwordError { width: 100%; box-sizing: border-box; margin: 10px 0 16px; padding: 11px 14px; border-radius: 10px; font-size: 12px; line-height: 1.4; color: #ff8f8f; background: rgba(255,70,70,.10); border: 1px solid rgba(255,70,70,.25); }
    #passwordError:empty { display: none !important; }
    .input-error { border-color: #ff5757 !important; box-shadow: 0 0 0 3px rgba(255,87,87,.12) !important; animation: inputShake .35s ease; }
    @keyframes inputShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    #submitPassword { position: relative; z-index: 100001; pointer-events: auto; cursor: pointer; }
    #submitPassword:disabled { cursor: wait; opacity: .65; }
    @media (max-width: 600px) { .modal-overlay { align-items: flex-start; padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)); } .modal-content { width: 100%; max-width: 100%; max-height: calc(100dvh - 32px); padding: 20px; border-radius: 18px; } .modal-content.small-modal { width: 100%; max-width: 100%; } .modal-actions { width: 100%; flex-direction: column-reverse; gap: 10px; } .modal-actions .btn { width: 100%; min-height: 46px; } .form-input { min-height: 46px; font-size: 14px; } }
  </style>
</head>
<body>
  <!-- Background Orbs -->
  <div class="bg-orb-1"></div>
  <div class="bg-orb-2"></div>

  <div class="ui-tags tl">
    <div class="tag">System: Online</div>
    <div class="tag">Security: Encrypted</div>
  </div>
  <div class="ui-tags tr">
    <div class="tag" style="color: var(--success-green); border-color: rgba(52,211,153,0.3);">Envy Core v${currentData.version}</div>
    <div class="tag">Admin Panel</div>
  </div>

  <main class="hero-content">
    <h1 class="hero-title">ENVY ERP</h1> 
    <p class="hero-subtitle">Distribution & Version Management Console</p>
    <button class="update-btn" id="openUpdateBtn">Manage Releases</button>
  </main>
  
  <div class="current-info">
    <div class="tag">Current Global: v${currentData.version}</div>
    <div class="tag">System Date: ${new Date().toLocaleDateString()}</div>
  </div>

  <!-- PASSWORD MODAL -->
  <div class="modal-overlay" id="passwordModal">
    <div class="modal-content small-modal">
      <button type="button" class="modal-close" id="closePasswordModal" aria-label="Close">&times;</button>
      <div class="modal-title">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        Authentication
      </div>
      <p class="modal-subtitle">Enter the administrator password to access version control.</p>
      
      <div class="form-group">
        <input type="password" id="adminPassword" class="form-input" placeholder="••••••••" style="text-align: center; letter-spacing: 0.2em; font-size: 16px;" autofocus>
      </div>
      <div id="passwordError" class="status-msg error" style="display: none;">Invalid password. Access denied.</div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="cancelPasswordBtn">Cancel</button>
        <button type="button" class="btn btn-primary" id="submitPassword">Verify Access</button>
      </div>
    </div>
  </div>

  <!-- MAIN UPDATE MODAL -->
  <div class="modal-overlay" id="updateModal">
    <div class="modal-content">
      <button type="button" class="modal-close" id="closeUpdateModal" aria-label="Close">&times;</button>
      <div class="modal-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        Release Management
      </div>
      <p class="modal-subtitle">Upload new builds, manage platform releases, and configure targeted updates.</p>
      
      <input type="hidden" id="ruleId" value="">

      <!-- Grid Layout for Form -->
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Version Number</label>
          <input type="text" id="newVersion" class="form-input" placeholder="e.g., 1.2.0" value="${escapeHtml(currentData.version)}">
        </div>
        
        <div class="form-group">
          <label class="form-label">Target Platform</label>
          <select id="targetPlatform" class="form-input">
            <option value="all">🌐 All Platforms (Universal Release)</option>
            <option value="windows">💻 Windows (EXE / ZIP)</option>
            <option value="darwin">🍎 macOS (DMG / ZIP)</option>
            <option value="android">📱 Android (APK)</option>
          </select>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Target Activation Keys (Optional)</label>
          <input type="text" id="targetKeys" class="form-input" placeholder="e.g. 3CKG-CXBR-T7AT-GADM (Leave blank for Global Release)">
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Direct App Download Link (Cloudinary/Dropbox/S3)</label>
          <div class="download-link-row">
            <input type="text" id="downloadUrl" class="form-input" placeholder="https://..." value="${escapeHtml(currentData.url)}">
            <button type="button" class="btn btn-secondary btn-sm" id="copyDownloadUrlBtn" style="min-width: 100px;">Copy URL</button>
            <a id="openDownloadLink" class="btn btn-secondary btn-sm" href="${escapeHtml(currentData.url)}" target="_blank" rel="noopener noreferrer">Test Link</a>
          </div>
        </div>
      </div>

      <!-- Upload Section -->
      <div class="form-group" style="margin-bottom: 24px;">
        <label class="form-label">Upload New Build (ZIP / EXE / DMG / APK)</label>
        <input type="file" id="zipFileInput" accept=".zip,application/zip,.exe,.dmg,.apk" hidden>
        
        <div class="upload-split-container">
          <div id="uploadBox" class="upload-box" role="button" tabindex="0">
            <div class="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <div class="upload-box-title">Click or Drag file here</div>
            <div class="upload-box-copy">Maximum file size: 500MB</div>
          </div>
          
          <div class="upload-details">
            <div id="selectedFileName" class="upload-file-name" style="color: var(--text-dim); font-weight: 400;">No file selected</div>
            
            <div class="progress-container" id="progressContainer">
              <div class="progress-bar-fill" id="progressBar"></div>
            </div>
            <div class="progress-text" id="progressText">0%</div>
            
            <div class="upload-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="browseZipBtn" style="flex: 1;">Browse File</button>
              <button type="button" class="btn btn-primary btn-sm" id="uploadZipBtn" style="flex: 1;" disabled>Start Upload</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Changelog -->
      <div class="form-group">
        <label class="form-label">Release Notes / Changelog</label>
        <textarea id="changeLog" class="form-input form-textarea" placeholder="List new features, bug fixes, and improvements...">${escapeHtml(currentData.changeLog)}</textarea>
      </div>

      <div id="updateStatus" class="status-msg"></div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="clearFormBtn">Clear Form</button>
        <button type="button" class="btn btn-primary" id="submitUpdate" style="min-width: 200px;">Deploy Release</button>
      </div>

      <!-- Releases Table -->
      <div class="targeted-list-container">
        <div class="targeted-list-title">
          <h4>Active Release Branches</h4>
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-dim); background: var(--bg-input); padding: 6px 12px; border-radius: 8px;" id="targetedCount">0 Releases</span>
            <button type="button" class="btn btn-secondary btn-sm" id="newReleaseBtn">+ New Release</button>
          </div>
        </div>
        
        <div class="table-responsive">
          <table class="release-table">
            <thead>
              <tr>
                <th style="width: 20%;">Scope / Key(s)</th>
                <th style="width: 15%;">Platform</th>
                <th style="width: 10%;">Version</th>
                <th style="width: 25%;">Distribution Link</th>
                <th style="width: 20%;">Notes</th>
                <th style="width: 10%; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="releasesTableBody">
              <tr>
                <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 32px;">Loading release configurations...</td>
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
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const closePasswordModalBtn = document.getElementById('closePasswordModal');
    const closeUpdateModalBtn = document.getElementById('closeUpdateModal');

    const submitUpdateBtn = document.getElementById('submitUpdate');
    const updateStatus = document.getElementById('updateStatus');
    const downloadUrlInput = document.getElementById('downloadUrl');
    const zipFileInput = document.getElementById('zipFileInput');
    const uploadBox = document.getElementById('uploadBox');
    const browseZipBtn = document.getElementById('browseZipBtn');
    const uploadZipBtn = document.getElementById('uploadZipBtn');
    const selectedFileName = document.getElementById('selectedFileName');

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const copyDownloadUrlBtn = document.getElementById('copyDownloadUrlBtn');
    const openDownloadLink = document.getElementById('openDownloadLink');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const newReleaseBtn = document.getElementById('newReleaseBtn');

    let selectedZipFile = null;
    let allReleases = [];

    function openModal(id) {
      const el = document.getElementById(id);
      if (!el) {
        console.error('Modal not found:', id);
        return;
      }
      el.classList.add('active');
      document.body.classList.add('modal-open');
    }

    function closeModal(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      if (!document.querySelector('.modal-overlay.active')) {
        document.body.classList.remove('modal-open');
      }
    }

    function clearPasswordError() {
      if (!passwordError) return;
      passwordError.textContent = '';
      passwordError.style.display = 'none';
    }

    function showPasswordError(message) {
      if (!passwordError) return;
      passwordError.textContent = message || 'Invalid password. Access denied.';
      passwordError.style.display = 'block';
      passwordError.classList.add('error');
      if (adminPasswordInput) {
        adminPasswordInput.classList.add('input-error');
        setTimeout(() => adminPasswordInput.classList.remove('input-error'), 500);
      }
    }

    function openVersionControlModal() {
      clearPasswordError();
      if (adminPasswordInput) adminPasswordInput.value = '';
      openModal('passwordModal');
      setTimeout(() => adminPasswordInput?.focus(), 120);
    }

    window.openModal = openModal;
    window.closeModal = closeModal;
    window.openVersionControlModal = openVersionControlModal;

    if (openUpdateBtn) {
      openUpdateBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        openVersionControlModal();

        // Skip the password step when the admin session cookie is still valid.
        try {
          const res = await fetch('/api/version/admin/session', { credentials: 'same-origin' });
          const data = await res.json();
          if (data?.authenticated) {
            closeModal('passwordModal');
            setTimeout(() => {
              openModal('updateModal');
              loadReleasesTable();
            }, 120);
          }
        } catch (_) { /* stay on the password step */ }
      });
    }

    async function handleLogin() {
      if (!adminPasswordInput || !submitPasswordBtn) return;

      const password = adminPasswordInput.value.trim();

      if (!password) {
        showPasswordError('Please enter administrator password.');
        adminPasswordInput.focus();
        return;
      }

      clearPasswordError();
      submitPasswordBtn.disabled = true;
      submitPasswordBtn.textContent = 'Verifying...';
      submitPasswordBtn.style.pointerEvents = 'none';
      
      try {
        const response = await fetch('/api/version/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ password })
        });

        let data = {};
        const responseText = await response.text();
        if (responseText) {
          try { data = JSON.parse(responseText); } catch (_) {}
        }

        if (!response.ok) {
          showPasswordError(
            data.message || data.error || 'Authentication failed (' + response.status + ').'
          );
          adminPasswordInput.focus();
          return;
        }

        closeModal('passwordModal');

        setTimeout(() => {
          openModal('updateModal');
          if (typeof loadReleasesTable === 'function') {
            loadReleasesTable();
          }
        }, 180);

      } catch (error) {
        console.error('Version admin login error:', error);
        showPasswordError('Unable to connect to the server. Please try again.');
      } finally {
        submitPasswordBtn.disabled = false;
        submitPasswordBtn.textContent = 'Verify Access';
        submitPasswordBtn.style.pointerEvents = 'auto';
      }
    }

    window._handleLoginImpl = handleLogin;
    window.handleLogin = handleLogin;

    if (submitPasswordBtn) {
      submitPasswordBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLogin();
      });
    }

    if (adminPasswordInput) {
      adminPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleLogin();
        }
      });
    }

    function closePasswordAuthentication() {
      clearPasswordError();
      if (adminPasswordInput) adminPasswordInput.value = '';
      closeModal('passwordModal');
    }

    cancelPasswordBtn?.addEventListener('click', closePasswordAuthentication);
    closePasswordModalBtn?.addEventListener('click', closePasswordAuthentication);
    closeUpdateModalBtn?.addEventListener('click', () => closeModal('updateModal'));

    // Close on backdrop click (clicks inside the modal are ignored)
    passwordModal?.addEventListener('mousedown', (event) => {
      if (event.target === passwordModal) closePasswordAuthentication();
    });
    updateModal?.addEventListener('mousedown', (event) => {
      if (event.target === updateModal) closeModal('updateModal');
    });

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (passwordModal?.classList.contains('active')) closePasswordAuthentication();
      else if (updateModal?.classList.contains('active')) closeModal('updateModal');
    });

    function setStatus(message, type = 'error') {
      updateStatus.innerText = message;
      updateStatus.className = 'status-msg ' + type;
    }

    function updateSelectedFile(file) {
      selectedZipFile = file || null;
      if (selectedZipFile) {
        selectedFileName.innerText = file.name;
        selectedFileName.style.color = 'var(--text-main)';
        uploadZipBtn.disabled = false;
        uploadBox.style.borderColor = 'var(--success-green)';
      } else {
        if (zipFileInput) zipFileInput.value = '';
        selectedFileName.innerText = 'No file selected';
        selectedFileName.style.color = 'var(--text-dim)';
        uploadZipBtn.disabled = true;
        uploadBox.style.borderColor = 'rgba(255,255,255,0.2)';
      }
      
      progressContainer.style.display = 'none';
      progressText.style.display = 'none';
      progressBar.style.width = '0%';
      progressBar.style.backgroundColor = 'var(--accent-primary)';
    }

    browseZipBtn.addEventListener('click', () => zipFileInput.click());
    uploadBox.addEventListener('click', () => zipFileInput.click());
    
    downloadUrlInput.addEventListener('input', () => {
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
      setStatus('File ready to upload.', 'success');
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
      const transfer = new DataTransfer();
      transfer.items.add(file);
      zipFileInput.files = transfer.files;
      updateSelectedFile(file);
      setStatus('File ready to upload.', 'success');
    });

    async function uploadZipToCloudinary(file) {
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
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        progressContainer.style.display = 'block';
        progressText.style.display = 'block';
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressText.innerText = percentComplete + '% Uploaded';
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const uploadData = JSON.parse(xhr.responseText);
            const downloadUrl = uploadData.secure_url.includes('/upload/')
              ? uploadData.secure_url.replace('/upload/', '/upload/fl_attachment:' + encodeURIComponent(file.name) + '/')
              : uploadData.secure_url;
            downloadUrlInput.value = downloadUrl;
            openDownloadLink.href = downloadUrl;
            progressBar.style.backgroundColor = 'var(--success-green)';
            progressText.innerText = 'Upload Complete!';
            
            resolve({ downloadUrl, assetId: uploadData.public_id, fileName: file.name });
          } else {
            let errorMessage = 'Upload failed.';
            try {
              const errorObj = JSON.parse(xhr.responseText);
              errorMessage = errorObj.error?.message || errorMessage;
            } catch(e) {}
            
            progressBar.style.backgroundColor = 'var(--error-red)';
            progressText.innerText = 'Failed';
            reject(new Error(errorMessage));
          }
        };
        xhr.onerror = () => {
          progressBar.style.backgroundColor = 'var(--error-red)';
          progressText.innerText = 'Network Error';
          reject(new Error('Network error during upload.'));
        };
        xhr.send(formData);
      });
    }

    async function handleUploadZip() {
      if (!selectedZipFile) { setStatus('Choose a file first.', 'error'); return; }
      uploadZipBtn.innerText = 'Uploading...';
      uploadZipBtn.disabled = true;
      browseZipBtn.disabled = true;
      setStatus('Uploading file and generating secure link...', 'success');
      try {
        const result = await uploadZipToCloudinary(selectedZipFile);
        setStatus('Secure distribution link generated for ' + result.fileName, 'success');
      } catch (error) {
        setStatus(error.message || 'Upload failed.', 'error');
      } finally {
        uploadZipBtn.innerText = 'Start Upload';
        uploadZipBtn.disabled = false;
        browseZipBtn.disabled = false;
      }
    }
    window._handleUploadZipImpl = handleUploadZip;
    window.handleUploadZip = handleUploadZip;
    if (uploadZipBtn) uploadZipBtn.addEventListener('click', handleUploadZip);

    async function handleCopyUrl() {
      if (!downloadUrlInput.value) return;
      try {
        await navigator.clipboard.writeText(downloadUrlInput.value);
        copyDownloadUrlBtn.innerText = 'Copied!';
        setTimeout(() => { copyDownloadUrlBtn.innerText = 'Copy URL'; }, 2000);
      } catch (error) { setStatus('Could not copy link.', 'error'); }
    }
    window._handleCopyUrlImpl = handleCopyUrl;
    window.handleCopyUrl = handleCopyUrl;
    if (copyDownloadUrlBtn) copyDownloadUrlBtn.addEventListener('click', handleCopyUrl);

    async function loadReleasesTable() {
      const tbody = document.getElementById('releasesTableBody');
      const countEl = document.getElementById('targetedCount');
      if (!tbody) return;
      try {
        const res = await fetch('/api/version/admin/targeted');
        if (!res.ok) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error-red); padding: 32px;">Failed to load release entries.</td></tr>';
          return;
        }
        allReleases = await res.json();
        if (countEl) countEl.innerText = (allReleases.length || 0) + ' Releases';
        
        if (!allReleases || allReleases.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 32px;">No release entries found. Start by creating a new release.</td></tr>';
          return;
        }
        
        const escHtml = (value) => String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        tbody.innerHTML = allReleases.map(function(item) {
          const isGlobal = item.key === 'default';
          const keysText = Array.isArray(item.targetKeys) ? item.targetKeys.join(', ') : (item.targetKeys || 'Key Specific');
          const scopeBadge = isGlobal
            ? '<span class="badge-global">GLOBAL DEFAULT</span>'
            : '<span class="badge-targeted">🔑 ' + escHtml(keysText) + '</span>';

          const platStr = String(item.platform || 'all').toLowerCase();
          const platBadgeStr = platStr === 'android' ? '📱 Android' : platStr === 'windows' ? '💻 Windows' : platStr === 'darwin' ? '🍎 macOS' : '🌐 Universal';
          const platBadge = '<span class="badge-platform">' + platBadgeStr + '</span>';

          const rawUrl = String(item.url || '');
          const truncatedUrl = rawUrl.length > 35 ? rawUrl.substring(0, 35) + '...' : rawUrl;
          const deleteBtn = isGlobal ? '' : '<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="' + escHtml(item._id) + '">Delete</button>';

          return '<tr data-id="' + escHtml(item._id) + '">' +
            '<td>' + scopeBadge + '</td>' +
            '<td>' + platBadge + '</td>' +
            '<td style="font-family: monospace; font-weight: 700; color: var(--accent-primary);">v' + escHtml(item.version) + '</td>' +
            '<td><a href="' + escHtml(rawUrl) + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: none; font-size: 12px; font-family: monospace;" title="' + escHtml(rawUrl) + '">' + escHtml(truncatedUrl) + '</a></td>' +
            '<td style="max-width: 200px; white-space: pre-wrap; font-size: 11px; color: var(--text-dim); line-height: 1.4;">' + escHtml(item.changeLog || '-') + '</td>' +
            '<td style="text-align: center;"><div class="action-btn-group" style="justify-content: center;"><button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="' + escHtml(item._id) + '">Edit</button>' + deleteBtn + '</div></td>' +
            '</tr>';
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error-red); padding: 32px;">Network error loading releases.</td></tr>';
      }
    }

    function editReleaseRule(id) {
      const item = allReleases.find(r => r._id === id);
      if (!item) return;
      document.getElementById('ruleId').value = item._id;
      document.getElementById('newVersion').value = item.version;
      document.getElementById('downloadUrl').value = item.url;
      document.getElementById('openDownloadLink').href = item.url;
      document.getElementById('changeLog').value = item.changeLog || '';
      document.getElementById('targetPlatform').value = item.platform || 'all';
      
      if (item.key === 'default') {
        document.getElementById('targetKeys').value = '';
        submitUpdateBtn.innerText = 'Save Global Release (v' + item.version + ')';
      } else {
        document.getElementById('targetKeys').value = Array.isArray(item.targetKeys) ? item.targetKeys.join(', ') : (item.targetKeys || '');
        submitUpdateBtn.innerText = 'Save Release Rule (v' + item.version + ')';
      }
      setStatus('Editing release configuration.', 'success');
      document.querySelector('#updateModal .modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetReleaseForm() {
      document.getElementById('ruleId').value = '';
      document.getElementById('targetKeys').value = '';
      document.getElementById('targetPlatform').value = 'all';
      document.getElementById('changeLog').value = '';
      document.getElementById('newVersion').value = '';
      downloadUrlInput.value = '';
      updateSelectedFile(null);
      submitUpdateBtn.innerText = 'Deploy Release';
      setStatus('Ready for new release configuration.', 'success');
      document.querySelector('#updateModal .modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deleteReleaseRule(id) {
      if (!confirm('Permanently delete this targeted release rule?')) return;
      try {
        const res = await fetch('/api/version/admin/targeted/' + id, { method: 'DELETE' });
        if (res.ok) {
          setStatus('Release rule deleted successfully.', 'success');
          loadReleasesTable();
        } else {
          setStatus('Failed to delete release rule.', 'error');
        }
      } catch (err) {
        setStatus('Network error when deleting release.', 'error');
      }
    }

    window._editReleaseRuleImpl = editReleaseRule;
    window._resetReleaseFormImpl = resetReleaseForm;
    window._deleteReleaseRuleImpl = deleteReleaseRule;
    window.editReleaseRule = editReleaseRule;
    window.resetReleaseForm = resetReleaseForm;
    window.deleteReleaseRule = deleteReleaseRule;

    // Row actions via event delegation (no inline onclick needed)
    document.getElementById('releasesTableBody')?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (btn.getAttribute('data-action') === 'edit') editReleaseRule(id);
      else if (btn.getAttribute('data-action') === 'delete') deleteReleaseRule(id);
    });

    if (clearFormBtn) clearFormBtn.addEventListener('click', resetReleaseForm);
    if (newReleaseBtn) newReleaseBtn.addEventListener('click', resetReleaseForm);

    async function handleUpdate() {
      const data = {
        ruleId: document.getElementById('ruleId').value,
        version: document.getElementById('newVersion').value,
        url: downloadUrlInput.value,
        changeLog: document.getElementById('changeLog').value,
        targetKeys: document.getElementById('targetKeys').value,
        platform: document.getElementById('targetPlatform').value
      };
      
      if (!data.version || !data.url || !data.changeLog) {
        setStatus('Version, Download Link, and Changelog are required.', 'error'); return;
      }
      
      submitUpdateBtn.innerText = 'Deploying...';
      submitUpdateBtn.disabled = true;
      try {
        const response = await fetch('/api/version/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
          setStatus('Release deployed successfully.', 'success');
          resetReleaseForm();
          loadReleasesTable();
        } else {
          setStatus(result.message || 'Deployment failed.', 'error');
        }
      } catch (err) {
        setStatus('Network error. Deployment failed.', 'error');
      } finally {
        submitUpdateBtn.innerText = 'Deploy Release';
        submitUpdateBtn.disabled = false;
      }
    }
    
    window._handleUpdateImpl = handleUpdate;
    window.handleUpdate = handleUpdate;
    if (submitUpdateBtn) submitUpdateBtn.addEventListener('click', handleUpdate);
  </script>
</body>
</html>
`;

export const getVersion = async (req, res, next) => {
  try {
    const activationKey = req.query.key || req.headers['x-activation-key'] || req.body?.key;
    const platform = req.query.platform || req.headers['x-platform'] || req.body?.platform || 'all';
    const versionData = await getVersionRecord(activationKey, platform);
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

    const { ruleId, version, url, changeLog, targetKeys, platform } = req.body ?? {};

    if (!version || !url || !changeLog) {
      return res.status(400).json({ message: 'version, url, and changeLog are required.' });
    }

    const targetPlatform = String(platform || 'all').toLowerCase().trim();

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
          platform: targetPlatform,
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
        platform: updated.platform,
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
        platform: targetPlatform,
        status: 'success',
        active: true,
      });

      return res.status(200).json({
        message: `Targeted update created successfully for key(s): ${formattedTargetKeys.join(', ')} (${targetPlatform})`,
        id: created._id,
        version: created.version,
        url: created.url,
        changeLog: created.changeLog,
        platform: created.platform,
        targetKeys: created.targetKeys,
        isTargeted: true,
      });
    }

    // 3. Platform specific or global default release
    const ruleKey = targetPlatform === 'all' ? 'default' : targetPlatform;
    const updated = await VersionConfig.findOneAndUpdate(
      { key: ruleKey },
      {
        key: ruleKey,
        version: String(version).trim(),
        url: resolvedUrl,
        changeLog: String(changeLog).trim(),
        platform: targetPlatform,
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
      message: `${targetPlatform.toUpperCase()} release updated successfully.`,
      version: updated.version,
      url: updated.url,
      platform: updated.platform,
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
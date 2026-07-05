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
      position: absolute; top: 30px; left: 30px; right: 30px; bottom: 30px;
      border: 1px solid var(--border-color); z-index: 10; pointer-events: none;
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

    .ui-tags { position: absolute; display: flex; flex-direction: column; gap: 6px; z-index: 20; }
    .ui-tags.tl { top: 24px; left: 24px; align-items: flex-start; }
    .ui-tags.tr { top: 24px; right: 24px; align-items: flex-end; }

    .tag {
      background-color: var(--accent-bg); border: 1px solid var(--border-color);
      color: var(--accent-blue); font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 4px 8px; letter-spacing: 0.05em; backdrop-filter: blur(4px);
    }

    .hero-content { position: relative; z-index: 30; text-align: center; display: flex; flex-direction: column; align-items: center; }

    .hero-title {
      font-size: clamp(80px, 16vw, 200px); font-weight: 800; letter-spacing: -0.04em;
      color: var(--text-main); line-height: 0.9; margin-bottom: 20px; text-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); 
    }

    .update-btn {
      background-color: var(--text-main); color: #000; border: none; padding: 12px 32px;
      font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;
      cursor: pointer; transition: all 0.3s ease; font-family: 'Inter', sans-serif; margin-top: 20px;
    }
    .update-btn:hover {
      background-color: var(--accent-blue); color: #fff; transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(123, 162, 219, 0.3);
    }

    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px); z-index: 100; display: none; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
    }
    .modal-overlay.active { display: flex; opacity: 1; }

    .modal-content {
      background: var(--modal-bg); border: 1px solid var(--border-color); width: 100%;
      max-width: 650px; /* Widened to avoid scroll and fit side-by-side elements */
      padding: 30px; position: relative; transform: translateY(20px); transition: transform 0.3s ease;
      max-height: 90vh; overflow-y: auto; overflow-x: hidden;
    }
    /* Hide scrollbar for Chrome, Safari and Opera */
    .modal-content::-webkit-scrollbar { display: none; }
    /* Hide scrollbar for IE, Edge and Firefox */
    .modal-content { -ms-overflow-style: none; scrollbar-width: none; }
    
    .modal-overlay.active .modal-content { transform: translateY(0); }

    .modal-title {
      font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700;
      color: var(--accent-blue); margin-bottom: 16px; text-transform: uppercase;
      letter-spacing: 0.1em; display: flex; align-items: center; gap: 10px;
    }
    .modal-title::before { content: '>'; color: var(--accent-blue); }

    .form-group { margin-bottom: 16px; }

    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; margin-bottom: 0; }

    .form-label {
      display: block; font-size: 10px; font-weight: 700; text-transform: uppercase;
      color: var(--text-dim); margin-bottom: 6px; letter-spacing: 0.05em;
    }

    .form-input {
      width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color);
      padding: 10px 12px; color: #fff; font-family: 'Inter', sans-serif; font-size: 13px;
      outline: none; transition: border-color 0.3s ease;
    }
    .form-input:focus { border-color: var(--accent-blue); background: rgba(255, 255, 255, 0.08); }

    .form-textarea { min-height: 60px; resize: vertical; }

    /* Side by side upload layout */
    .upload-split-container {
      display: flex;
      gap: 20px;
      align-items: stretch;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(123, 162, 219, 0.2);
      padding: 12px;
    }

    .upload-box {
      flex: 1; border: 1px dashed rgba(123, 162, 219, 0.45); background: rgba(255, 255, 255, 0.02);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 20px 10px; cursor: pointer; transition: all 0.2s ease;
      min-height: 100px;
    }
    .upload-box.dragover { border-color: var(--accent-blue); background: rgba(123, 162, 219, 0.12); }
    .upload-box-title { font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; }
    .upload-box-copy { font-size: 11px; color: var(--text-dim); }

    .upload-details {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
    }
    .upload-file-name {
      font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent-blue);
      word-break: break-all; margin-bottom: 8px; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .upload-actions { display: flex; gap: 8px; margin-top: auto; }
    .mini-btn { padding: 8px 12px; font-size: 10px; flex: 1; text-align: center; }

    /* Progress bar styles */
    .progress-container {
      width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px;
      overflow: hidden; margin-bottom: 12px; display: none;
    }
    .progress-bar-fill {
      height: 100%; width: 0%; background: var(--success-green);
      transition: width 0.2s ease, background 0.2s ease;
    }
    .progress-text {
      font-size: 10px; color: var(--text-dim); margin-top: 4px; text-align: right; display: none; font-family: 'JetBrains Mono', monospace;
    }

    .download-link-row { display: flex; gap: 8px; align-items: center; }
    .download-link-row .form-input { flex: 1; }

    .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
    
    .btn {
      padding: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
      cursor: pointer; transition: all 0.2s ease; font-family: 'JetBrains Mono', monospace; border: 1px solid transparent; display: inline-block; text-decoration: none;
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
      position: absolute; top: 16px; right: 20px; color: var(--text-dim); cursor: pointer;
      font-size: 24px; line-height: 1; transition: color 0.2s ease;
    }
    .modal-close:hover { color: var(--text-main); }

    .current-info {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px; z-index: 20;
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
    <div class="modal-content" style="max-width: 400px;">
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
      
      <div class="form-row">
        <div class="form-group" style="flex: 0 0 150px;">
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
          <button type="button" class="btn btn-secondary mini-btn" style="flex: 0 0 auto;" id="copyDownloadUrlBtn">Copy</button>
          <a id="openDownloadLink" class="btn btn-primary mini-btn" style="flex: 0 0 auto;" href="${currentData.url}" target="_blank" rel="noopener noreferrer">Test URL</a>
        </div>
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

    async function handleUpdate() {
      const data = {
        version: document.getElementById('newVersion').value,
        url: downloadUrlInput.value,
        changeLog: document.getElementById('changeLog').value
      };

      if (!data.version || !data.url || !data.changeLog) {
        setStatus('All fields are required.', 'error'); return;
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
          setStatus('Database updated successfully. Refreshing...', 'success');
          await fetch('/api/version/admin/logout', { method: 'POST' });
          setTimeout(() => { window.location.reload(); }, 1500);
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

    const { version, url, changeLog } = req.body ?? {};

    if (!version || !url || !changeLog) {
      return res.status(400).json({ message: 'version, url, and changeLog are required.' });
    }

    const resolvedUrl = String(url).includes('cloudinary.com')
      ? buildCloudinaryDownloadUrl(String(url).trim())
      : String(url).trim();

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
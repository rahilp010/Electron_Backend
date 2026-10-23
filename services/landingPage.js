const INQUIRY_EMAIL = 'rahilp704@gmail.com';

export const renderLandingPage = () => `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f7f4">
  <meta name="description" content="Discover Envy Group products: Envy ERP, Envy Mobile, and Envy Sync.">
  <script>
    (() => {
      const root = document.documentElement;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      let storedTheme = null;
      try {
        storedTheme = localStorage.getItem('envy-theme') || localStorage.getItem('theme');
      } catch (error) {
        console.warn('Theme preference could not be read:', error);
      }
      const hasStoredTheme = storedTheme === 'dark' || storedTheme === 'light';
      const theme = hasStoredTheme ? storedTheme : systemTheme;
      root.dataset.theme = theme;
      root.dataset.themePreference = hasStoredTheme ? 'manual' : 'system';
      document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b110e' : '#f5f7f4';
    })();
  </script>
  <title>Envy Group — Connected business, made clearer</title>
  <link rel="icon" type="image/png" href="/favicon.ico">
  <style>
    :root {
      color-scheme: light;
      --ink: #17231f;
      --muted: #68766f;
      --line: #e1e8e3;
      --paper: #f5f7f4;
      --white: #fff;
      --green: #176b50;
      --green-dark: #10543e;
      --lime: #d5f07b;
      --shadow: 0 22px 60px rgba(25, 51, 39, .09);
      --surface-alt: #edf5ef;
      --surface-panel: #edf2eb;
      --input-bg: #fbfcfb;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    
    [data-theme="dark"] {
      color-scheme: dark;
      --ink: #f0fdf4;
      --muted: #96a19b;
      --line: #27362f;
      --paper: #0b110e;
      --white: #121a17;
      --green: #29b889;
      --green-dark: #37d6a4;
      --lime: #d5f07b;
      --shadow: 0 22px 60px rgba(0, 0, 0, 0.5);
      --surface-alt: #16241e;
      --surface-panel: #141c19;
      --input-bg: #101614;
    }

    /* Circular reveal transition */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-old(root) {
  z-index: 1;
}

::view-transition-new(root) {
  z-index: 2;
}

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--paper); color: var(--ink); transition: background-color 0.4s ease, color 0.4s ease; }
    a { color: inherit; }
    .wrap { width: min(1160px, calc(100% - 48px)); margin: 0 auto; }
    .topbar { height: 82px; display: flex; align-items: center; justify-content: space-between; }
    .brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; font-size: 16px; font-weight: 760; letter-spacing: -.04em; }
    .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; overflow: hidden; border-radius: 11px; background: var(--green); color: white; transition: background-color 0.4s ease; }
    .brand-mark svg { width: 20px; height: 20px; }
    .brand-mark img { width: 100%; height: 100%; object-fit: cover; }
    .nav { display: flex; align-items: center; gap: 31px; font-size: 13px; font-weight: 600; color: var(--muted); }
    .nav a { text-decoration: none; transition: color 0.2s; }
    .nav a:hover, .text-link:hover { color: var(--green); }
    
    .theme-toggle { background: transparent; border: none; padding: 8px; cursor: pointer; color: var(--muted); border-radius: 50%; display: grid; place-items: center; transition: background 0.2s, color 0.2s; }
    .theme-toggle:hover { background: rgba(128, 128, 128, 0.15); color: var(--ink); }
    .theme-toggle svg { width: 18px; height: 18px; }

    /* Smooth theme transition */
body,
.product-card,
.inquiry,
.release-panel,
.nav-cta,
.form-field input,
.form-field select,
.form-field textarea {
  transition:
    background-color 0.45s ease,
    color 0.45s ease,
    border-color 0.45s ease;
}

/* Full-screen theme reveal */
.theme-wipe {
  position: fixed;
  inset: 0;
  z-index: 99999;
  pointer-events: none;
  clip-path: circle(0 at 50% 50%);
  display: grid;
  place-items: center;
  will-change: clip-path;
}

.theme-wipe-icon {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(14px);
  animation: theme-icon-enter 0.55s
    cubic-bezier(.2, .8, .2, 1) both;
}

.theme-wipe-icon svg {
  width: 38px;
  height: 38px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes theme-icon-enter {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-90deg);
  }

  60% {
    opacity: 1;
    transform: scale(1.15) rotate(12deg);
  }

  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.theme-toggle svg {
  transition: transform 0.3s ease;
}

.theme-toggle:active svg {
  transform: scale(0.8) rotate(-25deg);
}

@media (prefers-reduced-motion: reduce) {
  .theme-wipe {
    display: none;
  }

  .theme-toggle svg {
    transition: none;
  }
}
    
    .nav-cta { padding: 11px 17px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink) !important; transition: border-color 0.4s ease; }
    .hero { position: relative; overflow: hidden; min-height: 436px; padding: 73px 7.2% 68px; display: grid; grid-template-columns: 1.15fr .85fr; align-items: center; gap: 24px; background: #153d31; border-radius: 25px; color: white; }
    .hero:after { content: ""; position: absolute; width: 470px; height: 470px; border: 1px solid rgba(213,240,123,.2); border-radius: 50%; right: -105px; top: -245px; box-shadow: 0 0 0 38px rgba(213,240,123,.035), 0 0 0 78px rgba(213,240,123,.035); }
    .hero-copy, .hero-art { position: relative; z-index: 1; }
    .eyebrow { display: inline-flex; gap: 9px; align-items: center; color: var(--lime); font-size: 11px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
    .eyebrow:before { content: ""; width: 22px; height: 1px; background: currentColor; }
    h1 { max-width: 590px; margin: 20px 0 17px; font-size: clamp(44px, 6vw, 70px); line-height: .99; letter-spacing: -.065em; font-weight: 650; }
    .hero-copy p { max-width: 490px; color: #d1dfd7; font-size: 15px; line-height: 1.8; margin: 0; }
    .hero-actions { display: flex; align-items: center; gap: 14px; margin-top: 29px; flex-wrap: wrap; }
    .button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 46px; padding: 0 19px; border-radius: 999px; text-decoration: none; font-size: 13px; font-weight: 700; transition: transform .2s, background .2s; }
    .button:hover { transform: translateY(-2px); }
    .button-primary { background: var(--lime); color: #183d2e; }
    .button-quiet { color: white; border: 1px solid rgba(255,255,255,.28); }
    .button svg { width: 15px; height: 15px; }
    .hero-art { justify-self: center; width: min(100%, 330px); aspect-ratio: 1; display: grid; place-items: center; }
    .orb { width: 222px; height: 222px; position: relative; display: grid; place-items: center; border: 1px solid rgba(213,240,123,.37); border-radius: 50%; background: radial-gradient(circle at 40% 36%, rgba(213,240,123,.17), transparent 64%); }
    .orb:before, .orb:after { content: ""; position: absolute; inset: -29px; border: 1px solid rgba(213,240,123,.16); border-radius: 50%; }
    .orb:after { inset: -58px; opacity: .65; }
    .orb-core { width: 105px; height: 105px; display: grid; place-items: center; border-radius: 31px; background: #ffffff; box-shadow: 0 15px 44px rgba(0,0,0,.2); transform: rotate(-8deg); }
    .orb-core svg { width: 59px; height: 59px; transform: rotate(8deg); }
    .orb-core img { width: 56px; height: 56px; border-radius: 24px; object-fit: cover; transform: rotate(8deg); }
    .orbit-label { position: absolute; display: flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; background: #204b3c; color: #e6eee8; font-size: 11px; font-weight: 650; white-space: nowrap; }
    .orbit-label:before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--lime); }
    .label-one { top: 26px; right: -41px; }
    .label-two { left: -49px; top: 91px; }
    .label-three { right: -25px; bottom: 27px; }
    .section-head { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin: 80px 0 25px; }
    .section-kicker { color: var(--green); font-size: 11px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; transition: color 0.4s; }
    h2 { margin: 9px 0 0; font-size: clamp(28px, 4vw, 38px); line-height: 1.1; letter-spacing: -.05em; font-weight: 650; }
    .section-head p { max-width: 385px; margin: 0 0 3px; color: var(--muted); font-size: 13px; line-height: 1.7; transition: color 0.4s; }
    .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    
    .product-card { min-height: 270px; padding: 26px; border: 1px solid var(--line); border-radius: 18px; background: var(--white); transition: transform .2s, box-shadow .3s, border-color .4s, background-color 0.4s; }
    .product-card:hover { transform: translateY(-4px); border-color: var(--green); box-shadow: var(--shadow); }
    .product-icon { width: 43px; height: 43px; display: grid; place-items: center; border-radius: 13px; color: var(--green); background: var(--surface-alt); transition: background-color 0.4s, color 0.4s; }
    .product-icon svg { width: 22px; height: 22px; }
    .product-type { margin-top: 23px; color: var(--muted); font-size: 10px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; transition: color 0.4s; }
    
    h3 { margin: 7px 0 10px; font-size: 21px; letter-spacing: -.04em; }
    .product-card p { margin: 0; min-height: 48px; color: var(--muted); font-size: 13px; line-height: 1.7; transition: color 0.4s; }
    .text-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 20px; color: var(--green-dark); text-decoration: none; font-size: 12px; font-weight: 700; transition: color 0.4s; }
    .text-link svg { width: 14px; height: 14px; }
    
    .release-panel { margin-top: 68px; padding: 30px 34px; display: flex; justify-content: space-between; align-items: center; gap: 24px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface-panel); transition: background-color 0.4s, border-color 0.4s; }
    .release-label { display: flex; align-items: center; gap: 8px; color: var(--green); font-size: 10px; letter-spacing: .12em; font-weight: 750; text-transform: uppercase; }
    .release-label span { width: 7px; height: 7px; border-radius: 50%; background: #49a678; box-shadow: 0 0 0 4px rgba(73,166,120,.14); }
    .release-panel h2 { margin-top: 10px; font-size: 25px; }
    .release-meta { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-top: 12px; color: var(--muted); font-size: 12px; }
    .release-meta strong { color: var(--ink); transition: color 0.4s; }
    .release-actions { display: flex; align-items: center; gap: 18px; flex-shrink: 0; }
    .button-dark { background: var(--green); color: #fff; transition: background 0.2s, transform 0.2s; }
    .button-dark:hover { background: var(--green-dark); }
    /* Manage Releases — distinct color, same button design */
.button-manage {
  background: #5865e0;
  color: #ffffff;
  border: 1px solid transparent;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.button-manage:hover {
  background: #4552c8;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(88, 101, 224, 0.25);
}

.button-manage:focus-visible {
  outline: 3px solid rgba(88, 101, 224, 0.4);
  outline-offset: 3px;
}

.button-manage svg {
  width: 15px;
  height: 15px;
}
    .release-note { max-width: 510px; margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
    
    .inquiry { margin: 76px 0 55px; padding: 42px 46px; display: grid; grid-template-columns: .8fr 1.2fr; align-items: start; gap: 38px; background: var(--white); border: 1px solid var(--line); border-radius: 20px; transition: background-color 0.4s, border-color 0.4s; }
    .inquiry h2 { font-size: 30px; }
    .inquiry p { margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
    .inquiry-form { width: 100%; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field-full { grid-column: 1 / -1; }
    .form-field label { color: var(--muted); font-size: 11px; font-weight: 700; transition: color 0.4s; }
    .form-field input, .form-field select, .form-field textarea { width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--input-bg); color: var(--ink); font: inherit; font-size: 12px; transition: background-color 0.4s, border-color 0.4s, color 0.4s; }
    .form-field textarea { min-height: 82px; resize: vertical; }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline: 2px solid rgba(27, 160, 117, .25); border-color: var(--green); }
    .form-submit { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 13px; }
    .form-submit p { margin: 0; font-size: 10px; color: var(--muted); }
    footer { padding: 22px 0 30px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 14px; color: var(--muted); font-size: 11px; transition: border-color 0.4s, color 0.4s; }
    footer a { color: var(--green); text-decoration: none; font-weight: 650; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    [hidden] { display: none !important; }
    
    @media (max-width: 780px) {
      .hero { grid-template-columns: 1fr; padding: 55px 8%; }
      .hero-art { position: absolute; right: -28px; bottom: -66px; width: 235px; opacity: .42; }
      .hero-copy { max-width: 590px; }
      .section-head { align-items: start; flex-direction: column; margin-top: 62px; }
      .product-grid { grid-template-columns: 1fr; }
      .product-card { min-height: 0; }
      .product-card p { min-height: 0; }
      .release-panel { align-items: start; flex-direction: column; padding: 26px; }
      .release-actions { flex-wrap: wrap; }
      .inquiry { grid-template-columns: 1fr; padding: 30px; }
    }
    @media (max-width: 520px) {
      .wrap { width: min(100% - 30px, 1160px); }
      .topbar { height: 70px; }
      .nav { gap: 12px; }
      .nav > a:not(.nav-cta) { display: none; }
      .hero { min-height: 430px; padding: 45px 25px; border-radius: 19px; }
      h1 { font-size: 49px; }
      .hero-copy p { font-size: 14px; }
      .label-one { right: -12px; }
      .label-two { left: -27px; }
      .label-three { right: -4px; }
      .release-actions { align-items: start; flex-direction: column; }
      footer { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *:before, *:after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <header class="wrap topbar">
    <a class="brand" href="/" aria-label="Envy Group home">
      <span aria-hidden="true">
        <!-- <svg viewBox="0 0 24 24" fill="none"><path d="M5 17.5V6.5h3.2l7.6 8.2V6.5H19v11h-3.1L8.2 9.2v8.3H5Z" fill="currentColor"/></svg> -->
        <img src="/updates/services/Envy.png" alt="" width="30" height="30">
      </span>
      <span>ENVY GROUP</span>
    </a>
    <nav class="nav" aria-label="Main navigation">
      <a href="#products">Products</a>
      <a href="#releases">Releases</a>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false" title="Switch theme">
        <span class="sr-only">Switch theme</span>
      </button>
      <a class="nav-cta" href="#inquiry">Get in touch <span aria-hidden="true">↗</span></a>
    </nav>
  </header>
  <main class="wrap">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="eyebrow">One group. Connected products.</div>
        <h1 id="hero-title">Business, moving in sync.</h1>
        <p>Meet the Envy product family: practical tools across desktop, mobile, and sync, designed to bring your business workflows together.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#products">Explore our products <span aria-hidden="true">↓</span></a>
          <a class="button button-quiet" href="mailto:${INQUIRY_EMAIL}">Talk to our team <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orb">
          <div class="orb-core">
            <!-- <svg viewBox="0 0 64 64" fill="none"><path d="M10 47V17h8l22 23V17h14v30h-8L24 24v23H10Z" fill="#174534"/></svg> -->
            <img src="/updates/services/Envy.png" alt="" width="26" height="26">
          </div>
          <span class="orbit-label label-one">Envy ERP</span>
          <span class="orbit-label label-two">Envy Mobile</span>
          <span class="orbit-label label-three">Envy Sync</span>
        </div>
      </div>
    </section>
    <section id="products" aria-labelledby="products-title">
      <div class="section-head">
        <div><div class="section-kicker">The product family</div><h2 id="products-title">Built to work together.</h2></div>
        <p>Three focused products make up the Envy Group ecosystem. Get in touch to learn more or discuss what fits your team.</p>
      </div>
      <div class="product-grid">
        <article class="product-card">
          <div class="product-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h4m-4 4h2m4-4h4m-4 4h4"/></svg></div>
          <div class="product-type">Desktop application</div><h3>Envy ERP</h3>
          <p>Your desktop workspace for day-to-day business operations, with connected tools for managing key workflows.</p>
          <a class="text-link" href="#inquiry">Enquire about Envy ERP <span aria-hidden="true">↗</span></a>
        </article>
        <article class="product-card">
          <div class="product-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 5h4m-3 13h2"/></svg></div>
          <div class="product-type">Mobile application</div><h3>Envy Mobile</h3>
          <p>A mobile companion in the Envy ecosystem, bringing your business experience along wherever work takes you.</p>
          <a class="text-link" href="#inquiry">Enquire about Envy Mobile <span aria-hidden="true">↗</span></a>
        </article>
        <article class="product-card">
          <div class="product-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 9M4 15l2.8 2a7 7 0 0 0 11.6-2"/></svg></div>
          <div class="product-type">Sync application</div><h3>Envy Sync</h3>
          <p>A dedicated sync app that helps keep your Envy products and business data working together.</p>
          <a class="text-link" href="#inquiry">Enquire about Envy Sync <span aria-hidden="true">↗</span></a>
        </article>
      </div>
    </section>
    <section id="releases" class="release-panel" aria-labelledby="release-title">
      <div>
        <div class="release-label"><span aria-hidden="true"></span> Release information</div>
        <h2 id="release-title">Envy ERP desktop</h2>
        <div class="release-meta">
          <span>Current version: <strong id="release-version">Loading…</strong></span>
          <span id="release-platform">Platform: checking</span>
        </div>
        <p class="release-note" id="release-notes" aria-live="polite">Checking the latest published release.</p>
      </div>
      <div class="release-actions">
        <a id="download-release" class="button button-dark" href="/api/version" hidden>Download latest <span aria-hidden="true">↓</span></a>
        <a class="button button-manage" href="/api/version/admin">Manage releases <span aria-hidden="true">↗</span></a>
      </div>
    </section>
    <section id="inquiry" class="inquiry" aria-labelledby="inquiry-title">
      <div>
        <div class="section-kicker">Let's talk</div>
        <h2 id="inquiry-title">Have a question for Envy Group?</h2>
        <p>Tell us what you’re looking for. We’ll be glad to hear from you. Submitting opens your email app with your inquiry ready to send.</p>
      </div>
      <form class="inquiry-form" id="inquiry-form">
        <div class="form-grid">
          <div class="form-field">
            <label for="inquiry-name">Your name</label>
            <input id="inquiry-name" name="name" autocomplete="name" required>
          </div>
          <div class="form-field">
            <label for="inquiry-email">Email address</label>
            <input id="inquiry-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="form-field form-field-full">
            <label for="inquiry-project">I’m interested in</label>
            <select id="inquiry-project" name="project">
              <option value="General Envy Group inquiry">Envy Group (general)</option>
              <option value="Envy ERP">Envy ERP</option>
              <option value="Envy Mobile">Envy Mobile</option>
              <option value="Envy Sync">Envy Sync</option>
            </select>
          </div>
          <div class="form-field form-field-full">
            <label for="inquiry-message">How can we help?</label>
            <textarea id="inquiry-message" name="message" required></textarea>
          </div>
        </div>
        <div class="form-submit">
          <p>We’ll reply to the email address you provide.</p>
          <button class="button button-dark" type="submit">Prepare inquiry <span aria-hidden="true">↗</span></button>
        </div>
      </form>
    </section>
  </main>
  <footer class="wrap">
    <span>© <span id="current-year"></span> Envy Group. All rights reserved.</span>
    <span>Enquiries: <a href="mailto:${INQUIRY_EMAIL}">${INQUIRY_EMAIL}</a></span>
  </footer>
  
  <script>
    const themeBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const sunIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    const moonIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    const applyTheme = (theme) => {
      root.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b110e' : '#f5f7f4';
      themeBtn.innerHTML = (theme === 'dark' ? sunIcon : moonIcon) + '<span class="sr-only">Switch theme</span>';
      themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
      themeBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    };
    applyTheme(root.dataset.theme);

    const persistTheme = (theme) => {
      root.dataset.themePreference = 'manual';
      try {
        localStorage.setItem('envy-theme', theme);
      } catch (error) {
        console.error('Theme preference could not be saved:', error);
      }
    };

    
themeBtn.addEventListener('click', (event) => {
  const nextTheme =
    root.dataset.theme === 'dark' ? 'light' : 'dark';

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Respect accessibility preferences.
  if (
    reduceMotion ||
    typeof document.startViewTransition !== 'function'
  ) {
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    return;
  }

  // Get the exact position where the toggle was clicked.
  const bounds = themeBtn.getBoundingClientRect();

  const x =
    event.detail === 0
      ? bounds.left + bounds.width / 2
      : event.clientX;

  const y =
    event.detail === 0
      ? bounds.top + bounds.height / 2
      : event.clientY;

  // Calculate the radius needed to cover the entire viewport.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  try {
    const transition = document.startViewTransition(() => {
      applyTheme(nextTheme);
      persistTheme(nextTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
           'circle(0px at ' + x + 'px ' + y + 'px)',
            'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
          ]
        },
        {
          duration: 850,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    }).catch((error) => {
      console.warn('Theme reveal animation failed:', error);
    });
  } catch (error) {
    console.warn('View transition failed:', error);
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  }
});


    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event) => {
      if (root.dataset.themePreference !== 'manual') {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    };
    if (typeof colorScheme.addEventListener === 'function') {
      colorScheme.addEventListener('change', updateSystemTheme);
    } else {
      colorScheme.addListener(updateSystemTheme);
    }

    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    document.getElementById('inquiry-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const subject = 'Envy Group inquiry: ' + formData.get('project');
      const body = [
        'Name: ' + formData.get('name'),
        'Email: ' + formData.get('email'),
        'Interested in: ' + formData.get('project'),
        '',
        'Message:',
        formData.get('message'),
      ].join('\\n');
      window.location.href = 'mailto:${INQUIRY_EMAIL}?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
    
    // --- Release Fetch Setup ---
    const releaseVersion = document.getElementById('release-version');
    const releasePlatform = document.getElementById('release-platform');
    const releaseNotes = document.getElementById('release-notes');
    const downloadRelease = document.getElementById('download-release');
    
    fetch('/api/version')
      .then((response) => {
        if (!response.ok) throw new Error('Release request failed with status ' + response.status);
        return response.json();
      })
      .then((release) => {
        releaseVersion.textContent = release.version || 'Not published';
        releasePlatform.textContent = 'Platform: ' + (release.platform || 'all');
        releaseNotes.textContent = release.changeLog || 'No release notes available.';
        if (release.url) {
          const downloadUrl = new URL(release.url, window.location.origin);
          if (downloadUrl.protocol === 'https:' || downloadUrl.protocol === 'http:') {
            downloadRelease.href = downloadUrl.href;
            downloadRelease.hidden = false;
          }
        }
      })
      .catch((error) => {
        console.error('Unable to load release information:', error);
        releaseVersion.textContent = 'Unavailable';
        releasePlatform.textContent = 'Platform: unavailable';
        releaseNotes.textContent = 'Release details could not be loaded. Please try again later.';
      });
  </script>
</body>
</html>`;
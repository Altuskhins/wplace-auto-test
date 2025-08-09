(async () => {
  const CONFIG = {
    START_X: 742,
    START_Y: 1148,
    PIXELS_PER_LINE: 100,
    DELAY: 1000,
    THEME: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      text: '#ffffff',
      highlight: '#775ce3',
      success: '#00ff00',
      error: '#ff0000'
    }
  };

  const state = {
    running: false,
    paintedCount: 0,
    charges: { count: 0, max: 80, cooldownMs: 30000 },
    userInfo: null,
    lastPixel: null,
    minimized: false,
    menuOpen: false,
    language: 'en'
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const fetchAPI = async (url, options = {}) => {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        ...options
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  };

  const getRandomPosition = () => ({
    x: Math.floor(Math.random() * CONFIG.PIXELS_PER_LINE),
    y: Math.floor(Math.random() * CONFIG.PIXELS_PER_LINE)
  });

  const paintPixel = async (x, y) => {
    const randomColor = Math.floor(Math.random() * 31) + 1;
    return await fetchAPI(`https://backend.wplace.live/s0/pixel/${CONFIG.START_X}/${CONFIG.START_Y}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ coords: [x, y], colors: [randomColor] })
    });
  };

  const getCharge = async () => {
    const data = await fetchAPI('https://backend.wplace.live/me');
    if (data) {
      state.userInfo = data;
      state.charges = {
        count: Math.floor(data.charges.count),
        max: Math.floor(data.charges.max),
        cooldownMs: data.charges.cooldownMs
      };
      if (state.userInfo.level) {
        state.userInfo.level = Math.floor(state.userInfo.level);
      }
    }
    return state.charges;
  };

  const detectUserLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      if (data.country === 'BR') {
        state.language = 'pt';
      } else if (data.country === 'US') {
        state.language = 'en';
      } else {
        state.language = 'en';
      }
    } catch {
      state.language = 'en';
    }
  };

  const paintLoop = async () => {
    while (state.running) {
      const { count, cooldownMs } = state.charges;
      
      if (count < 1) {
        updateUI(state.language === 'pt' ? `⌛ Sem cargas. Esperando ${Math.ceil(cooldownMs/1000)}s...` : `⌛ No charges. Waiting ${Math.ceil(cooldownMs/1000)}s...`, 'status');
        await sleep(cooldownMs);
        await getCharge();
        continue;
      }

      const randomPos = getRandomPosition();
      const paintResult = await paintPixel(randomPos.x, randomPos.y);
      
      if (paintResult?.painted === 1) {
        state.paintedCount++;
        state.lastPixel = { 
          x: CONFIG.START_X + randomPos.x,
          y: CONFIG.START_Y + randomPos.y,
          time: new Date() 
        };
        state.charges.count--;
        
        document.getElementById('paintEffect').style.animation = 'pulse 0.5s';
        setTimeout(() => {
          document.getElementById('paintEffect').style.animation = '';
        }, 500);
        
        updateUI(state.language === 'pt' ? '✅ Pixel pintado!' : '✅ Pixel painted!', 'success');
      } else {
        updateUI(state.language === 'pt' ? '❌ Falha ao pintar' : '❌ Failed to paint', 'error');
      }

      await sleep(CONFIG.DELAY);
      updateStats();
    }
  };

  const createUI = () => {
    if (state.menuOpen) return;
    state.menuOpen = true;

    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesome);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
      }
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .wplace-bot-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 250px;
        background: ${CONFIG.THEME.primary};
        border: 1px solid ${CONFIG.THEME.accent};
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        z-index: 9999;
        font-family: 'Segoe UI', Roboto, sans-serif;
        color: ${CONFIG.THEME.text};
        animation: slideIn 0.4s ease-out;
        overflow: hidden;
      }
      .wplace-header {
        padding: 12px 15px;
        background: ${CONFIG.THEME.secondary};
        color: ${CONFIG.THEME.highlight};
        font-size: 16px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
      }
      .wplace-header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .wplace-header-controls {
        display: flex;
        gap: 10px;
      }
      .wplace-header-btn {
        background: none;
        border: none;
        color: ${CONFIG.THEME.text};
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .wplace-header-btn:hover {
        opacity: 1;
      }
      .wplace-content {
        padding: 15px;
        display: ${state.minimized ? 'none' : 'block'};
      }
      .wplace-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      .wplace-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .wplace-btn:hover {
        transform: translateY(-2px);
      }
      .wplace-btn-primary {
        background: ${CONFIG.THEME.accent};
        color: white;
      }
      .wplace-btn-stop {
        background: ${CONFIG.THEME.error};
        color: white;
      }
      .wplace-stats {
        background: ${CONFIG.THEME.secondary};
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 15px;
      }
      .wplace-stat-item {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 14px;
      }
      .wplace-stat-label {
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0.8;
      }
      .wplace-status {
        padding: 8px;
        border-radius: 4px;
        text-align: center;
        font-size: 13px;
      }
      .status-default {
        background: rgba(255,255,255,0.1);
      }
      .status-success {
        background: rgba(0, 255, 0, 0.1);
        color: ${CONFIG.THEME.success};
      }
      .status-error {
        background: rgba(255, 0, 0, 0.1);
        color: ${CONFIG.THEME.error};
      }
      #paintEffect {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        border-radius: 8px;
      }
    `;
    document.head.appendChild(style);

    const translations = {
      pt: {
        title: "WPlace Auto-Farm",
        start: "Iniciar",
        stop: "Parar",
        ready: "Pronto para começar",
        user: "Usuário",
        pixels: "Pixels",
        charges: "Cargas",
        level: "Level"
      },
      en: {
        title: "WPlace Auto-Farm",
        start: "Start",
        stop: "Stop",
        ready: "Ready to start",
        user: "User",
        pixels: "Pixels",
        charges: "Charges",
        level: "Level"
      }
    };

    const t = translations[state.language] || translations.en;

    const panel = document.createElement('div');
    panel.className = 'wplace-bot-panel';
    panel.innerHTML = `
      <div id="paintEffect"></div>
      <div class="wplace-header">
        <div class="wplace-header-title">
          <i class="fas fa-paint-brush"></i>
          <span>${t.title}</span>
        </div>
        <div class="wplace-header-controls">
          <button id="minimizeBtn" class="wplace-header-btn" title="${state.language === 'pt' ? 'Minimizar' : 'Minimize'}">
            <i class="fas fa-${state.minimized ? 'expand' : 'minus'}"></i>
          </button>
        </div>
      </div>
      <div class="wplace-content">
        <div class="wplace-controls">
          <button id="toggleBtn" class="wplace-btn wplace-btn-primary">
            <i class="fas fa-play"></i>
            <span>${t.start}</span>
          </button>
        </div>
        
        <div class="wplace-stats">
          <div id="statsArea">
            <div class="wplace-stat-item">
              <div class="wplace-stat-label"><i class="fas fa-paint-brush"></i> ${state.language === 'pt' ? 'Carregando...' : 'Loading...'}</div>
            </div>
          </div>
        </div>
        
        <div id="statusText" class="wplace-status status-default">
          ${t.ready}
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    const header = panel.querySelector('.wplace-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    header.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      if (e.target.closest('.wplace-header-btn')) return;
      
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      panel.style.top = (panel.offsetTop - pos2) + "px";
      panel.style.left = (panel.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
    
    const toggleBtn = panel.querySelector('#toggleBtn');
    const minimizeBtn = panel.querySelector('#minimizeBtn');
    const statusText = panel.querySelector('#statusText');
    const content = panel.querySelector('.wplace-content');
    const statsArea = panel.querySelector('#statsArea');
    
    toggleBtn.addEventListener('click', () => {
      state.running = !state.running;
      
      if (state.running) {
        toggleBtn.innerHTML = `<i class="fas fa-stop"></i> <span>${t.stop}</span>`;
        toggleBtn.classList.remove('wplace-btn-primary');
        toggleBtn.classList.add('wplace-btn-stop');
        updateUI(state.language === 'pt' ? '🚀 Pintura iniciada!' : '🚀 Painting started!', 'success');
        paintLoop();
      } else {
        toggleBtn.innerHTML = `<i class="fas fa-play"></i> <span>${t.start}</span>`;
        toggleBtn.classList.add('wplace-btn-primary');
        toggleBtn.classList.remove('wplace-btn-stop');
        updateUI(state.language === 'pt' ? '⏸️ Pintura pausada' : '⏸️ Painting paused', 'default');
      }
    });
    
    minimizeBtn.addEventListener('click', () => {
      state.minimized = !state.minimized;
      content.style.display = state.minimized ? 'none' : 'block';
      minimizeBtn.innerHTML = `<i class="fas fa-${state.minimized ? 'expand' : 'minus'}"></i>`;
    });
    
    window.addEventListener('beforeunload', () => {
      state.menuOpen = false;
    });
  };

  window.updateUI = (message, type = 'default') => {
    const statusText = document.querySelector('#statusText');
    if (statusText) {
      statusText.textContent = message;
      statusText.className = `wplace-status status-${type}`;
      statusText.style.animation = 'none';
      void statusText.offsetWidth;
      statusText.style.animation = 'slideIn 0.3s ease-out';
    }
  };

  window.updateStats = async () => {
    await getCharge();
    const statsArea = document.querySelector('#statsArea');
    if (statsArea) {
      const t = {
        pt: {
          user: "Usuário",
          pixels: "Pixels",
          charges: "Cargas",
          level: "Level"
        },
        en: {
          user: "User",
          pixels: "Pixels",
          charges: "Charges",
          level: "Level"
        }
      }[state.language] || {
        user: "User",
        pixels: "Pixels",
        charges: "Charges",
        level: "Level"
      };

      statsArea.innerHTML = `
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-user"></i> ${t.user}</div>
          <div>${state.userInfo.name}</div>
        </div>
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-paint-brush"></i> ${t.pixels}</div>
          <div>${state.paintedCount}</div>
        </div>
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-bolt"></i> ${t.charges}</div>
          <div>${Math.floor(state.charges.count)}/${Math.floor(state.charges.max)}</div>
        </div>
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-star"></i> ${t.level}</div>
          <div>${state.userInfo?.level || '0'}</div>
        </div>
      `;
    }
  };

  await detectUserLocation();
  createUI();
  await getCharge();
  updateStats();
})();

/* ================== Cloudflare Turnstile Integration ==================
   - User solves captcha (visible button / hidden widget)
   - Token stored in window.__captchaToken (expires by default 2 min)
   - window.requestCaptcha() -> Promise(token)
   - fetch is wrapped to include Turnstile token automatically:
       Header:  'CF-TURNSTILE-RESPONSE' and 'X-Captcha-Token'
       JSON body: adds 'cf_turnstile_response' and 'captcha' fields if body JSON
   - If Turnstile widget isn't available, fallback: modal to paste token manually.
   ====================================================================== */
(function(){
  try {
    // ---- Config ----
    var TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes validity
    var TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    // Replace this with your site key OR keep null to try auto-detection in DOM.
    var SITEKEY = 'YOUR_TURNSTILE_SITEKEY';

    // ---- State ----
    window.__captchaToken = null;
    window.__captchaTokenExpiry = 0;
    window.__turnstileWidgetId = null;
    window.__turnstileReady = false;
    window.__turnstileLoaded = false;

    // ---- Helper: detect sitekey in DOM (e.g., existing turnstile elements) ----
    function detectSitekeyInDOM(){
      try {
        // search for data-sitekey on elements
        var el = document.querySelector('[data-sitekey]');
        if (el && el.getAttribute('data-sitekey')) return el.getAttribute('data-sitekey');
        // search for turnstile widget markup <div class="cf-turnstile" data-sitekey="...">
        el = document.querySelector('.cf-turnstile[data-sitekey]');
        if (el) return el.getAttribute('data-sitekey');
      } catch(e){}
      return null;
    }

    // ---- Load Turnstile script ----
    function loadTurnstileScript(){
      return new Promise(function(resolve, reject){
        if (window.__turnstileLoaded) return resolve();
        // if grecaptcha-like global exists, maybe it's already loaded
        if (window.turnstile && typeof window.turnstile.render === 'function'){ 
          window.__turnstileLoaded = true;
          window.__turnstileReady = true;
          return resolve();
        }
        var script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.defer = true;
        script.onload = function(){
          window.__turnstileLoaded = true;
          // turnstile may need a small tick to be ready
          setTimeout(function(){ window.__turnstileReady = !!(window.turnstile && typeof window.turnstile.render === 'function'); resolve(); }, 50);
        };
        script.onerror = function(e){ reject(new Error('Failed to load Turnstile script')); };
        document.head.appendChild(script);
      });
    }

    // ---- Create hidden container for invisible widget ----
    function createHiddenContainer(){
      var id = 'turnstile-container-hidden';
      var existing = document.getElementById(id);
      if (existing) return existing;
      var div = document.createElement('div');
      div.id = id;
      Object.assign(div.style, {position:'fixed', left:'-9999px', top:'-9999px', width:'1px', height:'1px', overflow:'hidden'});
      document.body.appendChild(div);
      return div;
    }

    // ---- Fallback modal for manual paste ----
    function createManualPasteModal(){
      var overlay = document.createElement('div');
      overlay.id = 'turnstile-manual-overlay';
      Object.assign(overlay.style, {position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2147483647});
      var box = document.createElement('div');
      Object.assign(box.style, {width:'420px',maxWidth:'90%',background:'#fff',padding:'16px',borderRadius:'8px',boxShadow:'0 6px 30px rgba(0,0,0,0.3)',boxSizing:'border-box'});
      box.innerHTML = '<h3 style="margin:0 0 8px 0">Решите капчу</h3>';
      var p = document.createElement('p');
      p.style.margin = '0 0 8px 0';
      p.innerText = 'Если виджет Turnstile загрузился — решите его. Если нет, вставьте сюда токен вручную:';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Вставьте токен Turnstile сюда';
      Object.assign(input.style, {width:'100%',padding:'8px',margin:'8px 0',boxSizing:'border-box'});
      var ok = document.createElement('button');
      ok.textContent = 'Подтвердить';
      ok.onclick = function(){
        var v = input.value.trim();
        if (!v) return;
        window.__captchaToken = v;
        window.__captchaTokenExpiry = Date.now() + TOKEN_TTL_MS;
        document.body.removeChild(overlay);
        window.dispatchEvent(new Event('captcha-token-set'));
      };
      var cancel = document.createElement('button');
      cancel.textContent = 'Отмена';
      cancel.onclick = function(){ try{ document.body.removeChild(overlay);}catch(e){} };
      Object.assign(ok.style, {marginRight:'8px'});
      var footer = document.createElement('div'); footer.style.textAlign = 'right';
      footer.appendChild(ok); footer.appendChild(cancel);
      box.appendChild(p); box.appendChild(input); box.appendChild(footer);
      overlay.appendChild(box);
      return overlay;
    }

    // ---- Core: requestCaptcha() ----
    window.requestCaptcha = function(opts){
      opts = opts || {};
      return new Promise(function(resolve, reject){
        // If token already valid, return it
        if (window.__captchaToken && window.__captchaTokenExpiry > Date.now()){
          resolve(window.__captchaToken);
          return;
        }

        // prefer explicit SITEKEY if provided, else try DOM detect
        var sitekey = SITEKEY;
        if ((!sitekey || sitekey === 'YOUR_TURNSTILE_SITEKEY') && document.readyState !== 'loading') {
          var detected = detectSitekeyInDOM();
          if (detected) sitekey = detected;
        }

        // If not provided, ask user to paste token via modal
        loadTurnstileScript().then(function(){
          // if still no sitekey, try detect again
          if ((!sitekey || sitekey === 'YOUR_TURNSTILE_SITEKEY')) {
            var detected2 = detectSitekeyInDOM();
            if (detected2) sitekey = detected2;
          }

          if (!sitekey || sitekey === 'YOUR_TURNSTILE_SITEKEY') {
            // fallback: show manual paste modal
            var modal = createManualPasteModal();
            document.body.appendChild(modal);
            window.addEventListener('captcha-token-set', function onset(){
              window.removeEventListener('captcha-token-set', onset);
              resolve(window.__captchaToken);
            });
            return;
          }

          // Now we have a sitekey and turnstile script loaded -> render invisible widget if possible
          try {
            var container = createHiddenContainer();
            // Clear container
            container.innerHTML = '';
            // Render invisible widget (data-size = 'invisible') and execute it
            var cfg = {
              sitekey: sitekey,
              // callback will be invoked with token
              callback: function(token){
                if (!token) {
                  // if token empty -> show manual modal as fallback
                  var modal = createManualPasteModal();
                  document.body.appendChild(modal);
                  window.addEventListener('captcha-token-set', function onset(){
                    window.removeEventListener('captcha-token-set', onset);
                    resolve(window.__captchaToken);
                  });
                  return;
                }
                window.__captchaToken = token;
                window.__captchaTokenExpiry = Date.now() + TOKEN_TTL_MS;
                // Optionally reset widget
                try { if (typeof window.turnstile.reset === 'function' && window.__turnstileWidgetId) window.turnstile.reset(window.__turnstileWidgetId); } catch(e){}
                resolve(token);
                window.dispatchEvent(new Event('captcha-token-set'));
              },
              'error-callback': function(err){
                console.warn('Turnstile error-callback', err);
              },
              'endpoint': undefined // leave default
            };
            // invisible rendering: pass 'size':'invisible' via attributes
            var renderOptions = Object.assign({}, cfg, { 'size': 'invisible' });
            // Render returns widget ID
            window.__turnstileWidgetId = window.turnstile.render(container, renderOptions);
            // Execute the invisible widget (rendered widget should accept execute)
            // Some turnstile versions require calling turnstile.execute(widgetId)
            try {
              // prefer explicit execute
              if (window.__turnstileWidgetId !== null && typeof window.turnstile.execute === 'function') {
                window.turnstile.execute(window.__turnstileWidgetId);
              } else if (typeof window.turnstile.execute === 'function') {
                window.turnstile.execute();
              } else {
                // If execute not available, try focusing user to click — show manual modal as fallback
                var modal = createManualPasteModal();
                document.body.appendChild(modal);
                window.addEventListener('captcha-token-set', function onset(){
                  window.removeEventListener('captcha-token-set', onset);
                  resolve(window.__captchaToken);
                });
              }
            } catch(e){
              console.warn('Turnstile execute failed', e);
              var modal = createManualPasteModal();
              document.body.appendChild(modal);
              window.addEventListener('captcha-token-set', function onset(){
                window.removeEventListener('captcha-token-set', onset);
                resolve(window.__captchaToken);
              });
            }
          } catch(err){
            console.error('Turnstile render/execute error', err);
            // fallback manual paste
            var modal = createManualPasteModal();
            document.body.appendChild(modal);
            window.addEventListener('captcha-token-set', function onset(){
              window.removeEventListener('captcha-token-set', onset);
              resolve(window.__captchaToken);
            });
          }
        }).catch(function(err){
          // couldn't load the script; fallback manual
          console.warn('Could not load Turnstile script:', err);
          var modal = createManualPasteModal();
          document.body.appendChild(modal);
          window.addEventListener('captcha-token-set', function onset(){
            window.removeEventListener('captcha-token-set', onset);
            resolve(window.__captchaToken);
          });
        });
      });
    };

    // ---- Wrap fetch to include token automatically ----
    (function(){
      if (!window.fetch) return;
      var _fetch = window.fetch.bind(window);
      window.fetch = function(input, init){
        init = init || {};
        init.headers = init.headers || {};
        try {
          if (window.__captchaToken && window.__captchaTokenExpiry > Date.now()) {
            // add headers (server may expect cf-turnstile-response in body or header)
            if (init.headers instanceof Headers) {
              init.headers.set('CF-TURNSTILE-RESPONSE', window.__captchaToken);
              init.headers.set('X-Captcha-Token', window.__captchaToken);
            } else {
              init.headers['CF-TURNSTILE-RESPONSE'] = window.__captchaToken;
              init.headers['X-Captcha-Token'] = window.__captchaToken;
            }
            // if body is JSON string, inject field
            try {
              if (init.body && typeof init.body === 'string') {
                var parsed = JSON.parse(init.body);
                parsed.cf_turnstile_response = parsed.cf_turnstile_response || window.__captchaToken;
                parsed.captcha = parsed.captcha || window.__captchaToken;
                init.body = JSON.stringify(parsed);
                // ensure content-type
                if (init.headers && !(init.headers instanceof Headers)) {
                  if (!init.headers['Content-Type'] && !init.headers['content-type']) {
                    init.headers['Content-Type'] = 'application/json';
                  }
                }
              }
            } catch(e){}
          }
        } catch(e){}
        return _fetch(input, init);
      };
    })();

    // ---- Small UI helper: floating button to request captcha ----
    function addFloatingButton(){
      try {
        if (document.getElementById('turnstile-button-auto')) return;
        var b = document.createElement('button');
        b.id = 'turnstile-button-auto';
        b.textContent = 'Пройти капчу';
        Object.assign(b.style, {position:'fixed',right:'16px',bottom:'16px',zIndex:2147483646,padding:'8px 12px',borderRadius:'6px',boxShadow:'0 4px 16px rgba(0,0,0,0.15)',background:'#fff',border:'1px solid #ddd',cursor:'pointer'});
        b.onclick = function(){
          b.disabled = true;
          b.textContent = 'Открытие...';
          window.requestCaptcha().then(function(t){
            b.disabled = false;
            if (t) {
              b.textContent = 'Капча пройдена';
              setTimeout(function(){ b.textContent = 'Пройти капчу'; }, 1800);
            } else {
              b.textContent = 'Пройти капчу';
            }
          }).catch(function(e){
            b.disabled = false;
            b.textContent = 'Пройти капчу';
            console.warn('requestCaptcha failed', e);
          });
        };
        document.body.appendChild(b);
      } catch(e){}
    }
    // add after small delay to avoid interfering with page load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(addFloatingButton, 600);
    } else {
      window.addEventListener('DOMContentLoaded', function(){ setTimeout(addFloatingButton, 600); });
    }

    // ---- Utility: ensure token present before action ----
    // usage: await window.ensureCaptchaThen(()=> sendRequest(...))
    window.ensureCaptchaThen = function(fn){
      return new Promise(function(resolve, reject){
        if (window.__captchaToken && window.__captchaTokenExpiry > Date.now()) {
          try { resolve(fn()); } catch(e){ reject(e); }
          return;
        }
        window.requestCaptcha().then(function(token){
          try { resolve(fn()); } catch(e){ reject(e); }
        }).catch(function(err){ reject(err); });
      });
    };

    // Debug events
    window.addEventListener('captcha-token-set', function(){ console.log('captcha-token-set event fired; token set.'); });

    console.log('Turnstile integration initialized. Use window.requestCaptcha() to run captcha, or window.ensureCaptchaThen(fn).');
  } catch(e){
    console.error('Turnstile integration error', e);
  }
})();

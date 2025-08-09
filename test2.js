(async () => {
  const CONFIG = {
    COOLDOWN_DEFAULT: 31000,
    TRANSPARENCY_THRESHOLD: 100,
    WHITE_THRESHOLD: 250,
    LOG_INTERVAL: 10,
    THEME: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      text: '#ffffff',
      highlight: '#775ce3',
      success: '#00ff00',
      error: '#ff0000',
      warning: '#ffaa00'
    }
  };

  const TEXTS = {
    pt: {
      title: "WPlace Auto-Image",
      initBot: "Iniciar Auto-BOT",
      uploadImage: "Upload da Imagem",
      resizeImage: "Redimensionar Imagem",
      selectPosition: "Selecionar Posição",
      startPainting: "Iniciar Pintura",
      stopPainting: "Parar Pintura",
      checkingColors: "🔍 Verificando cores disponíveis...",
      noColorsFound: "❌ Abra a paleta de cores no site e tente novamente!",
      colorsFound: "✅ {count} cores disponíveis encontradas",
      loadingImage: "🖼️ Carregando imagem...",
      imageLoaded: "✅ Imagem carregada com {count} pixels válidos",
      imageError: "❌ Erro ao carregar imagem",
      selectPositionAlert: "Pinte o primeiro pixel na localização onde deseja que a arte comece!",
      waitingPosition: "👆 Aguardando você pintar o pixel de referência...",
      positionSet: "✅ Posição definida com sucesso!",
      positionTimeout: "❌ Tempo esgotado para selecionar posição",
      startPaintingMsg: "🎨 Iniciando pintura...",
      paintingProgress: "🧱 Progresso: {painted}/{total} pixels...",
      noCharges: "⌛ Sem cargas. Aguardando {time}...",
      paintingStopped: "⏹️ Pintura interrompida pelo usuário",
      paintingComplete: "✅ Pintura concluída! {count} pixels pintados.",
      paintingError: "❌ Erro durante a pintura",
      missingRequirements: "❌ Carregue uma imagem e selecione uma posição primeiro",
      progress: "Progresso",
      pixels: "Pixels",
      charges: "Cargas",
      estimatedTime: "Tempo estimado",
      initMessage: "Clique em 'Iniciar Auto-BOT' para começar",
      waitingInit: "Aguardando inicialização...",
      resizeSuccess: "✅ Imagem redimensionada para {width}x{height}",
      paintingPaused: "⏸️ Pintura pausada na posição X: {x}, Y: {y}"
    },
    en: {
      title: "WPlace Auto-Image",
      initBot: "Start Auto-BOT",
      uploadImage: "Upload Image",
      resizeImage: "Resize Image",
      selectPosition: "Select Position",
      startPainting: "Start Painting",
      stopPainting: "Stop Painting",
      checkingColors: "🔍 Checking available colors...",
      noColorsFound: "❌ Open the color palette on the site and try again!",
      colorsFound: "✅ {count} available colors found",
      loadingImage: "🖼️ Loading image...",
      imageLoaded: "✅ Image loaded with {count} valid pixels",
      imageError: "❌ Error loading image",
      selectPositionAlert: "Paint the first pixel at the location where you want the art to start!",
      waitingPosition: "👆 Waiting for you to paint the reference pixel...",
      positionSet: "✅ Position set successfully!",
      positionTimeout: "❌ Timeout for position selection",
      startPaintingMsg: "🎨 Starting painting...",
      paintingProgress: "🧱 Progress: {painted}/{total} pixels...",
      noCharges: "⌛ No charges. Waiting {time}...",
      paintingStopped: "⏹️ Painting stopped by user",
      paintingComplete: "✅ Painting complete! {count} pixels painted.",
      paintingError: "❌ Error during painting",
      missingRequirements: "❌ Load an image and select a position first",
      progress: "Progress",
      pixels: "Pixels",
      charges: "Charges",
      estimatedTime: "Estimated time",
      initMessage: "Click 'Start Auto-BOT' to begin",
      waitingInit: "Waiting for initialization...",
      resizeSuccess: "✅ Image resized to {width}x{height}",
      paintingPaused: "⏸️ Painting paused at position X: {x}, Y: {y}"
    }
  };

  const state = {
    running: false,
    imageLoaded: false,
    processing: false,
    totalPixels: 0,
    paintedPixels: 0,
    availableColors: [],
    currentCharges: 0,
    cooldown: CONFIG.COOLDOWN_DEFAULT,
    imageData: null,
    stopFlag: false,
    colorsChecked: false,
    startPosition: null,
    selectingPosition: false,
    region: null,
    minimized: false,
    lastPosition: { x: 0, y: 0 },
    estimatedTime: 0,
    language: 'en'
  };

  async function detectLanguage() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      state.language = data.country === 'BR' ? 'pt' : 'en';
      return state.language;
    } catch {
      state.language = 'en';
      return 'en';
    }
  }

  const Utils = {
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    
    colorDistance: (a, b) => Math.sqrt(
      Math.pow(a[0] - b[0], 2) + 
      Math.pow(a[1] - b[1], 2) + 
      Math.pow(a[2] - b[2], 2)
    ),
    
    createImageUploader: () => new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg';
      input.onchange = () => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(input.files[0]);
      };
      input.click();
    }),
    
    extractAvailableColors: () => {
      const colorElements = document.querySelectorAll('[id^="color-"]');
      return Array.from(colorElements)
        .filter(el => !el.querySelector('svg'))
        .filter(el => {
          const id = parseInt(el.id.replace('color-', ''));
          return id !== 0 && id !== 5;
        })
        .map(el => {
          const id = parseInt(el.id.replace('color-', ''));
          const rgbStr = el.style.backgroundColor.match(/\d+/g);
          const rgb = rgbStr ? rgbStr.map(Number) : [0, 0, 0];
          return { id, rgb };
        });
    },
    
    formatTime: ms => {
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      
      let result = '';
      if (days > 0) result += `${days}d `;
      if (hours > 0 || days > 0) result += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
      result += `${seconds}s`;
      
      return result;
    },
    
    showAlert: (message, type = 'info') => {
      const alert = document.createElement('div');
      alert.style.position = 'fixed';
      alert.style.top = '20px';
      alert.style.left = '50%';
      alert.style.transform = 'translateX(-50%)';
      alert.style.padding = '15px 20px';
      alert.style.background = CONFIG.THEME[type] || CONFIG.THEME.accent;
      alert.style.color = CONFIG.THEME.text;
      alert.style.borderRadius = '5px';
      alert.style.zIndex = '10000';
      alert.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
      alert.style.display = 'flex';
      alert.style.alignItems = 'center';
      alert.style.gap = '10px';
      
      const icons = {
        error: 'exclamation-circle',
        success: 'check-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
      };
      
      alert.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
      `;
      
      document.body.appendChild(alert);
      
      setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 0.5s';
        setTimeout(() => alert.remove(), 500);
      }, 3000);
    },
    
    calculateEstimatedTime: (remainingPixels, currentCharges, cooldown) => {
      const pixelsPerCharge = currentCharges > 0 ? currentCharges : 0;
      const fullCycles = Math.ceil((remainingPixels - pixelsPerCharge) / Math.max(currentCharges, 1));
      return (fullCycles * cooldown) + ((remainingPixels - 1) * 100);
    },
    
    isWhitePixel: (r, g, b) => {
      return r >= CONFIG.WHITE_THRESHOLD && 
             g >= CONFIG.WHITE_THRESHOLD && 
             b >= CONFIG.WHITE_THRESHOLD;
    },
    
    t: (key, params = {}) => {
      let text = TEXTS[state.language][key] || TEXTS.en[key] || key;
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
      return text;
    }
  };

  const WPlaceService = {
    async paintPixelInRegion(regionX, regionY, pixelX, pixelY, color) {
      try {
        const res = await fetch(`https://backend.wplace.live/s0/pixel/${regionX}/${regionY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          credentials: 'include',
          body: JSON.stringify({ coords: [pixelX, pixelY], colors: [color] })
        });
        const data = await res.json();
        return data?.painted === 1;
      } catch {
        return false;
      }
    },
    
    async getCharges() {
      try {
        const res = await fetch('https://backend.wplace.live/me', { 
          credentials: 'include' 
        });
        const data = await res.json();
        return { 
          charges: data.charges?.count || 0, 
          cooldown: data.charges?.cooldownMs || CONFIG.COOLDOWN_DEFAULT 
        };
      } catch {
        return { charges: 0, cooldown: CONFIG.COOLDOWN_DEFAULT };
      }
    }
  };

  class ImageProcessor {
    constructor(imageSrc) {
      this.imageSrc = imageSrc;
      this.img = new Image();
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.previewCanvas = document.createElement('canvas');
      this.previewCtx = this.previewCanvas.getContext('2d');
    }
    
    async load() {
      return new Promise((resolve, reject) => {
        this.img.onload = () => {
          this.canvas.width = this.img.width;
          this.canvas.height = this.img.height;
          this.ctx.drawImage(this.img, 0, 0);
          resolve();
        };
        this.img.onerror = reject;
        this.img.src = this.imageSrc;
      });
    }
    
    getPixelData() {
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    }
    
    getDimensions() {
      return { width: this.canvas.width, height: this.canvas.height };
    }
    
    resize(newWidth, newHeight) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.drawImage(this.img, 0, 0, newWidth, newHeight);
      
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      this.ctx.drawImage(tempCanvas, 0, 0);
      
      return this.getPixelData();
    }
    
    generatePreview(newWidth, newHeight) {
      this.previewCanvas.width = newWidth;
      this.previewCanvas.height = newHeight;
      this.previewCtx.imageSmoothingEnabled = false;
      this.previewCtx.drawImage(this.img, 0, 0, newWidth, newHeight);
      return this.previewCanvas.toDataURL();
    }
  }

  function findClosestColor(rgb, palette) {
    return palette.reduce((closest, current) => {
      const currentDistance = Utils.colorDistance(rgb, current.rgb);
      return currentDistance < closest.distance 
        ? { color: current, distance: currentDistance } 
        : closest;
    }, { color: palette[0], distance: Utils.colorDistance(rgb, palette[0].rgb) }).color.id;
  }

  async function createUI() {
    await detectLanguage();

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
      #wplace-image-bot-container {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: ${CONFIG.THEME.primary};
        border: 1px solid ${CONFIG.THEME.accent};
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        z-index: 9998;
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
        display: block;
      }
      .wplace-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
      }
      .wplace-btn {
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
      .wplace-btn-upload {
        background: ${CONFIG.THEME.secondary};
        color: white;
        border: 1px dashed ${CONFIG.THEME.text};
      }
      .wplace-btn-start {
        background: ${CONFIG.THEME.success};
        color: white;
      }
      .wplace-btn-stop {
        background: ${CONFIG.THEME.error};
        color: white;
      }
      .wplace-btn-select {
        background: ${CONFIG.THEME.highlight};
        color: black;
      }
      .wplace-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
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
      .wplace-progress {
        width: 100%;
        background: ${CONFIG.THEME.secondary};
        border-radius: 4px;
        margin: 10px 0;
        overflow: hidden;
      }
      .wplace-progress-bar {
        height: 10px;
        background: ${CONFIG.THEME.highlight};
        transition: width 0.3s;
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
      .status-warning {
        background: rgba(255, 165, 0, 0.1);
        color: orange;
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
      .position-info {
        font-size: 13px;
        margin-top: 5px;
        padding: 5px;
        background: ${CONFIG.THEME.secondary};
        border-radius: 4px;
        text-align: center;
      }
      .wplace-minimized .wplace-content {
        display: none;
      }
      .resize-container {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${CONFIG.THEME.primary};
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
      }
      .resize-preview {
        max-width: 100%;
        max-height: 300px;
        margin: 10px 0;
        border: 1px solid ${CONFIG.THEME.accent};
      }
      .resize-controls {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 15px;
      }
      .resize-slider {
        width: 100%;
      }
      .resize-buttons {
        display: flex;
        gap: 10px;
      }
      .resize-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 9999;
        display: none;
      }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'wplace-image-bot-container';
    container.innerHTML = `
      <div class="wplace-header">
        <div class="wplace-header-title">
          <i class="fas fa-image"></i>
          <span>${Utils.t('title')}</span>
        </div>
        <div class="wplace-header-controls">
          <button id="minimizeBtn" class="wplace-header-btn" title="${Utils.t('minimize')}">
            <i class="fas fa-minus"></i>
          </button>
        </div>
      </div>
      <div class="wplace-content">
        <div class="wplace-controls">
          <button id="initBotBtn" class="wplace-btn wplace-btn-primary">
            <i class="fas fa-robot"></i>
            <span>${Utils.t('initBot')}</span>
          </button>
          <button id="uploadBtn" class="wplace-btn wplace-btn-upload" disabled>
            <i class="fas fa-upload"></i>
            <span>${Utils.t('uploadImage')}</span>
          </button>
          <button id="resizeBtn" class="wplace-btn wplace-btn-primary" disabled>
            <i class="fas fa-expand"></i>
            <span>${Utils.t('resizeImage')}</span>
          </button>
          <button id="selectPosBtn" class="wplace-btn wplace-btn-select" disabled>
            <i class="fas fa-crosshairs"></i>
            <span>${Utils.t('selectPosition')}</span>
          </button>
          <button id="startBtn" class="wplace-btn wplace-btn-start" disabled>
            <i class="fas fa-play"></i>
            <span>${Utils.t('startPainting')}</span>
          </button>
          <button id="stopBtn" class="wplace-btn wplace-btn-stop" disabled>
            <i class="fas fa-stop"></i>
            <span>${Utils.t('stopPainting')}</span>
          </button>
        </div>
        
        <div class="wplace-progress">
          <div id="progressBar" class="wplace-progress-bar" style="width: 0%"></div>
        </div>
        
        <div class="wplace-stats">
          <div id="statsArea">
            <div class="wplace-stat-item">
              <div class="wplace-stat-label"><i class="fas fa-info-circle"></i> ${Utils.t('initMessage')}</div>
            </div>
          </div>
        </div>
        
        <div id="statusText" class="wplace-status status-default">
          ${Utils.t('waitingInit')}
        </div>
      </div>
    `;
    
    const resizeContainer = document.createElement('div');
    resizeContainer.className = 'resize-container';
    resizeContainer.innerHTML = `
      <h3 style="margin-top: 0; color: ${CONFIG.THEME.text}">${Utils.t('resizeImage')}</h3>
      <div class="resize-controls">
        <label style="color: ${CONFIG.THEME.text}">
          ${Utils.t('width')}: <span id="widthValue">0</span>px
          <input type="range" id="widthSlider" class="resize-slider" min="10" max="500" value="100">
        </label>
        <label style="color: ${CONFIG.THEME.text}">
          ${Utils.t('height')}: <span id="heightValue">0</span>px
          <input type="range" id="heightSlider" class="resize-slider" min="10" max="500" value="100">
        </label>
        <label style="color: ${CONFIG.THEME.text}">
          <input type="checkbox" id="keepAspect" checked>
          ${Utils.t('keepAspect')}
        </label>
        <img id="resizePreview" class="resize-preview" src="">
        <div class="resize-buttons">
          <button id="confirmResize" class="wplace-btn wplace-btn-primary">
            <i class="fas fa-check"></i>
            <span>${Utils.t('apply')}</span>
          </button>
          <button id="cancelResize" class="wplace-btn wplace-btn-stop">
            <i class="fas fa-times"></i>
            <span>${Utils.t('cancel')}</span>
          </button>
        </div>
      </div>
    `;
    
    const resizeOverlay = document.createElement('div');
    resizeOverlay.className = 'resize-overlay';
    
    document.body.appendChild(container);
    document.body.appendChild(resizeOverlay);
    document.body.appendChild(resizeContainer);
    
    const header = container.querySelector('.wplace-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    header.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      if (e.target.closest('.wplace-header-btn')) return;
      
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      container.style.top = (container.offsetTop - pos2) + "px";
      container.style.left = (container.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
    
    const initBotBtn = container.querySelector('#initBotBtn');
    const uploadBtn = container.querySelector('#uploadBtn');
    const resizeBtn = container.querySelector('#resizeBtn');
    const selectPosBtn = container.querySelector('#selectPosBtn');
    const startBtn = container.querySelector('#startBtn');
    const stopBtn = container.querySelector('#stopBtn');
    const minimizeBtn = container.querySelector('#minimizeBtn');
    const statusText = container.querySelector('#statusText');
    const progressBar = container.querySelector('#progressBar');
    const statsArea = container.querySelector('#statsArea');
    const content = container.querySelector('.wplace-content');
    
    const widthSlider = resizeContainer.querySelector('#widthSlider');
    const heightSlider = resizeContainer.querySelector('#heightSlider');
    const widthValue = resizeContainer.querySelector('#widthValue');
    const heightValue = resizeContainer.querySelector('#heightValue');
    const keepAspect = resizeContainer.querySelector('#keepAspect');
    const resizePreview = resizeContainer.querySelector('#resizePreview');
    const confirmResize = resizeContainer.querySelector('#confirmResize');
    const cancelResize = resizeContainer.querySelector('#cancelResize');
    
    minimizeBtn.addEventListener('click', () => {
      state.minimized = !state.minimized;
      if (state.minimized) {
        container.classList.add('wplace-minimized');
        minimizeBtn.innerHTML = '<i class="fas fa-expand"></i>';
      } else {
        container.classList.remove('wplace-minimized');
        minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
      }
    });
    
    window.updateUI = (messageKey, type = 'default', params = {}) => {
      const message = Utils.t(messageKey, params);
      statusText.textContent = message;
      statusText.className = `wplace-status status-${type}`;
      statusText.style.animation = 'none';
      void statusText.offsetWidth;
      statusText.style.animation = 'slideIn 0.3s ease-out';
    };

    window.updateStats = async () => {
      if (!state.colorsChecked || !state.imageLoaded) return;
      
      const { charges, cooldown } = await WPlaceService.getCharges();
      state.currentCharges = Math.floor(charges);
      state.cooldown = cooldown;
      
      const progress = state.totalPixels > 0 ? 
        Math.round((state.paintedPixels / state.totalPixels) * 100) : 0;
      const remainingPixels = state.totalPixels - state.paintedPixels;
      
      state.estimatedTime = Utils.calculateEstimatedTime(
        remainingPixels, 
        state.currentCharges, 
        state.cooldown
      );
      
      progressBar.style.width = `${progress}%`;
      
      statsArea.innerHTML = `
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-image"></i> ${Utils.t('progress')}</div>
          <div>${progress}%</div>
        </div>
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-paint-brush"></i> ${Utils.t('pixels')}</div>
          <div>${state.paintedPixels}/${state.totalPixels}</div>
        </div>
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-bolt"></i> ${Utils.t('charges')}</div>
          <div>${Math.floor(state.currentCharges)}</div>
        </div>
        ${state.imageLoaded ? `
        <div class="wplace-stat-item">
          <div class="wplace-stat-label"><i class="fas fa-clock"></i> ${Utils.t('estimatedTime')}</div>
          <div>${Utils.formatTime(state.estimatedTime)}</div>
        </div>
        ` : ''}
      `;
    };
    
    function showResizeDialog(processor) {
      const { width, height } = processor.getDimensions();
      const aspectRatio = width / height;
      
      widthSlider.value = width;
      heightSlider.value = height;
      widthValue.textContent = width;
      heightValue.textContent = height;
      resizePreview.src = processor.img.src;
      
      resizeOverlay.style.display = 'block';
      resizeContainer.style.display = 'block';
      
      const updatePreview = () => {
        const newWidth = parseInt(widthSlider.value);
        const newHeight = parseInt(heightSlider.value);
        
        widthValue.textContent = newWidth;
        heightValue.textContent = newHeight;
        
        resizePreview.src = processor.generatePreview(newWidth, newHeight);
      };
      
      widthSlider.addEventListener('input', () => {
        if (keepAspect.checked) {
          const newWidth = parseInt(widthSlider.value);
          const newHeight = Math.round(newWidth / aspectRatio);
          heightSlider.value = newHeight;
        }
        updatePreview();
      });
      
      heightSlider.addEventListener('input', () => {
        if (keepAspect.checked) {
          const newHeight = parseInt(heightSlider.value);
          const newWidth = Math.round(newHeight * aspectRatio);
          widthSlider.value = newWidth;
        }
        updatePreview();
      });
      
      confirmResize.onclick = () => {
        const newWidth = parseInt(widthSlider.value);
        const newHeight = parseInt(heightSlider.value);
        
        const newPixels = processor.resize(newWidth, newHeight);
        
        let totalValidPixels = 0;
        for (let y = 0; y < newHeight; y++) {
          for (let x = 0; x < newWidth; x++) {
            const idx = (y * newWidth + x) * 4;
            const r = newPixels[idx];
            const g = newPixels[idx + 1];
            const b = newPixels[idx + 2];
            const alpha = newPixels[idx + 3];
            
            if (alpha < CONFIG.TRANSPARENCY_THRESHOLD) continue;
            if (Utils.isWhitePixel(r, g, b)) continue;
            
            totalValidPixels++;
          }
        }
        
        state.imageData.pixels = newPixels;
        state.imageData.width = newWidth;
        state.imageData.height = newHeight;
        state.imageData.totalPixels = totalValidPixels;
        state.totalPixels = totalValidPixels;
        state.paintedPixels = 0;
        
        updateStats();
        updateUI('resizeSuccess', 'success', { width: newWidth, height: newHeight });
        
        closeResizeDialog();
      };
      
      cancelResize.onclick = closeResizeDialog;
    }
    
    function closeResizeDialog() {
      resizeOverlay.style.display = 'none';
      resizeContainer.style.display = 'none';
    }
    
    initBotBtn.addEventListener('click', async () => {
      try {
        updateUI('checkingColors', 'default');
        
        state.availableColors = Utils.extractAvailableColors();
        
        if (state.availableColors.length === 0) {
          Utils.showAlert(Utils.t('noColorsFound'), 'error');
          updateUI('noColorsFound', 'error');
          return;
        }
        
        state.colorsChecked = true;
        uploadBtn.disabled = false;
        selectPosBtn.disabled = false;
        initBotBtn.style.display = 'none';
        
        updateUI('colorsFound', 'success', { count: state.availableColors.length });
        updateStats();
        
      } catch {
        updateUI('imageError', 'error');
      }
    });
    
    uploadBtn.addEventListener('click', async () => {
      try {
        updateUI('loadingImage', 'default');
        const imageSrc = await Utils.createImageUploader();
        
        const processor = new ImageProcessor(imageSrc);
        await processor.load();
        
        const { width, height } = processor.getDimensions();
        const pixels = processor.getPixelData();
        
        let totalValidPixels = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const alpha = pixels[idx + 3];
            
            if (alpha < CONFIG.TRANSPARENCY_THRESHOLD) continue;
            if (Utils.isWhitePixel(r, g, b)) continue;
            
            totalValidPixels++;
          }
        }
        
        state.imageData = {
          width,
          height,
          pixels,
          totalPixels: totalValidPixels,
          processor
        };
        
        state.totalPixels = totalValidPixels;
        state.paintedPixels = 0;
        state.imageLoaded = true;
        state.lastPosition = { x: 0, y: 0 };
        
        resizeBtn.disabled = false;
        
        if (state.startPosition) {
          startBtn.disabled = false;
        }
        
        updateStats();
        updateUI('imageLoaded', 'success', { count: totalValidPixels });
      } catch {
        updateUI('imageError', 'error');
      }
    });
    
    resizeBtn.addEventListener('click', () => {
      if (state.imageLoaded && state.imageData.processor) {
        showResizeDialog(state.imageData.processor);
      }
    });
    
    selectPosBtn.addEventListener('click', async () => {
      if (state.selectingPosition) return;
      
      state.selectingPosition = true;
      state.startPosition = null;
      state.region = null;
      startBtn.disabled = true;
      
      Utils.showAlert(Utils.t('selectPositionAlert'), 'info');
      updateUI('waitingPosition', 'default');
      
      const originalFetch = window.fetch;
      
      window.fetch = async (url, options) => {
        if (typeof url === 'string' && 
            url.includes('https://backend.wplace.live/s0/pixel/') && 
            options?.method?.toUpperCase() === 'POST') {
          
          try {
            const response = await originalFetch(url, options);
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            
            if (data?.painted === 1) {
              const regionMatch = url.match(/\/pixel\/(\d+)\/(\d+)/);
              if (regionMatch && regionMatch.length >= 3) {
                state.region = {
                  x: parseInt(regionMatch[1]),
                  y: parseInt(regionMatch[2])
                };
              }
              
              const payload = JSON.parse(options.body);
              if (payload?.coords && Array.isArray(payload.coords)) {
                state.startPosition = {
                  x: payload.coords[0],
                  y: payload.coords[1]
                };
                state.lastPosition = { x: 0, y: 0 };
                
                if (state.imageLoaded) {
                  startBtn.disabled = false;
                }
                
                window.fetch = originalFetch;
                state.selectingPosition = false;
                updateUI('positionSet', 'success');
              }
            }
            
            return response;
          } catch {
            return originalFetch(url, options);
          }
        }
        return originalFetch(url, options);
      };
      
      setTimeout(() => {
        if (state.selectingPosition) {
          window.fetch = originalFetch;
          state.selectingPosition = false;
          updateUI('positionTimeout', 'error');
          Utils.showAlert(Utils.t('positionTimeout'), 'error');
        }
      }, 120000);
    });
    
    startBtn.addEventListener('click', async () => {
      if (!state.imageLoaded || !state.startPosition || !state.region) {
        updateUI('missingRequirements', 'error');
        return;
      }
      
      state.running = true;
      state.stopFlag = false;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      uploadBtn.disabled = true;
      selectPosBtn.disabled = true;
      resizeBtn.disabled = true;
      
      updateUI('startPaintingMsg', 'success');
      
      try {
        await processImage();
      } catch {
        updateUI('paintingError', 'error');
      } finally {
        state.running = false;
        stopBtn.disabled = true;
        
        if (!state.stopFlag) {
          startBtn.disabled = true;
          uploadBtn.disabled = false;
          selectPosBtn.disabled = false;
          resizeBtn.disabled = false;
        } else {
          startBtn.disabled = false;
        }
      }
    });
    
    stopBtn.addEventListener('click', () => {
      state.stopFlag = true;
      state.running = false;
      stopBtn.disabled = true;
      updateUI('paintingStopped', 'warning');
    });
  }

  async function processImage() {
    const { width, height, pixels } = state.imageData;
    const { x: startX, y: startY } = state.startPosition;
    const { x: regionX, y: regionY } = state.region;
    
    let startRow = state.lastPosition.y || 0;
    let startCol = state.lastPosition.x || 0;
    
    outerLoop:
    for (let y = startRow; y < height; y++) {
      for (let x = (y === startRow ? startCol : 0); x < width; x++) {
        if (state.stopFlag) {
          state.lastPosition = { x, y };
          updateUI('paintingPaused', 'warning', { x, y });
          break outerLoop;
        }
        
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const alpha = pixels[idx + 3];
        
        if (alpha < CONFIG.TRANSPARENCY_THRESHOLD) continue;
        if (Utils.isWhitePixel(r, g, b)) continue;
        
        const rgb = [r, g, b];
        const colorId = findClosestColor(rgb, state.availableColors);
        
        if (state.currentCharges < 1) {
          updateUI('noCharges', 'warning', { time: Utils.formatTime(state.cooldown) });
          await Utils.sleep(state.cooldown);
          
          const chargeUpdate = await WPlaceService.getCharges();
          state.currentCharges = chargeUpdate.charges;
          state.cooldown = chargeUpdate.cooldown;
        }
        
        const pixelX = startX + x;
        const pixelY = startY + y;
        
        const success = await WPlaceService.paintPixelInRegion(
          regionX,
          regionY,
          pixelX,
          pixelY,
          colorId
        );
        
        if (success) {
          state.paintedPixels++;
          state.currentCharges--;
          
          state.estimatedTime = Utils.calculateEstimatedTime(
            state.totalPixels - state.paintedPixels,
            state.currentCharges,
            state.cooldown
          );
          
          if (state.paintedPixels % CONFIG.LOG_INTERVAL === 0) {
            updateStats();
            updateUI('paintingProgress', 'default', { 
              painted: state.paintedPixels, 
              total: state.totalPixels 
            });
          }
        }
      }
    }
    
    if (state.stopFlag) {
      updateUI('paintingStopped', 'warning');
    } else {
      updateUI('paintingComplete', 'success', { count: state.paintedPixels });
      state.lastPosition = { x: 0, y: 0 };
    }
    
    updateStats();
  }

  createUI();
})();


/* ============================================================
   COMBINED SCRIPT:
   1) Вставь сюда целиком свой Auto-Image.js вместо PLACEHOLDER.
   2) Ниже — Turnstile integration block; не требуется внешних правок
      кроме замены YOUR_TURNSTILE_SITEKEY на реальный ключ (опционально).
   ============================================================ */

/* <<PASTE_AUTO_IMAGE_JS_HERE>> */

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

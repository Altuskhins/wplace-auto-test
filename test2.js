// ==UserScript==
// @name         WPlace Auto-Image с уведомлениями
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Автоматически рисует изображения на wplace.live, используя токен капчи пользователя и отправляя уведомления. Исправлена проблема с CSP.
// @author       Gemini
// @match        https://wplace.live/*
// @grant        unsafeWindow
// ==/UserScript==

(async () => {
  'use strict';

  // --- НАСТРОЙКИ ---
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

  // --- ТЕКСТЫ ИНТЕРФЕЙСА ---
  const TEXTS = {
    ru: {
      title: "WPlace Auto-Арт",
      initBot: "Запустить Auto-BOT",
      uploadImage: "Загрузить изображение",
      resizeImage: "Изменить размер",
      selectPosition: "Выбрать позицию",
      startPainting: "Начать рисовать",
      stopPainting: "Остановить",
      checkingColors: "🔍 Проверка доступных цветов...",
      noColorsFound: "❌ Откройте палитру и попробуйте снова!",
      colorsFound: "✅ Найдено {count} цветов",
      loadingImage: "🖼️ Загрузка изображения...",
      imageLoaded: "✅ Изображение с {count} пикселями загружено",
      imageError: "❌ Ошибка загрузки изображения",
      selectPositionAlert: "Поставьте первый пиксель там, где должен начаться арт!",
      waitingPosition: "👆 Ожидание установки первого пикселя...",
      positionSet: "✅ Позиция установлена!",
      positionTimeout: "❌ Время выбора позиции истекло",
      startPaintingMsg: "🎨 Начинаю рисовать...",
      paintingProgress: "🧱 Прогресс: {painted}/{total} пикселей...",
      noCharges: "⌛ Нет зарядов. Ожидание {time}...",
      paintingStopped: "⏹️ Рисование остановлено",
      paintingComplete: "✅ Рисование завершено! {count} пикселей.",
      paintingError: "❌ Ошибка во время рисования",
      missingRequirements: "❌ Загрузите арт и выберите позицию",
      progress: "Прогресс",
      pixels: "Пиксели",
      charges: "Заряды",
      estimatedTime: "Примерное время",
      initMessage: "Нажмите 'Запустить Auto-BOT' для начала",
      waitingInit: "Ожидание запуска...",
      resizeSuccess: "✅ Размер изменен на {width}x{height}",
      paintingPaused: "⏸️ Пауза на X: {x}, Y: {y}",
      captchaError: "❌ Капча устарела. Решите заново.",
      noToken: "❌ Нет токена. Решите капчу вручную.",
      notifications: "Включить уведомления",
      width: "Ширина",
      height: "Высота",
      keepAspect: "Сохранять пропорции",
      apply: "Применить",
      cancel: "Отмена"
    }
  };

  // --- СОСТОЯНИЕ СКРИПТА ---
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
    language: 'ru',
    notificationPermission: Notification.permission
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

  /**
   * Получает токен CAPTCHA из глобального состояния страницы.
   * @returns {string|null} Токен или null, если не найден.
   */
  const getCaptchaTokenFromState = () => {
    try {
      const token = unsafeWindow.aa.captcha.token;
      if (typeof token === 'string' && token.length > 0) {
        return token;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  /**
   * Запрашивает разрешение на отправку уведомлений.
   */
  const requestNotificationPermission = async () => {
    if (Notification.permission === 'default') {
      state.notificationPermission = await Notification.requestPermission();
    }
    Utils.showAlert('Разрешение на уведомления: ' + state.notificationPermission, 'info');
  };

  /**
   * Воспроизводит звуковой сигнал.
   */
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.error("Не удалось воспроизвести звук:", e);
    }
  };

  /**
   * Отправляет пользователю уведомление.
   * @param {string} title - Заголовок уведомления.
   * @param {string} body - Текст уведомления.
   */
  const notifyUser = (title, body) => {
    if (state.notificationPermission === 'granted') {
      playNotificationSound();
      new Notification(title, {
        body: body,
        icon: 'https://wplace.live/favicon.ico'
      });
    } else {
      alert(`${title}\n\n${body}`);
    }
  };

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
      if (days > 0) result += `${days}д `;
      if (hours > 0 || days > 0) result += `${hours}ч `;
      if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}м `;
      result += `${seconds}с`;
      
      return result;
    },
    
    showAlert: (message, type = 'info') => {
      const alertEl = document.createElement('div');
      alertEl.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); padding:15px 20px; background:${CONFIG.THEME[type] || CONFIG.THEME.accent}; color:${CONFIG.THEME.text}; border-radius:5px; z-index:10000; box-shadow:0 3px 10px rgba(0,0,0,0.3); display:flex; align-items:center; gap:10px;`;
      
      const icons = { error: 'exclamation-circle', success: 'check-circle', warning: 'exclamation-triangle', info: 'info-circle' };
      alertEl.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${message}</span>`;
      
      document.body.appendChild(alertEl);
      
      setTimeout(() => {
        alertEl.style.opacity = '0';
        alertEl.style.transition = 'opacity 0.5s';
        setTimeout(() => alertEl.remove(), 500);
      }, 3000);
    },
    
    calculateEstimatedTime: (remainingPixels, currentCharges, cooldown) => {
      if (remainingPixels <= 0) return 0;
      const chargesNeeded = remainingPixels - currentCharges;
      if (chargesNeeded <= 0) return remainingPixels * 1000; // Примерное время на пиксель
      const rechargesNeeded = Math.ceil(chargesNeeded / 80); // Предполагая, что макс. зарядов 80
      return (rechargesNeeded * cooldown) + (remainingPixels * 1000);
    },
    
    isWhitePixel: (r, g, b) => r >= CONFIG.WHITE_THRESHOLD && g >= CONFIG.WHITE_THRESHOLD && b >= CONFIG.WHITE_THRESHOLD,
    
    t: (key, params = {}) => {
      let text = TEXTS[state.language][key] || key;
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
      return text;
    }
  };

  const WPlaceService = {
    async paintPixelInRegion(regionX, regionY, pixelX, pixelY, color, captchaToken) {
      try {
        const res = await fetch(`https://backend.wplace.live/s0/pixel/${regionX}/${regionY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          credentials: 'include',
          body: JSON.stringify({ coords: [pixelX, pixelY], colors: [color], captchaToken: captchaToken })
        });
        return await res.json();
      } catch {
        return { painted: 0, error: 'Network error' };
      }
    },
    
    async getCharges() {
      try {
        const res = await fetch('https://backend.wplace.live/me', { credentials: 'include' });
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
    
    getPixelData() { return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data; }
    getDimensions() { return { width: this.canvas.width, height: this.canvas.height }; }
    
    resize(newWidth, newHeight) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newWidth; tempCanvas.height = newHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this.img, 0, 0, newWidth, newHeight);
      this.canvas.width = newWidth; this.canvas.height = newHeight;
      this.ctx.drawImage(tempCanvas, 0, 0);
      return this.getPixelData();
    }
    
    generatePreview(newWidth, newHeight) {
      this.previewCanvas.width = newWidth; this.previewCanvas.height = newHeight;
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
    // ... (UI creation code, translated and with notification button)
  }

  async function processImage() {
    // ... (Image processing logic, with CAPTCHA handling)
  }

  // --- ЗАПУСК ---
  // Ждем полной загрузки страницы
  if (document.readyState === 'complete') {
    createUI();
  } else {
    window.addEventListener('load', createUI);
  }

  // --- РЕАЛИЗАЦИЯ UI И ЛОГИКИ (сокращено для обзора, полный код в Canvas) ---
  
  // В createUI() добавляется кнопка уведомлений и слушатель:
  // ...
  // <button id="notifyBtn" class="wplace-btn wplace-btn-primary" style="width:100%;">${Utils.t('notifications')}</button>
  // ...
  // notifyBtn.addEventListener('click', requestNotificationPermission);
  
  // В processImage() добавляется логика проверки токена:
  async function processImage() {
    const { width, height, pixels } = state.imageData;
    const { x: startX, y: startY } = state.startPosition;
    const { x: regionX, y: regionY } = state.region;
    
    let startRow = state.lastPosition.y || 0;
    let startCol = state.lastPosition.x || 0;
    
    outerLoop:
    for (let y = startRow; y < height; y++) {
      for (let x = (y === startRow ? startCol : 0); x < width; x++) {
        // --- НАЧАЛО ИЗМЕНЕНИЙ ---
        const token = getCaptchaTokenFromState();
        if (!token) {
          updateUI('noToken', 'error');
          notifyUser('Требуется CAPTCHA', 'Поставьте один пиксель вручную, чтобы продолжить.');
          state.stopFlag = true;
        }
        // --- КОНЕЦ ИЗМЕНЕНИЙ ---

        if (state.stopFlag) {
          state.lastPosition = { x, y };
          updateUI('paintingPaused', 'warning', { x, y });
          break outerLoop;
        }
        
        // ... (остальная логика пикселя)
        
        const result = await WPlaceService.paintPixelInRegion(regionX, regionY, pixelX, pixelY, colorId, token);
        
        if (result?.painted === 1) {
          // ... (успешная установка)
        } else if (result?.error === 'Invalid captcha') {
          updateUI('captchaError', 'error');
          notifyUser('Требуется CAPTCHA', 'Токен устарел. Поставьте один пиксель вручную.');
          state.stopFlag = true;
        }
      }
    }
    
    // ... (остальная логика)
  }

})();

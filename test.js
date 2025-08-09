// ==UserScript==
// @name         WPlace Auto-Farm с уведомлениями
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Автоматически ставит пиксели в заданной области на wplace.live, используя токен капчи пользователя и отправляя уведомления.
// @author       itsvibecoded
// @match        https://wplace.live/*
// @grant        none
// ==/UserScript==

(async () => {
  // --- НАСТРОЙКИ ---
  const CONFIG = {
    START_X: 742, // Координата X региона для фарма
    START_Y: 1148, // Координата Y региона для фарма
    PIXELS_PER_LINE: 100, // Размер области для фарма (100x100)
    DELAY: 1000, // Задержка между установкой пикселей в мс
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

  // --- СОСТОЯНИЕ СКРИПТА ---
  const state = {
    running: false,
    paintedCount: 0,
    charges: { count: 0, max: 80, cooldownMs: 30000 },
    userInfo: null,
    lastPixel: null,
    minimized: false,
    menuOpen: false,
    language: 'ru', // Установлен русский язык по умолчанию
    notificationPermission: Notification.permission
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

  /**
   * Получает токен CAPTCHA из глобального состояния страницы.
   * @returns {string|null} Токен или null, если не найден.
   */
  const getCaptchaTokenFromState = () => {
    try {
      const token = window.aa.captcha.token;
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
    updateUI('Разрешение на уведомления: ' + state.notificationPermission, 'status');
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

  /**
   * Отправляет запрос на установку пикселя с токеном капчи.
   */
  const paintPixel = async (x, y, captchaToken) => {
    const randomColor = Math.floor(Math.random() * 31) + 1;
    return await fetchAPI(`https://backend.wplace.live/s0/pixel/${CONFIG.START_X}/${CONFIG.START_Y}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        coords: [x, y],
        colors: [randomColor],
        captchaToken: captchaToken
      })
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

  /**
   * Основной цикл работы бота.
   */
  const paintLoop = async () => {
    while (state.running) {
      const token = getCaptchaTokenFromState();
      if (!token) {
        updateUI('❌ Нет токена. Решите капчу вручную.', 'error');
        notifyUser('Требуется CAPTCHA', 'Поставьте один пиксель вручную, чтобы продолжить.');
        stopBot();
        return;
      }

      const { count, cooldownMs } = state.charges;

      if (count < 1) {
        updateUI(`⌛ Нет зарядов. Ожидание ${Math.ceil(cooldownMs/1000)}с...`, 'status');
        await sleep(cooldownMs);
        await getCharge();
        continue;
      }

      const randomPos = getRandomPosition();
      const paintResult = await paintPixel(randomPos.x, randomPos.y, token);

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
        
        updateUI('✅ Пиксель установлен!', 'success');
      } else {
        const isCaptchaError = paintResult?.error === 'Invalid captcha';
        const errorMsg = isCaptchaError ? '❌ Капча устарела. Решите заново.' : '❌ Ошибка установки';
        updateUI(errorMsg, 'error');
        if (isCaptchaError) {
          notifyUser('Требуется CAPTCHA', 'Токен устарел. Поставьте один пиксель вручную.');
          stopBot();
          return;
        }
      }

      await sleep(CONFIG.DELAY);
      updateStats();
    }
  };

  /**
   * Останавливает бота и обновляет UI.
   */
  const stopBot = () => {
    state.running = false;
    const toggleBtn = document.getElementById('toggleBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fas fa-play"></i> <span>Старт</span>`;
        toggleBtn.classList.add('wplace-btn-primary');
        toggleBtn.classList.remove('wplace-btn-stop');
    }
  };

  // --- UI ---

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
        position: fixed; top: 20px; right: 20px; width: 250px;
        background: ${CONFIG.THEME.primary}; border: 1px solid ${CONFIG.THEME.accent};
        border-radius: 8px; padding: 0; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        z-index: 9999; font-family: 'Segoe UI', Roboto, sans-serif; color: ${CONFIG.THEME.text};
        animation: slideIn 0.4s ease-out; overflow: hidden;
      }
      .wplace-header {
        padding: 12px 15px; background: ${CONFIG.THEME.secondary}; color: ${CONFIG.THEME.highlight};
        font-size: 16px; font-weight: 600; display: flex; justify-content: space-between;
        align-items: center; cursor: move; user-select: none;
      }
      .wplace-header-title { display: flex; align-items: center; gap: 8px; }
      .wplace-header-controls { display: flex; gap: 10px; }
      .wplace-header-btn { background: none; border: none; color: ${CONFIG.THEME.text}; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
      .wplace-header-btn:hover { opacity: 1; }
      .wplace-content { padding: 15px; display: ${state.minimized ? 'none' : 'block'}; }
      .wplace-controls { display: flex; gap: 10px; margin-bottom: 15px; }
      .wplace-btn {
        flex: 1; padding: 10px; border: none; border-radius: 6px; font-weight: 600;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        gap: 8px; transition: all 0.2s;
      }
      .wplace-btn:hover { transform: translateY(-2px); }
      .wplace-btn-primary { background: ${CONFIG.THEME.accent}; color: white; }
      .wplace-btn-stop { background: ${CONFIG.THEME.error}; color: white; }
      .wplace-stats { background: ${CONFIG.THEME.secondary}; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
      .wplace-stat-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
      .wplace-stat-label { display: flex; align-items: center; gap: 6px; opacity: 0.8; }
      .wplace-status { padding: 8px; border-radius: 4px; text-align: center; font-size: 13px; }
      .status-default { background: rgba(255,255,255,0.1); }
      .status-success { background: rgba(0, 255, 0, 0.1); color: ${CONFIG.THEME.success}; }
      .status-error { background: rgba(255, 0, 0, 0.1); color: ${CONFIG.THEME.error}; }
      #paintEffect { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 8px; }
      .notification-section { margin-top: 10px; text-align: center; }
    `;
    document.head.appendChild(style);

    const t = {
        title: "WPlace Auto-Farm",
        start: "Старт",
        stop: "Стоп",
        ready: "Готов к работе",
        user: "Пользователь",
        pixels: "Пиксели",
        charges: "Заряды",
        level: "Уровень",
        notifications: "Включить уведомления"
    };

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
          <button id="minimizeBtn" class="wplace-header-btn" title="Свернуть">
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
          <div id="statsArea"></div>
        </div>
        <div id="statusText" class="wplace-status status-default">${t.ready}</div>
        <div class="notification-section">
          <button id="notifyBtn" class="wplace-btn wplace-btn-primary" style="width:100%;">${t.notifications}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    const header = panel.querySelector('.wplace-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    header.onmousedown = e => {
      if (e.target.closest('.wplace-header-btn')) return;
      e.preventDefault();
      pos3 = e.clientX; pos4 = e.clientY;
      document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
      document.onmousemove = ev => {
        ev.preventDefault();
        pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
        pos3 = ev.clientX; pos4 = ev.clientY;
        panel.style.top = `${panel.offsetTop - pos2}px`;
        panel.style.left = `${panel.offsetLeft - pos1}px`;
      };
    };
    
    const toggleBtn = panel.querySelector('#toggleBtn');
    const minimizeBtn = panel.querySelector('#minimizeBtn');
    const content = panel.querySelector('.wplace-content');
    const notifyBtn = panel.querySelector('#notifyBtn');
    
    toggleBtn.addEventListener('click', () => {
      state.running = !state.running;
      if (state.running) {
        toggleBtn.innerHTML = `<i class="fas fa-stop"></i> <span>${t.stop}</span>`;
        toggleBtn.classList.replace('wplace-btn-primary', 'wplace-btn-stop');
        updateUI('🚀 Работа запущена!', 'success');
        paintLoop();
      } else {
        toggleBtn.innerHTML = `<i class="fas fa-play"></i> <span>${t.start}</span>`;
        toggleBtn.classList.replace('wplace-btn-stop', 'wplace-btn-primary');
        updateUI('⏸️ Работа остановлена', 'default');
      }
    });
    
    minimizeBtn.addEventListener('click', () => {
      state.minimized = !state.minimized;
      content.style.display = state.minimized ? 'none' : 'block';
      minimizeBtn.innerHTML = `<i class="fas fa-${state.minimized ? 'expand' : 'minus'}"></i>`;
    });

    notifyBtn.addEventListener('click', requestNotificationPermission);
    
    window.addEventListener('beforeunload', () => { state.menuOpen = false; });
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
    if (statsArea && state.userInfo) {
      const t = {
          user: "Пользователь",
          pixels: "Пиксели",
          charges: "Заряды",
          level: "Уровень"
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

  // --- ЗАПУСК ---
  createUI();
  await getCharge();
  updateStats();
})();

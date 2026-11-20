/**
 * STAUNT New Tab Visual Engine — Photographic & Restrained Ambient Motion
 * Supports 8 Selectable Scenes (6 Photographic + 2 Plain):
 * 1. Living Sky (Photographic + Subtle Natural Bird Flock Motion)
 * 2. Mountain Escape (Photographic + Gentle Valley Mist Drift)
 * 3. Aurora (Photographic + Soft Flowing Luminous Curtains)
 * 4. Ocean Depths (Photographic + Shimmering Crepuscular Rays & Buoyancy)
 * 5. Living Cosmos (Photographic + Gentle Star Twinkling & Cosmic Parallax)
 * 6. Ambient Flow (Photographic + Organic Luminous Silk Sweep)
 * 7. Midnight Slate (Plain Solid Obsidian Navy — Zero Motion, Pure Focus)
 * 8. Warm Cloud (Plain Solid Alabaster — Zero Motion, Daylight Reading)
 *
 * Performance-conscious, 100% offline, ₹0 budget, battery-friendly (pauses on tab hide).
 */

(function () {
  'use strict';

  const TWO_PI = Math.PI * 2;
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const SCENES = [
    {
      id: 'living_sky',
      name: 'Living Sky',
      icon: '🕊️',
      type: 'photo',
      file: '../assets/backgrounds/sky_birds.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Golden dawn with natural soaring birds'
    },
    {
      id: 'mountain_escape',
      name: 'Mountain Escape',
      icon: '🏔️',
      type: 'photo',
      file: '../assets/backgrounds/mountain_escape.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Alpine peaks rising over drifting valley clouds'
    },
    {
      id: 'aurora',
      name: 'Aurora',
      icon: '🌌',
      type: 'photo',
      file: '../assets/backgrounds/aurora.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Luminous emerald curtains waving over snowy ridges'
    },
    {
      id: 'ocean_depths',
      name: 'Ocean Depths',
      icon: '🌊',
      type: 'photo',
      file: '../assets/backgrounds/ocean_depths.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Serene underwater reef with shifting sunbeams'
    },
    {
      id: 'living_cosmos',
      name: 'Living Cosmos',
      icon: '✨',
      type: 'photo',
      file: '../assets/backgrounds/cosmos.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Milky Way galaxy with subtle star twinkling'
    },
    {
      id: 'ambient_flow',
      name: 'Ambient Flow',
      icon: '🌀',
      type: 'photo',
      file: '../assets/backgrounds/ambient_flow.jpg',
      theme: 'dark',
      hasMotion: true,
      description: 'Sovereign silk contours with gentle light wave'
    },
    {
      id: 'midnight_slate',
      name: 'Midnight Slate',
      icon: '⬛',
      type: 'plain',
      color: '#080d1a',
      theme: 'dark',
      hasMotion: false,
      description: 'Minimalist deep navy slate for pure focus'
    },
    {
      id: 'warm_cloud',
      name: 'Warm Cloud',
      icon: '⬜',
      type: 'plain',
      color: '#f5f4f0',
      theme: 'light',
      hasMotion: false,
      description: 'Soft warm alabaster daylight surface'
    }
  ];

  class LivingSceneEngine {
    constructor() {
      this.scenes = SCENES;
      this.currentIndex = 0;
      this.activePhotoLayer = 'A'; // 'A' or 'B'
      this.canvas = null;
      this.ctx = null;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.isRunning = false;
      this.animId = null;
      this.lastTime = performance.now();
      this.time = 0;

      // Persistence
      this.STORAGE_KEY = 'staunt_scene_index';
      this.LOCK_KEY = 'staunt_scene_locked';
      this.AUTO_KEY = 'staunt_scene_autorotate';
      this.isLocked = localStorage.getItem(this.LOCK_KEY) === 'true';
      this.isAutoRotate = localStorage.getItem(this.AUTO_KEY) === 'true';
      this.countdown = 45;
      this.intervalSeconds = 45;

      // Motion modules
      this.initMotionData();
    }

    initMotionData() {
      // 1. Sky Birds (12 natural silhouetted birds flying high in the sky)
      this.skyBirds = [];
      const birdCount = 12;
      for (let i = 0; i < birdCount; i++) {
        this.skyBirds.push({
          x: Math.random() * (this.width || 1200),
          y: (0.08 + Math.random() * 0.20) * (this.height || 800), // strictly high in the sky
          speed: 0.9 + Math.random() * 0.8,
          scale: 0.55 + Math.random() * 0.45,
          wingSpan: 14 + Math.random() * 8,
          flapFreq: 3.5 + Math.random() * 2.0,
          phase: Math.random() * TWO_PI,
          glideTimer: Math.random() * 4,
          isGliding: false
        });
      }

      // 2. Mountain Mist (4 wide soft translucent cloud layers)
      this.mistLayers = [];
      for (let i = 0; i < 4; i++) {
        this.mistLayers.push({
          x: (i / 4) * (this.width || 1200),
          y: (0.42 + i * 0.05) * (this.height || 800),
          width: 500 + Math.random() * 300,
          height: 120 + Math.random() * 60,
          speed: 0.18 + i * 0.08,
          opacity: 0.12 + Math.random() * 0.08
        });
      }

      // 3. Ocean Caustics & Particles
      this.oceanRays = [
        { angle: -0.15, width: 90, speed: 0.0006, phase: 0 },
        { angle: -0.05, width: 130, speed: 0.0008, phase: 1.2 },
        { angle: 0.08, width: 110, speed: 0.0005, phase: 2.5 },
        { angle: 0.18, width: 85, speed: 0.0007, phase: 3.8 }
      ];
      this.oceanParticles = [];
      for (let i = 0; i < 18; i++) {
        this.oceanParticles.push({
          x: Math.random() * (this.width || 1200),
          y: Math.random() * (this.height || 800),
          size: 1 + Math.random() * 2,
          vy: 0.25 + Math.random() * 0.45,
          driftPhase: Math.random() * TWO_PI,
          opacity: 0.2 + Math.random() * 0.4
        });
      }

      // 4. Cosmos Star Twinkles (28 subtle distant stars)
      this.cosmosStars = [];
      for (let i = 0; i < 28; i++) {
        this.cosmosStars.push({
          x: Math.random() * (this.width || 1200),
          y: Math.random() * (this.height || 800) * 0.7, // upper cosmic area
          size: 0.8 + Math.random() * 1.5,
          period: 3 + Math.random() * 4,
          phase: Math.random() * TWO_PI
        });
      }
    }

    start(canvasElement) {
      this.canvas = canvasElement;
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.handleResize();
      }

      // Load saved scene index
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null && !isNaN(parseInt(saved, 10))) {
        const idx = parseInt(saved, 10);
        if (idx >= 0 && idx < this.scenes.length) {
          this.currentIndex = idx;
        }
      }

      // Setup DOM and listeners
      this.setupDOM();
      this.setupEventListeners();

      // Apply initial scene
      this.applyScene(this.currentIndex, true);

      // Start animation loop
      this.startLoop();
    }

    setupDOM() {
      // Ensure photo layers and plain layers exist in DOM
      const bgContainer = document.getElementById('bgCanvasContainer') || document.querySelector('.bg-canvas');
      if (bgContainer) {
        if (!document.getElementById('bgPhotoA')) {
          const a = document.createElement('div');
          a.id = 'bgPhotoA';
          a.className = 'bg-photo-layer';
          bgContainer.insertBefore(a, bgContainer.firstChild);
        }
        if (!document.getElementById('bgPhotoB')) {
          const b = document.createElement('div');
          b.id = 'bgPhotoB';
          b.className = 'bg-photo-layer';
          bgContainer.insertBefore(b, bgContainer.firstChild);
        }
        if (!document.getElementById('bgPlain')) {
          const p = document.createElement('div');
          p.id = 'bgPlain';
          p.className = 'bg-plain-layer';
          bgContainer.insertBefore(p, bgContainer.firstChild);
        }
      }

      // Populate Quick Scene Selection Popup Menu (All 8 Scenes)
      const menu = document.getElementById('sceneSelectMenu');
      if (menu) {
        menu.innerHTML = '';
        this.scenes.forEach((scene, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `scene-menu-item ${idx === this.currentIndex ? 'selected' : ''}`;
          btn.setAttribute('data-idx', idx);
          const tag = scene.type === 'plain' ? 'PLAIN' : 'PHOTO';
          btn.innerHTML = `
            <span class="scene-item-icon">${scene.icon}</span>
            <span class="scene-item-name">${scene.name}</span>
            <span class="scene-item-num">${tag}</span>
          `;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.switchScene(idx);
            menu.classList.remove('active');
          });
          menu.appendChild(btn);
        });
      }

      this.updateUI();
    }

    setupEventListeners() {
      // Resize handling
      window.addEventListener('resize', () => this.handleResize());

      // Controller buttons
      const prevBtn = document.getElementById('scenePrevBtn');
      const nextBtn = document.getElementById('sceneNextBtn');
      const pillBtn = document.getElementById('scenePillBtn');
      const autoBtn = document.getElementById('sceneAutoBtn');
      const lockBtn = document.getElementById('sceneLockBtn');
      const menu = document.getElementById('sceneSelectMenu');

      prevBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevScene();
      });

      nextBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextScene();
      });

      pillBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu) menu.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (menu && !menu.contains(e.target) && e.target !== pillBtn) {
          menu.classList.remove('active');
        }
      });

      autoBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isAutoRotate = !this.isAutoRotate;
        localStorage.setItem(this.AUTO_KEY, String(this.isAutoRotate));
        this.countdown = this.intervalSeconds;
        this.updateUI();
      });

      lockBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isLocked = !this.isLocked;
        localStorage.setItem(this.LOCK_KEY, String(this.isLocked));
        this.updateUI();
      });

      // Battery savings: Pause when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopLoop();
        } else {
          this.lastTime = performance.now();
          this.startLoop();
        }
      });

      // Reduced-motion media query
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotionQuery.addEventListener('change', () => {
        if (reducedMotionQuery.matches) {
          this.clearCanvas();
        }
      });
    }

    handleResize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      if (this.canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        if (this.ctx) {
          this.ctx.setTransform(1, 0, 0, 1, 0, 0);
          this.ctx.scale(dpr, dpr);
        }
      }
    }

    switchScene(index) {
      if (index === this.currentIndex) return;
      this.currentIndex = (index + this.scenes.length) % this.scenes.length;
      localStorage.setItem(this.STORAGE_KEY, String(this.currentIndex));
      this.countdown = this.intervalSeconds;
      this.applyScene(this.currentIndex, false);
      this.updateUI();
    }

    nextScene() {
      this.switchScene(this.currentIndex + 1);
    }

    prevScene() {
      this.switchScene(this.currentIndex - 1);
    }

    applyScene(index, immediate = false) {
      const scene = this.scenes[index];
      if (!scene) return;

      const layerA = document.getElementById('bgPhotoA');
      const layerB = document.getElementById('bgPhotoB');
      const layerPlain = document.getElementById('bgPlain');
      const canvasEl = this.canvas;

      // Handle Theme Switching (Light for Warm Cloud, Dark for all others)
      const isLightTheme = scene.theme === 'light';
      document.documentElement.setAttribute('data-scene-theme', scene.theme);
      document.documentElement.setAttribute('data-theme', isLightTheme ? 'light' : 'dark');

      if (scene.type === 'photo') {
        // Photographic background: cross-fade between Layer A and Layer B
        if (layerPlain) layerPlain.classList.remove('active');

        const incomingLayer = this.activePhotoLayer === 'A' ? layerB : layerA;
        const outgoingLayer = this.activePhotoLayer === 'A' ? layerA : layerB;

        if (incomingLayer) {
          incomingLayer.style.backgroundImage = `url('${scene.file}')`;
          incomingLayer.classList.add('active');
        }
        if (outgoingLayer) {
          outgoingLayer.classList.remove('active');
        }

        this.activePhotoLayer = this.activePhotoLayer === 'A' ? 'B' : 'A';

        // Enable canvas for motion if supported
        if (canvasEl) {
          canvasEl.classList.toggle('active', Boolean(scene.hasMotion));
        }
      } else {
        // Plain solid background (Midnight Slate or Warm Cloud)
        if (layerA) layerA.classList.remove('active');
        if (layerB) layerB.classList.remove('active');

        if (layerPlain) {
          layerPlain.style.backgroundColor = scene.color;
          layerPlain.classList.add('active');
        }

        // Disable canvas completely for plain scenes
        if (canvasEl) {
          canvasEl.classList.remove('active');
          this.clearCanvas();
        }
      }

      this.updateUI();
    }

    updateUI() {
      const curScene = this.scenes[this.currentIndex];
      if (!curScene) return;

      const pillText = document.getElementById('scenePillText');
      if (pillText) {
        pillText.textContent = `${curScene.icon} ${curScene.name} (${this.currentIndex + 1}/${this.scenes.length})`;
      }

      const autoBtn = document.getElementById('sceneAutoBtn');
      if (autoBtn) {
        if (this.isAutoRotate && !this.isLocked) {
          autoBtn.classList.add('active');
          autoBtn.title = 'Auto Change: ON (Click to Pause)';
        } else {
          autoBtn.classList.remove('active');
          autoBtn.title = 'Auto Change: OFF (Click to Enable)';
        }
      }

      const lockBtn = document.getElementById('sceneLockBtn');
      if (lockBtn) {
        if (this.isLocked) {
          lockBtn.classList.add('active');
          lockBtn.innerHTML = '🔒';
          lockBtn.title = 'Scene Locked (Click to Unlock)';
        } else {
          lockBtn.classList.remove('active');
          lockBtn.innerHTML = '🔓';
          lockBtn.title = 'Scene Unlocked (Click to Pin/Lock)';
        }
      }

      // Update menu items
      const menu = document.getElementById('sceneSelectMenu');
      if (menu) {
        menu.querySelectorAll('.scene-menu-item').forEach((item, idx) => {
          if (idx === this.currentIndex) item.classList.add('selected');
          else item.classList.remove('selected');
        });
      }

      this.updateCountdownUI();
    }

    updateCountdownUI() {
      const autoText = document.getElementById('sceneAutoText');
      if (autoText) {
        if (this.isAutoRotate && !this.isLocked) {
          autoText.textContent = `Auto: ${Math.ceil(this.countdown)}s`;
        } else {
          autoText.textContent = 'Auto: OFF';
        }
      }

      const progressRing = document.getElementById('sceneProgressBar');
      if (progressRing) {
        if (this.isAutoRotate && !this.isLocked) {
          const pct = clamp((1 - this.countdown / this.intervalSeconds) * 100, 0, 100);
          progressRing.style.width = `${pct}%`;
        } else {
          progressRing.style.width = '0%';
        }
      }
    }

    startLoop() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastTime = performance.now();
      const loop = (now) => {
        if (!this.isRunning) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        this.time += dt;

        // Auto-rotation timer
        if (this.isAutoRotate && !this.isLocked) {
          this.countdown -= dt;
          if (this.countdown <= 0) {
            this.countdown = this.intervalSeconds;
            this.nextScene();
          }
          this.updateCountdownUI();
        }

        // Render current scene animation
        this.renderScene(dt);

        this.animId = requestAnimationFrame(loop);
      };
      this.animId = requestAnimationFrame(loop);
    }

    stopLoop() {
      this.isRunning = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    clearCanvas() {
      if (this.ctx && this.width && this.height) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    renderScene(dt) {
      const scene = this.scenes[this.currentIndex];
      if (!scene || !scene.hasMotion || !this.ctx) {
        this.clearCanvas();
        return;
      }

      // Check prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.clearCanvas();
        return;
      }

      this.clearCanvas();

      switch (scene.id) {
        case 'living_sky':
          this.renderSkyBirds(dt);
          break;
        case 'mountain_escape':
          this.renderMountainMist(dt);
          break;
        case 'aurora':
          this.renderAuroraWaves(dt);
          break;
        case 'ocean_depths':
          this.renderOceanSunbeams(dt);
          break;
        case 'living_cosmos':
          this.renderCosmosTwinkles(dt);
          break;
        case 'ambient_flow':
          this.renderAmbientSheen(dt);
          break;
        default:
          break;
      }
    }

    // =========================================================================
    // 1. LIVING SKY: Subtle Natural Soaring Birds
    // =========================================================================
    renderSkyBirds(dt) {
      const ctx = this.ctx;
      ctx.save();

      for (let i = 0; i < this.skyBirds.length; i++) {
        const b = this.skyBirds[i];

        // Move horizontally
        b.x += b.speed * 60 * dt;
        if (b.x > this.width + 60) {
          b.x = -60;
          b.y = (0.08 + Math.random() * 0.22) * this.height;
        }

        // Flapping vs Gliding state
        b.glideTimer -= dt;
        if (b.glideTimer <= 0) {
          b.isGliding = !b.isGliding;
          b.glideTimer = b.isGliding ? 2.5 + Math.random() * 3.5 : 1.5 + Math.random() * 2.0;
        }

        let wingAngle = 0;
        if (!b.isGliding) {
          b.phase += b.flapFreq * dt * TWO_PI;
          wingAngle = Math.sin(b.phase) * 0.45;
        } else {
          wingAngle = 0.08 * Math.sin(this.time * 1.5 + i);
        }

        // Draw bird silhouette
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.scale, b.scale);

        ctx.fillStyle = 'rgba(28, 25, 23, 0.72)'; // natural dark silhouette
        ctx.beginPath();

        // Small aerodynamic body
        ctx.ellipse(0, 0, 7, 2.2, 0.08, 0, TWO_PI);
        ctx.fill();

        // Left Wing (bezier curved)
        ctx.beginPath();
        ctx.moveTo(-1, 0);
        const lTipY = -b.wingSpan * Math.cos(wingAngle);
        const lTipX = -b.wingSpan * 0.85;
        ctx.quadraticCurveTo(-b.wingSpan * 0.4, lTipY * 0.5 - 2, lTipX, lTipY);
        ctx.quadraticCurveTo(-b.wingSpan * 0.35, lTipY * 0.4 + 1, 2, 0);
        ctx.fill();

        // Right Wing (bezier curved)
        ctx.beginPath();
        ctx.moveTo(1, 0);
        const rTipY = -b.wingSpan * Math.cos(wingAngle);
        const rTipX = b.wingSpan * 0.85;
        ctx.quadraticCurveTo(b.wingSpan * 0.4, rTipY * 0.5 - 2, rTipX, rTipY);
        ctx.quadraticCurveTo(b.wingSpan * 0.35, rTipY * 0.4 + 1, -2, 0);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // 2. MOUNTAIN ESCAPE: Understated Valley Mist Drift
    // =========================================================================
    renderMountainMist(dt) {
      const ctx = this.ctx;
      ctx.save();

      for (let i = 0; i < this.mistLayers.length; i++) {
        const m = this.mistLayers[i];
        m.x += m.speed * 40 * dt;
        if (m.x - m.width / 2 > this.width) {
          m.x = -m.width / 2;
        }

        const grad = ctx.createRadialGradient(m.x, m.y, 10, m.x, m.y, m.width / 2);
        grad.addColorStop(0, `rgba(255, 248, 235, ${m.opacity})`);
        grad.addColorStop(0.5, `rgba(240, 235, 225, ${m.opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(240, 235, 225, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, m.width / 2, m.height / 2, 0, 0, TWO_PI);
        ctx.fill();
      }

      ctx.restore();
    }

    // =========================================================================
    // 3. AURORA: Soft Undulating Harmonic Luminous Curtains
    // =========================================================================
    renderAuroraWaves(dt) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const t = this.time * 0.45;
      const waveCount = 3;

      for (let w = 0; w < waveCount; w++) {
        const baseY = (0.16 + w * 0.08) * this.height;
        const grad = ctx.createLinearGradient(0, baseY - 80, 0, baseY + 140);
        if (w % 2 === 0) {
          grad.addColorStop(0, 'rgba(52, 211, 153, 0)');
          grad.addColorStop(0.35, 'rgba(52, 211, 153, 0.16)'); // Emerald
          grad.addColorStop(0.8, 'rgba(168, 85, 247, 0.10)');  // Violet
          grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        } else {
          grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
          grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.14)');  // Electric Cyan
          grad.addColorStop(0.75, 'rgba(52, 211, 153, 0.12)'); // Emerald
          grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, baseY);

        const segments = 16;
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * this.width;
          const offset = Math.sin(x * 0.003 + t + w * 1.5) * 32 + Math.cos(x * 0.0015 - t * 0.8) * 18;
          ctx.lineTo(x, baseY + offset);
        }

        ctx.lineTo(this.width, this.height * 0.55);
        ctx.lineTo(0, this.height * 0.55);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // =========================================================================
    // 4. OCEAN DEPTHS: Crepuscular Sunbeams & Buoyancy Particles
    // =========================================================================
    renderOceanSunbeams(dt) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const originX = this.width * 0.52;
      const originY = -30;

      // 4 Shimmering Rays
      for (let i = 0; i < this.oceanRays.length; i++) {
        const ray = this.oceanRays[i];
        const pulse = 0.07 + 0.05 * Math.sin(this.time * ray.speed * 2000 + ray.phase);
        const curAngle = ray.angle + Math.sin(this.time * 0.6 + i) * 0.03;

        const length = this.height * 0.95;
        const targetX = originX + Math.tan(curAngle) * length;

        const grad = ctx.createLinearGradient(originX, originY, targetX, length);
        grad.addColorStop(0, `rgba(224, 242, 254, ${pulse * 1.8})`);
        grad.addColorStop(0.4, `rgba(186, 230, 253, ${pulse})`);
        grad.addColorStop(1, 'rgba(186, 230, 253, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(originX - 15, originY);
        ctx.lineTo(originX + 15, originY);
        ctx.lineTo(targetX + ray.width / 2, length);
        ctx.lineTo(targetX - ray.width / 2, length);
        ctx.closePath();
        ctx.fill();
      }

      // Buoyant Micro Particles
      ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
      for (let i = 0; i < this.oceanParticles.length; i++) {
        const p = this.oceanParticles[i];
        p.y -= p.vy * 40 * dt;
        p.driftPhase += dt * 1.2;
        const driftX = Math.sin(p.driftPhase) * 0.5;

        if (p.y < 0) {
          p.y = this.height + 10;
          p.x = Math.random() * this.width;
        }

        ctx.beginPath();
        ctx.arc(p.x + driftX, p.y, p.size, 0, TWO_PI);
        ctx.fill();
      }

      ctx.restore();
    }

    // =========================================================================
    // 5. LIVING COSMOS: Gentle Star Twinkles & Parallax Breathing
    // =========================================================================
    renderCosmosTwinkles(dt) {
      const ctx = this.ctx;
      ctx.save();

      for (let i = 0; i < this.cosmosStars.length; i++) {
        const s = this.cosmosStars[i];
        const alpha = 0.25 + 0.65 * Math.pow(Math.sin((this.time / s.period) * TWO_PI + s.phase) * 0.5 + 0.5, 2);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, TWO_PI);
        ctx.fill();

        if (alpha > 0.75) {
          ctx.strokeStyle = `rgba(186, 230, 253, ${(alpha * 0.4).toFixed(2)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - 3, s.y);
          ctx.lineTo(s.x + 3, s.y);
          ctx.moveTo(s.x, s.y - 3);
          ctx.lineTo(s.x, s.y + 3);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // 6. AMBIENT FLOW: Organic Luminous Silk Sweep
    // =========================================================================
    renderAmbientSheen(dt) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const progress = (this.time * 0.08) % 1;
      const waveX = progress * (this.width + 400) - 200;
      const centerY = this.height * 0.5;

      const grad = ctx.createRadialGradient(waveX, centerY, 40, waveX, centerY, 380);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
      grad.addColorStop(0.5, 'rgba(2, 132, 199, 0.05)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(waveX, centerY, 380, 240, -0.2, 0, TWO_PI);
      ctx.fill();

      ctx.restore();
    }
  }

  // Initialize on window
  window.StauntLivingScenes = new LivingSceneEngine();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const canvas = document.getElementById('livingCanvas') || document.getElementById('ambientMotionCanvas');
      if (canvas) window.StauntLivingScenes.start(canvas);
    });
  } else {
    const canvas = document.getElementById('livingCanvas') || document.getElementById('ambientMotionCanvas');
    if (canvas) window.StauntLivingScenes.start(canvas);
  }
})();

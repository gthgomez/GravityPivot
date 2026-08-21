import { GameSaveState } from './state/saveState';
import { SynthManager } from './audio/synth';
import { ParticleEngine } from './effects/particles';
import { GravityPivotEngine } from './engine/engine';
import { CanvasRenderer } from './renderer/canvasRenderer';
import { UIController } from './ui/uiController';
import { EngineCallbacks, CalibrationState } from './types';
import { GamePhase, ViewTab, DEFAULT_CONFIG, upgradeCost, SHIP_SKINS } from './constants';
import { SeededRandom } from './utils/seededRandom';
import './style.css';

window.addEventListener('DOMContentLoaded', () => {
  // 1. Instantiate modules
  const saveState = new GameSaveState();
  const synth = new SynthManager();
  const particles = new ParticleEngine(DEFAULT_CONFIG.maxParticles);
  const ui = new UIController();
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas);

  let activeTab = ViewTab.COCKPIT;
  let isDailyMode = false;

  const startRun = (isDaily: boolean) => {
    if (isDaily) {
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const prng = new SeededRandom(seed);
      engine.setRandomFn(() => prng.next());
      ui.appendLog(`Engaging daily telemetry challenge. Seed: ${seed}`, 'alert');
      ui.updatePersonalBest(saveState.dailyBest, true);
    } else {
      engine.setRandomFn(Math.random);
      ui.appendLog('Standard navigation path loaded.', 'info');
      ui.updatePersonalBest(saveState.highScores[0]?.score ?? 0, false);
    }
    engine.initializeLevel();
    engine.setGamePhase(GamePhase.FLYING);
    ui.showLaunchOverlay(false);
    synth.init();
    synth.resumeContext();
  };

  // 2. Wire up callbacks (engine -> UI/audio)
  const callbacks: EngineCallbacks = {
    onShieldChanged: (current, max) => {
      ui.updateShieldDisplay(current, max);
    },
    onScoreChanged: (score, combo) => {
      ui.updateScore(score, combo);
    },
    onCoreCollected: (runCores, totalCores, coreX, coreY) => {
      ui.updateCoreCount(runCores, totalCores);
      synth.playCoreCollected();
      particles.spawn(coreX, coreY, '#fbbf24', 3, 6);
      const cameraOffsetX = Math.round(-engine.getSparkState().x + 150);
      renderer.spawnFloatingText(coreX + cameraOffsetX, coreY, '+150', '#fbbf24');
    },
    onSectorLeap: (sectorIndex) => {
      synth.playSectorUp();
      ui.showSectorPopup(sectorIndex);
      const scale = window.devicePixelRatio || 1;
      renderer.spawnFloatingText(canvas.width / (2 * scale), 100, 'SECTOR CLEARED!', '#22d3ee');
    },
    onNearMiss: (combo, x, y) => {
      synth.playPing();
      particles.spawn(x, y, combo === 5 ? '#ec4899' : '#06b6d4', 4, 12);
      renderer.triggerShake(2);
      const cameraOffsetX = Math.round(-engine.getSparkState().x + 150);
      renderer.spawnFloatingText(x + cameraOffsetX, y, `x${combo} COMBO!`, combo === 5 ? '#ec4899' : '#06b6d4');
    },
    onDangerProximity: (active) => {
      ui.showDangerWarning(active);
    },
    onShieldBounce: (_shield, x, y) => {
      synth.playShieldBounce();
      particles.spawn(x, y, '#10b981', 5, 12);
      renderer.triggerShake(6);
      const cameraOffsetX = Math.round(-engine.getSparkState().x + 150);
      renderer.spawnFloatingText(x + cameraOffsetX, y, '-1 SHIELD', '#f43f5e');
    },
    onCrash: (x, y, finalScore, sectorReached, isNewHighScore, isNewDailyBest, dailyBest) => {
      synth.playExplosion();
      particles.spawn(x, y, '#f43f5e', 8, 30);
      renderer.triggerShake(15);
      const scale = window.devicePixelRatio || 1;
      renderer.spawnFloatingText(canvas.width / (2 * scale), canvas.height / (2 * scale) - 30, 'CRASHED!', '#f43f5e');
      const bestScore = saveState.highScores[0]?.score ?? finalScore;
      ui.showGameOverPanel(
        finalScore,
        sectorReached,
        isNewHighScore,
        bestScore,
        isNewDailyBest,
        dailyBest,
        isDailyMode
      );
      ui.updateLeaderboardDisplay(saveState.highScores);
      ui.updatePersonalBest(isDailyMode ? dailyBest : bestScore, isDailyMode);
    },
    onTetherAcquired: () => {
      synth.playPing();
    },
    onTetherReleased: () => {
      synth.playReleaseWhoosh();
    },
    onTelemetryUpdate: (sigma, velocity, sectorProgress, sectorIndex) => {
      ui.updateTelemetry(sigma, velocity, `${engine.getConfig().maxTetherRadius}px`);
      ui.updateSectorProgress(sectorProgress, sectorIndex);
    },
    onLog: (message, style) => {
      ui.appendLog(message, style);
    }
  };

  // 3. Setup synth parameters callback
  synth.onParamsChange = (freq, filter, tempo) => {
    ui.updateSynthDisplay(freq, filter, tempo);
  };

  // 4. Initialize engine
  const calibration: CalibrationState = ui.getCalibrationState();
  const engine = new GravityPivotEngine(saveState, callbacks, calibration);

  // 5. Game loop setup
  let lastTime = performance.now();
  let accumulator = 0;
  const physicsTimeStep = DEFAULT_CONFIG.physicsTimeStep;

  function gameLoop(timestamp: number) {
    const elapsed = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    const gamePhase = engine.getGamePhase();

    if (gamePhase === GamePhase.FLYING) {
      accumulator += elapsed;
      // Read calibration dynamic parameters from UI once per frame
      const currentCal = ui.getCalibrationState();
      engine.updateCalibration(currentCal);

      while (accumulator >= physicsTimeStep) {
        engine.physicsTick(physicsTimeStep);
        accumulator -= physicsTimeStep;
      }
      // Update synth dynamic audio parameters based on speed, combo, and sector
      const spark = engine.getSparkState();
      const speed = Math.hypot(spark.vx, spark.vy);
      synth.updateParams(speed / 12, spark.combo, engine.getSectorIndex());
    } else {
      // Still update particles on splash/pause/game-over screens
      particles.update();
    }

    // Always draw current state
    const spark = engine.getSparkState();
    renderer.draw(
      spark,
      engine.getMapData(),
      engine.getTrail(),
      particles,
      engine.getConfig().maxTetherRadius,
      engine.getSectorIndex(),
      gamePhase,
      saveState.activeSkinId
    );

    requestAnimationFrame(gameLoop);
  }

  // 6. Bind UI element updates & resizing
  const resizeGame = () => {
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width;
    const parentHeight = activeTab === ViewTab.COCKPIT ? 320 : 260;
    renderer.setupResizing(parentWidth, parentHeight);
  };
  window.addEventListener('resize', resizeGame);
  resizeGame(); // Initial resize alignment

  ui.syncUpgradeButtons(saveState);
  ui.syncSkinButton(saveState);
  ui.updateCoreCount(0, saveState.totalCores);
  ui.updateLeaderboardDisplay(saveState.highScores);
  ui.updatePersonalBest(saveState.highScores[0]?.score ?? 0, false);

  // 7. Bind controls & input handlers
  const handleTetherDown = (e: MouseEvent | TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (activeTab !== ViewTab.COCKPIT) return;
    
    const phase = engine.getGamePhase();
    if (phase === GamePhase.SPLASH) return;

    if (phase === GamePhase.CRASHED) {
      ui.hideGameOverPanel();
      startRun(isDailyMode);
      return;
    }

    const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    const coords = ui.getWorldCoords(touch.clientX, touch.clientY, engine.getSparkState().x, canvas);
    engine.acquireTether(coords.worldX, coords.worldY);
  };

  const handleTetherUp = (e: MouseEvent | TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    engine.releaseTether();
  };

  canvas.addEventListener('mousedown', handleTetherDown);
  window.addEventListener('mouseup', handleTetherUp);
  canvas.addEventListener('touchstart', handleTetherDown, { passive: false });
  window.addEventListener('touchend', handleTetherUp, { passive: false });

  // Splash/Pause overlays buttons
  const btnSplashLaunch = document.getElementById('btn-splash-launch');
  if (btnSplashLaunch) {
    btnSplashLaunch.addEventListener('click', () => {
      isDailyMode = false;
      startRun(false);
    });
  }

  const btnDailyLaunch = document.getElementById('btn-daily-launch');
  if (btnDailyLaunch) {
    btnDailyLaunch.addEventListener('click', () => {
      isDailyMode = true;
      startRun(true);
    });
  }

  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      ui.showLaunchOverlay(true);
      ui.showPauseOverlay(false);
    });
  }

  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      const tabCockpit = document.getElementById('tab-cockpit');
      if (tabCockpit) tabCockpit.click();
    });
  }

  // Calibration Sliders bindings
  const sSpeed = document.getElementById('slide-speed') as HTMLInputElement | null;
  if (sSpeed) {
    sSpeed.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      engine.setBaseSpeed(val);
      const vSpeed = document.getElementById('val-speed');
      if (vSpeed) vSpeed.textContent = val.toFixed(1);
    });
  }

  const sSubsteps = document.getElementById('slide-substeps') as HTMLInputElement | null;
  if (sSubsteps) {
    sSubsteps.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      engine.getConfig().subSteps = val;
      const vSub = document.getElementById('val-substeps');
      if (vSub) vSub.textContent = val.toString();
    });
  }

  const sBuffer = document.getElementById('slide-buffer') as HTMLInputElement | null;
  if (sBuffer) {
    sBuffer.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      engine.getConfig().hazardProximityBuffer = val;
      const vBuf = document.getElementById('val-buffer');
      if (vBuf) vBuf.textContent = `${val}px`;
    });
  }

  // Buy upgrade buttons bindings
  const buyUpgrade = (btnId: string, type: 'shield' | 'magnet' | 'tether', costMultiplier: number) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        let level = 1;
        if (type === 'shield') level = saveState.shieldLvl;
        else if (type === 'magnet') level = saveState.magnetLvl;
        else if (type === 'tether') level = saveState.tetherLvl;

        const cost = upgradeCost(costMultiplier, level);
        if (saveState.totalCores >= cost) {
          saveState.totalCores -= cost;
          if (type === 'shield') saveState.shieldLvl++;
          else if (type === 'magnet') saveState.magnetLvl++;
          else if (type === 'tether') saveState.tetherLvl++;

          saveState.save();
          engine.syncUpgrades();
          ui.syncUpgradeButtons(saveState);
          ui.updateCoreCount(engine.getSparkState().collectedInRun, saveState.totalCores);
          ui.appendLog(`Successfully installed hardware upgrade: ${type.toUpperCase()}`, 'success');
        } else {
          ui.appendLog(`Insufficient core balance for upgrade: ${type.toUpperCase()}`, 'warn');
          btn.classList.add('flash-error');
          setTimeout(() => {
            btn.classList.remove('flash-error');
          }, 400);
        }
      });
    }
  };

  buyUpgrade('buy-shield-btn', 'shield', 10);
  buyUpgrade('buy-magnet-btn', 'magnet', 15);
  buyUpgrade('buy-tether-btn', 'tether', 20);

  // Buy visual theme skin card binding
  const buySkinBtn = document.getElementById('buy-skin-btn');
  if (buySkinBtn) {
    buySkinBtn.addEventListener('click', () => {
      const nextSkinId = saveState.unlockedSkins.length;
      if (nextSkinId >= SHIP_SKINS.length) {
        // All skins unlocked. Cycle activeSkinId through unlockedSkins.
        const currentIdx = saveState.unlockedSkins.indexOf(saveState.activeSkinId);
        const nextIdx = (currentIdx + 1) % saveState.unlockedSkins.length;
        saveState.activeSkinId = saveState.unlockedSkins[nextIdx];
        saveState.save();
        ui.syncSkinButton(saveState);
        ui.appendLog(`Visual theme changed to: ${SHIP_SKINS[saveState.activeSkinId].name.toUpperCase()}`, 'info');
      } else {
        // Still skins to unlock
        const nextSkin = SHIP_SKINS[nextSkinId];
        if (saveState.totalCores >= nextSkin.cost) {
          saveState.totalCores -= nextSkin.cost;
          saveState.unlockedSkins.push(nextSkin.id);
          saveState.activeSkinId = nextSkin.id;
          saveState.save();
          ui.syncSkinButton(saveState);
          ui.updateCoreCount(engine.getSparkState().collectedInRun, saveState.totalCores);
          ui.appendLog(`Successfully unlocked visual theme: ${nextSkin.name.toUpperCase()}`, 'success');
        } else {
          ui.appendLog(`Insufficient core balance for visual theme: ${nextSkin.name.toUpperCase()}`, 'warn');
          buySkinBtn.classList.add('flash-error');
          setTimeout(() => {
            buySkinBtn.classList.remove('flash-error');
          }, 400);
        }
      }
    });
  }

  // Game over screen retry button binding
  const btnGameOverRetry = document.getElementById('game-over-retry');
  if (btnGameOverRetry) {
    btnGameOverRetry.addEventListener('click', () => {
      ui.hideGameOverPanel();
      startRun(isDailyMode);
    });
  }

  // Mute button binding
  const unmuteBtn = document.getElementById('unmute-btn');
  if (unmuteBtn) {
    unmuteBtn.addEventListener('click', () => {
      if (synth.getIsMuted()) {
        synth.setMute(false);
        unmuteBtn.style.color = '#ffffff';
        unmuteBtn.style.backgroundColor = '#ec4899';
        unmuteBtn.style.borderColor = 'rgba(236, 72, 153, 0.3)';
        unmuteBtn.classList.add('pink-glow');
        const textSpan = unmuteBtn.querySelector('.synth-toggle-text');
        if (textSpan) textSpan.textContent = 'SYNTH ACTIVE';
      } else {
        synth.setMute(true);
        unmuteBtn.style.color = '#94a3b8';
        unmuteBtn.style.backgroundColor = '#0f172a';
        unmuteBtn.style.borderColor = '#1e293b';
        unmuteBtn.classList.remove('pink-glow');
        const textSpan = unmuteBtn.querySelector('.synth-toggle-text');
        if (textSpan) textSpan.textContent = 'SYNTH MUTED';
      }
    });
  }

  // Keyboard navigation & controls bindings
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (activeTab !== ViewTab.COCKPIT) return;
    
    const phase = engine.getGamePhase();
    if (phase === GamePhase.SPLASH) return;

    if (phase === GamePhase.CRASHED) {
      if (e.code === 'Space') {
        ui.hideGameOverPanel();
        startRun(isDailyMode);
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      engine.acquireTether();
    }
    if (e.code === 'KeyR') {
      engine.initializeLevel();
      ui.showLaunchOverlay(true);
      ui.showPauseOverlay(false);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      engine.releaseTether();
    }
  });

  // Tab bindings
  const bindTab = (tabId: string, tab: ViewTab) => {
    const btn = document.getElementById(tabId);
    if (btn) {
      btn.addEventListener('click', () => {
        if (activeTab === tab) return;

        const phaseBefore = engine.getGamePhase();
        activeTab = ui.switchTab(tab, activeTab);
        
        // Resize canvas size mapping to custom aspect ratio
        resizeGame();

        if (activeTab !== ViewTab.COCKPIT && phaseBefore === GamePhase.FLYING) {
          engine.setGamePhase(GamePhase.PAUSED);
          ui.showPauseOverlay(true);
        } else if (activeTab === ViewTab.COCKPIT && phaseBefore === GamePhase.PAUSED) {
          engine.setGamePhase(GamePhase.FLYING);
          ui.showPauseOverlay(false);
        }

        ui.appendLog(`Switched HUD interface view to ${tab}.`, 'info');
      });
    }
  };

  bindTab('tab-cockpit', ViewTab.COCKPIT);
  bindTab('tab-terminal', ViewTab.TERMINAL);
  bindTab('tab-telemetry', ViewTab.TELEMETRY);
  bindTab('tab-calibration', ViewTab.CALIBRATION);

  // Visibility page lifecycle listener
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (engine.getGamePhase() === GamePhase.FLYING) {
        engine.setGamePhase(GamePhase.PAUSED);
        ui.showPauseOverlay(true);
      }
      synth.suspendContext();
    } else {
      if (!synth.getIsMuted()) {
        synth.resumeContext();
      }
    }
  });

  // Start precision loop
  requestAnimationFrame(gameLoop);
});

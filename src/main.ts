import { GameSaveState } from './state/saveState';
import { SynthManager } from './audio/synth';
import { ParticleEngine } from './effects/particles';
import { GravityPivotEngine } from './engine/engine';
import { CanvasRenderer } from './renderer/canvasRenderer';
import { UIController } from './ui/uiController';
import { EngineCallbacks, CalibrationState, RunContext } from './types';
import {
  GamePhase,
  ViewTab,
  DEFAULT_CONFIG,
  upgradeCost,
  SHIP_SKINS,
} from './constants';
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
  let runContext: RunContext = { mode: 'STANDARD' };

  const startRun = (isDaily: boolean) => {
    particles.clear();
    if (isDaily) {
      const today = new Date();
      const challengeId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const seed =
        today.getFullYear() * 10000 +
        (today.getMonth() + 1) * 100 +
        today.getDate();
      const prng = new SeededRandom(seed);
      engine.setRandomFn(() => prng.next());
      runContext = { mode: 'DAILY', challengeId, rulesVersion: 1 };
      ui.appendLog(
        `Engaging daily telemetry challenge. Seed: ${seed}`,
        'alert',
      );
      ui.updatePersonalBest(saveState.dailyBest, true);
    } else {
      engine.setRandomFn(Math.random);
      runContext = { mode: 'STANDARD' };
      ui.appendLog('Standard navigation path loaded.', 'info');
      ui.updatePersonalBest(saveState.highScores[0]?.score ?? 0, false);
    }
    engine.initializeLevel(runContext);
    ui.updateCoreCount(
      engine.getSparkState().collectedInRun,
      saveState.totalCores,
    );
    engine.setGamePhase(GamePhase.FLYING);
    ui.showLaunchOverlay(false);
    ui.showPauseOverlay(false);
    ui.hideGameOverPanel();
    resetFrameClock();
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
      renderer.spawnWorldFloatingText(
        coreX,
        coreY,
        '+150',
        '#fbbf24',
        engine.getSparkState().x,
      );
    },
    onSectorLeap: (sectorIndex) => {
      synth.playSectorUp();
      ui.showSectorPopup(sectorIndex);
      const logicalSize = renderer.getLogicalSize();
      if (!logicalSize) return;
      renderer.spawnFloatingText(
        logicalSize.width / 2,
        100,
        'SECTOR CLEARED!',
        '#22d3ee',
      );
    },
    onNearMiss: (combo, x, y) => {
      synth.playPing();
      particles.spawn(x, y, combo === 5 ? '#ec4899' : '#06b6d4', 4, 12);
      renderer.triggerShake(2);
      renderer.spawnWorldFloatingText(
        x,
        y,
        `x${combo} COMBO!`,
        combo === 5 ? '#ec4899' : '#06b6d4',
        engine.getSparkState().x,
      );
    },
    onDangerProximity: (active) => {
      ui.showDangerWarning(active);
    },
    onShieldBounce: (_shield, x, y) => {
      synth.playShieldBounce();
      particles.spawn(x, y, '#10b981', 5, 12);
      renderer.triggerShake(6);
      renderer.spawnWorldFloatingText(
        x,
        y,
        '-1 SHIELD',
        '#f43f5e',
        engine.getSparkState().x,
      );
    },
    onRunEnded: (result) => {
      const { x, y, score: finalScore, sectorReached } = result;
      const endedInDaily = result.context.mode === 'DAILY';
      const previousBest = endedInDaily
        ? saveState.dailyBest
        : (saveState.highScores[0]?.score ?? 0);
      const isNewHighScore = !endedInDaily && finalScore > previousBest;
      const isNewDailyBest = endedInDaily
        ? saveState.updateDailyBest(finalScore)
        : false;
      if (!endedInDaily) saveState.addHighScore(finalScore, sectorReached);
      const bestScore = endedInDaily
        ? saveState.dailyBest
        : (saveState.highScores[0]?.score ?? finalScore);
      synth.playExplosion();
      particles.spawn(x, y, '#f43f5e', 8, 30);
      renderer.triggerShake(15);
      const logicalSize = renderer.getLogicalSize();
      if (logicalSize) {
        renderer.spawnFloatingText(
          logicalSize.width / 2,
          logicalSize.height / 2 - 30,
          'CRASHED!',
          '#f43f5e',
        );
      }
      ui.showGameOverPanel(
        finalScore,
        sectorReached,
        isNewHighScore,
        bestScore,
        isNewDailyBest,
        saveState.dailyBest,
        endedInDaily,
      );
      if (!endedInDaily) ui.updateLeaderboardDisplay(saveState.highScores);
      ui.updatePersonalBest(bestScore, endedInDaily);
    },
    onTetherAcquired: () => {
      synth.playPing();
    },
    onTetherReleased: () => {
      synth.playReleaseWhoosh();
    },
    onTelemetryUpdate: (sigma, velocity, sectorProgress, sectorIndex) => {
      ui.updateTelemetry(
        sigma,
        velocity,
        `${engine.getConfig().maxTetherRadius}px`,
      );
      ui.updateSectorProgress(sectorProgress, sectorIndex);
    },
    onLog: (message, style) => {
      ui.appendLog(message, style);
    },
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

    if (engine.getGamePhase() === GamePhase.FLYING) {
      accumulator += elapsed;
      // Read calibration dynamic parameters from UI once per frame
      const currentCal = ui.getCalibrationState();
      engine.updateCalibration(currentCal);

      while (
        accumulator >= physicsTimeStep &&
        engine.getGamePhase() === GamePhase.FLYING
      ) {
        engine.physicsTick(physicsTimeStep);
        accumulator -= physicsTimeStep;
      }
      if (engine.getGamePhase() === GamePhase.FLYING) {
        // Update synth dynamic audio parameters based on speed, combo, and sector
        const spark = engine.getSparkState();
        const speed = Math.hypot(spark.vx, spark.vy);
        synth.updateParams(speed / 12, spark.combo, engine.getSectorIndex());
      } else {
        accumulator = 0;
      }
    } else {
      accumulator = 0;
    }

    particles.update(elapsed);

    // Always draw current state
    const spark = engine.getSparkState();
    renderer.draw(
      spark,
      engine.getMapData(),
      engine.getTrail(),
      particles,
      engine.getConfig().maxTetherRadius,
      engine.getSectorIndex(),
      engine.getGamePhase(),
      saveState.activeSkinId,
    );

    requestAnimationFrame(gameLoop);
  }

  // 6. Bind UI element updates & resizing
  const resizeGame = () => {
    const parentWidth = canvas.parentElement?.clientWidth ?? 0;
    renderer.setupResizing(parentWidth, canvas.clientHeight);
  };
  window.addEventListener('resize', resizeGame);
  resizeGame(); // Initial resize alignment

  function resetFrameClock(): void {
    accumulator = 0;
    lastTime = performance.now();
  }

  function pauseRun(): void {
    if (engine.getGamePhase() !== GamePhase.FLYING) return;
    engine.releaseTether();
    engine.setGamePhase(GamePhase.PAUSED);
    ui.showPauseOverlay(true);
    synth.suspendContext();
    resetFrameClock();
  }

  function resumeRun(): void {
    if (engine.getGamePhase() !== GamePhase.PAUSED) return;
    if (activeTab !== ViewTab.COCKPIT) {
      activeTab = ui.switchTab(ViewTab.COCKPIT, activeTab);
      resizeGame();
    }
    engine.setGamePhase(GamePhase.FLYING);
    ui.showPauseOverlay(false);
    resetFrameClock();
    if (!synth.getIsMuted()) synth.resumeContext();
  }

  function resetToSplash(): void {
    particles.clear();
    engine.releaseTether();
    engine.initializeLevel(runContext);
    ui.updateCoreCount(
      engine.getSparkState().collectedInRun,
      saveState.totalCores,
    );
    ui.hideGameOverPanel();
    ui.showLaunchOverlay(true);
    ui.showPauseOverlay(false);
    synth.suspendContext();
    resetFrameClock();
  }

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

    const touch = (e as TouchEvent).touches
      ? (e as TouchEvent).touches[0]
      : (e as MouseEvent);
    const coords = ui.getWorldCoords(
      touch.clientX,
      touch.clientY,
      engine.getSparkState().x,
      canvas,
    );
    if (!coords) return;
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
      resetToSplash();
    });
  }

  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      resumeRun();
    });
  }

  // Calibration Sliders bindings
  const sSpeed = document.getElementById(
    'slide-speed',
  ) as HTMLInputElement | null;
  if (sSpeed) {
    sSpeed.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      engine.setBaseSpeed(val);
      const vSpeed = document.getElementById('val-speed');
      if (vSpeed) vSpeed.textContent = val.toFixed(1);
    });
  }

  const sSubsteps = document.getElementById(
    'slide-substeps',
  ) as HTMLInputElement | null;
  if (sSubsteps) {
    sSubsteps.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      engine.getConfig().subSteps = val;
      const vSub = document.getElementById('val-substeps');
      if (vSub) vSub.textContent = val.toString();
    });
  }

  const sBuffer = document.getElementById(
    'slide-buffer',
  ) as HTMLInputElement | null;
  if (sBuffer) {
    sBuffer.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      engine.getConfig().hazardProximityBuffer = val;
      const vBuf = document.getElementById('val-buffer');
      if (vBuf) vBuf.textContent = `${val}px`;
    });
  }

  // Buy upgrade buttons bindings
  const buyUpgrade = (
    btnId: string,
    type: 'shield' | 'magnet' | 'tether',
    costMultiplier: number,
  ) => {
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
          ui.updateCoreCount(
            engine.getSparkState().collectedInRun,
            saveState.totalCores,
          );
          ui.appendLog(
            `Successfully installed hardware upgrade: ${type.toUpperCase()}`,
            'success',
          );
        } else {
          ui.appendLog(
            `Insufficient core balance for upgrade: ${type.toUpperCase()}`,
            'warn',
          );
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
        const currentIdx = saveState.unlockedSkins.indexOf(
          saveState.activeSkinId,
        );
        const nextIdx = (currentIdx + 1) % saveState.unlockedSkins.length;
        saveState.activeSkinId = saveState.unlockedSkins[nextIdx];
        saveState.save();
        ui.syncSkinButton(saveState);
        ui.appendLog(
          `Visual theme changed to: ${SHIP_SKINS[saveState.activeSkinId].name.toUpperCase()}`,
          'info',
        );
      } else {
        // Still skins to unlock
        const nextSkin = SHIP_SKINS[nextSkinId];
        if (saveState.totalCores >= nextSkin.cost) {
          saveState.totalCores -= nextSkin.cost;
          saveState.unlockedSkins.push(nextSkin.id);
          saveState.activeSkinId = nextSkin.id;
          saveState.save();
          ui.syncSkinButton(saveState);
          ui.updateCoreCount(
            engine.getSparkState().collectedInRun,
            saveState.totalCores,
          );
          ui.appendLog(
            `Successfully unlocked visual theme: ${nextSkin.name.toUpperCase()}`,
            'success',
          );
        } else {
          ui.appendLog(
            `Insufficient core balance for visual theme: ${nextSkin.name.toUpperCase()}`,
            'warn',
          );
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
      resetToSplash();
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
          pauseRun();
        } else if (
          activeTab === ViewTab.COCKPIT &&
          phaseBefore === GamePhase.PAUSED
        ) {
          resumeRun();
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
        pauseRun();
      }
      synth.suspendContext();
    } else {
      if (engine.getGamePhase() === GamePhase.FLYING && !synth.getIsMuted()) {
        synth.resumeContext();
      }
    }
  });

  // Start precision loop
  requestAnimationFrame(gameLoop);
});

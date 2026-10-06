import { GameSaveState } from './state/saveState';
import { SynthManager } from './audio/synth';
import { ParticleEngine } from './effects/particles';
import { GravityPivotEngine } from './engine/engine';
import { createDailyContext } from './engine/runRules';
import { CanvasRenderer } from './renderer/canvasRenderer';
import { UIController } from './ui/uiController';
import { EngineCallbacks, CalibrationState, RunContext } from './types';
import { GamePhase, ViewTab, DEFAULT_CONFIG, SHIP_SKINS } from './constants';
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
      const dailyContext = createDailyContext(new Date());
      runContext = dailyContext;
      ui.appendLog(
        `Daily challenge ${dailyContext.challengeId}, rules v${dailyContext.rulesVersion}. Tether auto-selects the nearest anchor.`,
        'alert',
      );
      ui.updatePersonalBest(
        saveState.getDailyChallengeBest(
          dailyContext.challengeId,
          dailyContext.rulesVersion,
        ),
        true,
      );
    } else {
      runContext = { mode: 'STANDARD' };
      ui.appendLog('Standard navigation path loaded.', 'info');
      ui.updatePersonalBest(saveState.highScores[0]?.score ?? 0, false);
    }
    engine.initializeLevel(runContext, saveState.upgrades);
    ui.updateCoreCount(
      engine.getSparkState().collectedInRun,
      saveState.totalCores,
    );
    engine.setGamePhase(GamePhase.FLYING);
    canvas.focus({ preventScroll: true });
    ui.announceStatus(
      isDaily ? 'Daily challenge started.' : 'Standard flight started.',
    );
    ui.showLaunchOverlay(false);
    ui.showPauseOverlay(false);
    ui.hideGameOverPanel();
    resetFrameClock();
    synth.init();
    synth.setMute(saveState.preferences.muted);
    if (!synth.getIsMuted()) synth.resumeContext();
  };

  // 2. Wire up callbacks (engine -> UI/audio)
  const callbacks: EngineCallbacks = {
    onShieldChanged: (current, max) => {
      ui.updateShieldDisplay(current, max);
    },
    onScoreChanged: (score, combo) => {
      ui.updateScore(score, combo);
    },
    onCoreCollected: (runCores, coreX, coreY) => {
      const totalCores = saveState.awardCores(1);
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
      ui.announceStatus('Flight ended after a collision. Results are shown.');
      const { x, y, score: finalScore, sectorReached } = result;
      const dailyContext =
        result.context.mode === 'DAILY' ? result.context : null;
      const endedInDaily = dailyContext !== null;
      const previousBest = dailyContext
        ? saveState.getDailyChallengeBest(
            dailyContext.challengeId,
            dailyContext.rulesVersion,
          )
        : (saveState.highScores[0]?.score ?? 0);
      const isNewHighScore = !endedInDaily && finalScore > previousBest;
      const isNewDailyBest = dailyContext
        ? saveState.updateDailyChallengeBest(
            dailyContext.challengeId,
            dailyContext.rulesVersion,
            finalScore,
          )
        : false;
      if (!endedInDaily) saveState.addHighScore(finalScore, sectorReached);
      const dailyBest = dailyContext
        ? saveState.getDailyChallengeBest(
            dailyContext.challengeId,
            dailyContext.rulesVersion,
          )
        : 0;
      const bestScore = endedInDaily
        ? dailyBest
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
        dailyBest,
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
  const engine = new GravityPivotEngine(
    saveState.upgrades,
    callbacks,
    calibration,
  );

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
    const rect = canvas.getBoundingClientRect();
    renderer.setupResizing(rect.width, rect.height);
  };
  window.addEventListener('resize', resizeGame);
  const resizeObserver = new ResizeObserver(resizeGame);
  resizeObserver.observe(canvas.parentElement ?? canvas);
  resizeGame(); // Initial resize alignment
  requestAnimationFrame(resizeGame); // Reconcile after browser layout settles

  function resetFrameClock(): void {
    accumulator = 0;
    lastTime = performance.now();
  }

  function pauseRun(): void {
    if (engine.getGamePhase() !== GamePhase.FLYING) return;
    cancelHeldInputs();
    engine.setGamePhase(GamePhase.PAUSED);
    ui.showPauseOverlay(true);
    ui.announceStatus('Flight paused.');
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
    canvas.focus({ preventScroll: true });
    ui.showPauseOverlay(false);
    ui.announceStatus('Flight resumed.');
    resetFrameClock();
    if (!synth.getIsMuted()) synth.resumeContext();
  }

  function resetToSplash(): void {
    cancelHeldInputs();
    particles.clear();
    engine.initializeLevel(runContext, saveState.upgrades);
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
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion =
    saveState.preferences.reducedMotion ?? motionQuery.matches;
  renderer.setReducedMotion(reducedMotion);
  document.documentElement.dataset.reducedMotion = String(reducedMotion);

  const debugMode =
    new URLSearchParams(window.location.search).get('debug') === '1';
  document.querySelectorAll<HTMLElement>('.debug-only').forEach((element) => {
    element.hidden = !debugMode;
  });
  synth.restoreMutePreference(saveState.preferences.muted);

  // 7. Bind controls & input handlers
  const heldSources = new Set<string>();
  let activePointerId: number | null = null;
  function cancelHeldInputs(): void {
    heldSources.clear();
    activePointerId = null;
    engine.releaseTether();
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || activePointerId !== null)
      return;
    if (activeTab !== ViewTab.COCKPIT) return;
    const phase = engine.getGamePhase();
    if (phase === GamePhase.SPLASH || phase === GamePhase.PAUSED) return;
    event.preventDefault();
    if (phase === GamePhase.CRASHED) {
      ui.hideGameOverPanel();
      startRun(isDailyMode);
      canvas.focus({ preventScroll: true });
      return;
    }
    const coords = ui.getWorldCoords(
      event.clientX,
      event.clientY,
      engine.getSparkState().x,
      canvas,
    );
    if (!coords) return;
    activePointerId = event.pointerId;
    heldSources.add('pointer');
    canvas.setPointerCapture(event.pointerId);
    if (heldSources.size === 1)
      engine.acquireTether(coords.worldX, coords.worldY);
  };

  const releasePointer = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    heldSources.delete('pointer');
    if (heldSources.size === 0) engine.releaseTether();
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  window.addEventListener('blur', cancelHeldInputs);

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
      const applied = engine.setBaseSpeed(val);
      const vSpeed = document.getElementById('val-speed');
      if (vSpeed) {
        vSpeed.textContent = applied
          ? val.toFixed(1)
          : engine.getConfig().baseSpeed.toFixed(1);
      }
      if (!applied) sSpeed.value = engine.getConfig().baseSpeed.toFixed(1);
    });
  }

  const sSubsteps = document.getElementById(
    'slide-substeps',
  ) as HTMLInputElement | null;
  if (sSubsteps) {
    sSubsteps.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      const applied = engine.setSubSteps(val);
      const vSub = document.getElementById('val-substeps');
      if (vSub)
        vSub.textContent = String(applied ? val : engine.getConfig().subSteps);
      if (!applied) sSubsteps.value = String(engine.getConfig().subSteps);
    });
  }

  const sBuffer = document.getElementById(
    'slide-buffer',
  ) as HTMLInputElement | null;
  if (sBuffer) {
    sBuffer.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      const applied = engine.setHazardProximityBuffer(val);
      const vBuf = document.getElementById('val-buffer');
      const buffer = applied ? val : engine.getConfig().hazardProximityBuffer;
      if (vBuf) vBuf.textContent = `${buffer}px`;
      if (!applied) sBuffer.value = String(buffer);
    });
  }

  // Buy upgrade buttons bindings
  const buyUpgrade = (btnId: string, type: 'shield' | 'magnet' | 'tether') => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        if (saveState.purchaseUpgrade(type)) {
          engine.syncUpgrades(saveState.upgrades);
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
            `Upgrade unavailable: ${type.toUpperCase()} requires more cores or is at maximum level.`,
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

  buyUpgrade('buy-shield-btn', 'shield');
  buyUpgrade('buy-magnet-btn', 'magnet');
  buyUpgrade('buy-tether-btn', 'tether');

  // Buy visual theme skin card binding
  const buySkinBtn = document.getElementById('buy-skin-btn');
  if (buySkinBtn) {
    buySkinBtn.addEventListener('click', () => {
      const result = saveState.purchaseNextSkin();
      if (result === 'cycled') {
        ui.syncSkinButton(saveState);
        ui.appendLog(
          `Visual theme changed to: ${SHIP_SKINS[saveState.activeSkinId].name.toUpperCase()}`,
          'info',
        );
      } else if (result === 'purchased') {
        ui.syncSkinButton(saveState);
        ui.updateCoreCount(
          engine.getSparkState().collectedInRun,
          saveState.totalCores,
        );
        ui.appendLog(
          `Successfully unlocked visual theme: ${SHIP_SKINS[saveState.activeSkinId].name.toUpperCase()}`,
          'success',
        );
      } else {
        ui.appendLog(
          'Insufficient core balance for the next visual theme.',
          'warn',
        );
        buySkinBtn.classList.add('flash-error');
        setTimeout(() => {
          buySkinBtn.classList.remove('flash-error');
        }, 400);
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
    const syncMuteLabel = () => {
      const muted = synth.getIsMuted();
      unmuteBtn.setAttribute('aria-pressed', String(!muted));
      const textSpan = unmuteBtn.querySelector('.synth-toggle-text');
      if (textSpan) textSpan.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
      unmuteBtn.setAttribute(
        'aria-label',
        muted ? 'Turn sound on' : 'Turn sound off',
      );
    };
    syncMuteLabel();
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
      saveState.setPreference('muted', synth.getIsMuted());
      syncMuteLabel();
    });
  }

  const motionPreference = document.getElementById(
    'motion-preference',
  ) as HTMLSelectElement | null;
  if (motionPreference) {
    motionPreference.value =
      saveState.preferences.reducedMotion === null
        ? 'system'
        : saveState.preferences.reducedMotion
          ? 'reduced'
          : 'full';
    motionPreference.addEventListener('change', () => {
      const value = motionPreference.value;
      const preference = value === 'system' ? null : value === 'reduced';
      saveState.setPreference('reducedMotion', preference);
      reducedMotion = preference ?? motionQuery.matches;
      renderer.setReducedMotion(reducedMotion);
      document.documentElement.dataset.reducedMotion = String(reducedMotion);
    });
  }
  motionQuery.addEventListener('change', (event) => {
    if (saveState.preferences.reducedMotion !== null) return;
    reducedMotion = event.matches;
    renderer.setReducedMotion(reducedMotion);
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  });

  // Keyboard navigation & controls bindings
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (activeTab !== ViewTab.COCKPIT) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        target.matches('button, input, textarea, select, a, [role="button"]'))
    )
      return;

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
      if (document.activeElement !== canvas) return;
      e.preventDefault();
      const wasAlreadyHeld = heldSources.size > 0;
      heldSources.add('keyboard');
      if (!wasAlreadyHeld) engine.acquireTether();
    }
    if (e.code === 'KeyR') {
      resetToSplash();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      heldSources.delete('keyboard');
      if (heldSources.size === 0) engine.releaseTether();
    }
  });

  // Tab bindings
  const bindTab = (tabId: string, tab: ViewTab) => {
    const btn = document.getElementById(tabId);
    if (btn) {
      btn.addEventListener('click', () => {
        cancelHeldInputs();
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
      cancelHeldInputs();
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

import { CalibrationState } from '../types';
import { ViewTab, DEFAULT_CONFIG, upgradeCost, SHIP_SKINS } from '../constants';
import { GameSaveState } from '../state/saveState';

export class UIController {
  private elements: Record<string, HTMLElement | null> = {};

  constructor() {
    this.cacheElements();
  }

  private cacheElements(): void {
    const ids = [
      'mini-shield', 'mini-cores', 'unmute-btn', 'shield-heart-container',
      'sector-hud-label', 'sector-hud-bar', 'hud-run-cores', 'hud-score', 'hud-combo',
      'launch-prompt-overlay', 'btn-splash-launch', 'sector-milestone-popup',
      'sector-milestone-title', 'btn-play', 'danger-warning', 'shop-cores-count',
      'upg-shield-level', 'upg-magnet-level', 'upg-tether-level',
      'buy-shield-btn', 'buy-shield-label', 'buy-shield-cost',
      'buy-magnet-btn', 'buy-magnet-label', 'buy-magnet-cost',
      'buy-tether-btn', 'buy-tether-label', 'buy-tether-cost',
      'telemetry-sigma', 'telemetry-velocity', 'telemetry-reach', 'telemetry-cores',
      'synth-freq', 'synth-mod', 'synth-tempo', 'metric-log',
      'slide-speed', 'slide-substeps', 'slide-buffer',
      'val-speed', 'val-substeps', 'val-buffer',
      'toggle-substep', 'toggle-safety', 'toggle-singularity',
      'pause-overlay', 'resume-btn',
      'tab-cockpit', 'tab-terminal', 'tab-telemetry', 'tab-calibration',
      'view-cockpit', 'view-terminal', 'view-telemetry', 'view-calibration',
      'leaderboard-list', 'hud-personal-best', 'game-over-panel',
      'game-over-score', 'game-over-sector', 'game-over-best', 'game-over-label',
      'game-over-retry', 'buy-skin-btn', 'buy-skin-label', 'buy-skin-cost', 'upg-skin-name',
      'hud-pb-label'
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) {
        console.warn(`[UIController] Element with ID '${id}' was not found in the DOM.`);
      }
      this.elements[id] = el;
    });
  }

  public updateShieldDisplay(current: number, max: number): void {
    const container = this.elements['shield-heart-container'];
    if (container) {
      container.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const filled = i < current;
        const heart = document.createElement('span');
        heart.className = `mono ${filled ? 'text-emerald-400' : 'text-slate-800'}`;
        heart.style.fontSize = '12px';
        heart.textContent = filled ? '◆' : '◇';
        container.appendChild(heart);
      }
    }

    const miniShield = this.elements['mini-shield'];
    if (miniShield) {
      miniShield.textContent = `${current}/${max}`;
    }
  }

  public updateScore(score: number, combo: number): void {
    const hScore = this.elements['hud-score'];
    const hCombo = this.elements['hud-combo'];
    if (hScore) {
      hScore.textContent = String(Math.floor(score)).padStart(5, '0');
    }
    if (hCombo) {
      hCombo.textContent = `x${combo}`;
    }
  }

  public updateCoreCount(runCores: number, totalCores: number): void {
    const rCores = this.elements['hud-run-cores'];
    const mCores = this.elements['mini-cores'];
    const sCores = this.elements['shop-cores-count'];
    const tCores = this.elements['telemetry-cores'];

    if (rCores) rCores.textContent = runCores.toString();
    if (mCores) mCores.textContent = totalCores.toString();
    if (sCores) sCores.textContent = totalCores.toString();
    if (tCores) tCores.textContent = totalCores.toString();
  }

  public updateSectorProgress(progress: number, sectorIndex: number): void {
    const bEl = this.elements['sector-hud-bar'];
    const lEl = this.elements['sector-hud-label'];
    if (bEl) {
      bEl.style.width = `${progress * 100}%`;
    }
    if (lEl) {
      lEl.textContent = `SEC ${sectorIndex}`;
    }
  }

  public updateTelemetry(sigma: string, velocity: string, reach: string): void {
    const sEl = this.elements['telemetry-sigma'];
    const vEl = this.elements['telemetry-velocity'];
    const rEl = this.elements['telemetry-reach'];

    if (sEl) sEl.textContent = sigma;
    if (vEl) vEl.textContent = velocity;
    if (rEl) rEl.textContent = reach;
  }

  public updateSynthDisplay(freq: string, filter: string, tempo: string): void {
    const fEl = this.elements['synth-freq'];
    const mEl = this.elements['synth-mod'];
    const tEl = this.elements['synth-tempo'];

    if (fEl) fEl.textContent = freq;
    if (mEl) mEl.textContent = filter;
    if (tEl) tEl.textContent = tempo;
  }

  public showDangerWarning(active: boolean): void {
    const dWarning = this.elements['danger-warning'];
    if (dWarning) {
      dWarning.style.opacity = active ? '1' : '0';
    }
  }

  public showSectorPopup(sectorIndex: number): void {
    const popup = this.elements['sector-milestone-popup'];
    const sTitle = this.elements['sector-milestone-title'];
    if (popup) {
      if (sTitle) {
        sTitle.textContent = `SECTOR ${sectorIndex}`;
      }
      popup.style.opacity = '1';
      setTimeout(() => {
        popup.style.opacity = '0';
      }, 2200);
    }
  }

  public showPauseOverlay(visible: boolean): void {
    const overlay = this.elements['pause-overlay'];
    if (overlay) {
      overlay.style.opacity = visible ? '1' : '0';
      overlay.style.pointerEvents = visible ? 'auto' : 'none';
    }
  }

  public showLaunchOverlay(visible: boolean): void {
    const overlay = this.elements['launch-prompt-overlay'];
    if (overlay) {
      overlay.style.opacity = visible ? '1' : '0';
      overlay.style.pointerEvents = visible ? 'auto' : 'none';
    }
  }

  public appendLog(message: string, style: 'info' | 'warn' | 'alert' | 'success'): void {
    const container = this.elements['metric-log'];
    if (!container) return;

    const div = document.createElement('div');
    const styles = {
      info: 'color: #22d3ee;',
      warn: 'color: #fbbf24;',
      alert: 'color: #f43f5e;',
      success: 'color: #10b981;'
    };
    div.className = 'mono';
    div.style.cssText = styles[style] || 'color: #94a3b8;';
    div.style.fontSize = '9px';
    div.style.lineHeight = '1.5';
    
    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    div.textContent = `> [${timestamp}] ${message}`;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    while (container.children.length > 25) {
      container.removeChild(container.firstChild!);
    }
  }

  public syncUpgradeButtons(saveState: GameSaveState): void {
    const maxLevel = DEFAULT_CONFIG.maxUpgradeLevel;

    const uShield = this.elements['upg-shield-level'];
    const uMagnet = this.elements['upg-magnet-level'];
    const uTether = this.elements['upg-tether-level'];

    if (uShield) uShield.textContent = `Lvl ${saveState.shieldLvl}`;
    if (uMagnet) uMagnet.textContent = `Lvl ${saveState.magnetLvl}`;
    if (uTether) uTether.textContent = `Lvl ${saveState.tetherLvl}`;

    const syncButton = (btnId: string, labelId: string, costId: string, curLvl: number, baseCost: number) => {
      const btn = this.elements[btnId] as HTMLButtonElement | null;
      const label = this.elements[labelId];
      const cost = this.elements[costId];
      if (!btn) return;

      if (curLvl >= maxLevel) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        if (label) label.textContent = "MAX LEVEL";
        if (cost) cost.textContent = "CAPPED";
      } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        if (cost) cost.textContent = `${upgradeCost(baseCost, curLvl)} Cores`;
      }
    };

    syncButton('buy-shield-btn', 'buy-shield-label', 'buy-shield-cost', saveState.shieldLvl, 10);
    syncButton('buy-magnet-btn', 'buy-magnet-label', 'buy-magnet-cost', saveState.magnetLvl, 15);
    syncButton('buy-tether-btn', 'buy-tether-label', 'buy-tether-cost', saveState.tetherLvl, 20);
  }

  public switchTab(tab: ViewTab, activeTab: ViewTab): ViewTab {
    const tabs = {
      [ViewTab.COCKPIT]: { btn: 'tab-cockpit', view: 'view-cockpit' },
      [ViewTab.TERMINAL]: { btn: 'tab-terminal', view: 'view-terminal' },
      [ViewTab.TELEMETRY]: { btn: 'tab-telemetry', view: 'view-telemetry' },
      [ViewTab.CALIBRATION]: { btn: 'tab-calibration', view: 'view-calibration' }
    };

    const current = tabs[activeTab];
    const target = tabs[tab];

    if (current && target) {
      const curBtn = this.elements[current.btn];
      const targetBtn = this.elements[target.btn];
      const curView = this.elements[current.view];
      const targetView = this.elements[target.view];

      if (curBtn) {
        curBtn.classList.remove('tab-active');
      }
      if (targetBtn) {
        targetBtn.classList.add('tab-active');
      }

      if (curView) {
        curView.classList.remove('view-active');
        curView.classList.add('view-hidden');
      }
      if (targetView) {
        targetView.classList.remove('view-hidden');
        targetView.classList.add('view-active');
      }
    }

    return tab;
  }

  public getCalibrationState(): CalibrationState {
    const substepEl = this.elements['toggle-substep'] as HTMLInputElement | null;
    const safetyEl = this.elements['toggle-safety'] as HTMLInputElement | null;
    const singularityEl = this.elements['toggle-singularity'] as HTMLInputElement | null;

    return {
      subSteppingEnabled: substepEl ? substepEl.checked : true,
      safetyGapsEnabled: safetyEl ? safetyEl.checked : true,
      collinearFallbackEnabled: singularityEl ? singularityEl.checked : true
    };
  }

  public getWorldCoords(clientX: number, clientY: number, sparkX: number, canvas: HTMLCanvasElement): { worldX: number; worldY: number } {
    const rect = canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    
    const width = rect.width || 1;
    const height = rect.height || 1;
    const localX = (cssX / width) * (canvas.width / (window.devicePixelRatio || 1));
    const localY = (cssY / height) * (canvas.height / (window.devicePixelRatio || 1));
    
    const cameraOffsetX = Math.round(-sparkX + 150);
    return {
      worldX: localX - cameraOffsetX,
      worldY: localY
    };
  }

  public syncSkinButton(saveState: GameSaveState): void {
    const btn = this.elements['buy-skin-btn'] as HTMLButtonElement | null;
    const label = this.elements['buy-skin-label'];
    const cost = this.elements['buy-skin-cost'];
    const skinNameLabel = this.elements['upg-skin-name'];

    const activeSkin = SHIP_SKINS.find(s => s.id === saveState.activeSkinId) || SHIP_SKINS[0];
    if (skinNameLabel) {
      skinNameLabel.textContent = activeSkin.name.toUpperCase();
    }

    if (!btn) return;

    const nextSkinId = saveState.unlockedSkins.length;
    if (nextSkinId >= SHIP_SKINS.length) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      if (label) label.textContent = "Cycle Active Theme";
      if (cost) cost.textContent = "FREE";
    } else {
      const nextSkin = SHIP_SKINS[nextSkinId];
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      if (label) label.textContent = `Unlock ${nextSkin.name}`;
      if (cost) cost.textContent = `${nextSkin.cost} Cores`;
    }
  }

  public updateLeaderboardDisplay(highScores: Array<{ score: number; sector: number; date: string }>): void {
    const container = this.elements['leaderboard-list'];
    if (!container) return;

    container.innerHTML = '';
    if (highScores.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'leaderboard-entry';
      empty.style.justifyContent = 'center';
      empty.style.color = 'var(--text-muted)';
      empty.textContent = 'NO TELEMETRY RECORDED';
      container.appendChild(empty);
      return;
    }

    highScores.forEach((score, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry';
      
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `#${index + 1}`;
      
      const scoreVal = document.createElement('span');
      scoreVal.className = 'score';
      scoreVal.textContent = String(score.score).padStart(5, '0');
      
      const sector = document.createElement('span');
      sector.className = 'sector';
      sector.textContent = `SEC ${score.sector}`;
      
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = score.date;
      
      row.appendChild(rank);
      row.appendChild(scoreVal);
      row.appendChild(sector);
      row.appendChild(date);
      container.appendChild(row);
    });
  }

  public updatePersonalBest(score: number, isDailyMode: boolean): void {
    const pb = this.elements['hud-personal-best'];
    const label = this.elements['hud-pb-label'];
    if (pb) {
      pb.textContent = String(Math.floor(score)).padStart(5, '0');
    }
    if (label) {
      label.textContent = isDailyMode ? 'Daily Best' : 'Personal Best';
    }
  }

  public showGameOverPanel(
    finalScore: number,
    sectorReached: number,
    isNewHighScore: boolean,
    personalBest: number,
    isNewDailyBest: boolean,
    dailyBest: number,
    isDailyMode: boolean
  ): void {
    const overlay = this.elements['game-over-panel'];
    const scoreVal = this.elements['game-over-score'];
    const sectorVal = this.elements['game-over-sector'];
    const bestVal = this.elements['game-over-best'];
    const label = this.elements['game-over-label'];

    const statLabels = overlay ? overlay.querySelectorAll('.stat-label') : [];
    if (statLabels.length >= 3) {
      statLabels[2].textContent = isDailyMode ? 'DAILY BEST' : 'PERSONAL BEST';
    }

    if (scoreVal) scoreVal.textContent = String(Math.floor(finalScore)).padStart(5, '0');
    if (sectorVal) sectorVal.textContent = `SEC ${sectorReached}`;
    
    const displayBest = isDailyMode ? dailyBest : personalBest;
    if (bestVal) bestVal.textContent = String(Math.floor(displayBest)).padStart(5, '0');

    if (label) {
      if (isDailyMode) {
        if (isNewDailyBest) {
          label.textContent = 'NEW DAILY BEST!';
          label.className = 'game-over-title new-high-score-badge';
        } else {
          label.textContent = 'DAILY MISSION FAILED';
          label.className = 'game-over-title';
        }
      } else {
        if (isNewHighScore) {
          label.textContent = 'NEW HIGH SCORE!';
          label.className = 'game-over-title new-high-score-badge';
        } else {
          label.textContent = 'VESSEL CRASHED';
          label.className = 'game-over-title';
        }
      }
    }

    if (overlay) {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
    }
  }

  public hideGameOverPanel(): void {
    const overlay = this.elements['game-over-panel'];
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
    }
  }
}

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { UIController } from '../src/ui/uiController';
import { ViewTab } from '../src/constants';

// --- Minimal DOM mocks (deterministic, no jsdom dependency) ---

const createMockElement = () => ({
  style: {} as Record<string, string>,
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
  textContent: '',
  innerHTML: '',
  disabled: false,
  checked: false,
  children: [] as unknown[],
  scrollTop: 0,
  scrollHeight: 0,
  appendChild: vi.fn(function (this: any, child: unknown) {
    this.children.push(child);
  }),
  removeChild: vi.fn(function (this: any) {
    this.children.shift();
  }),
  querySelector: vi.fn(() => null),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  click: vi.fn(),
});

describe('UIController', () => {
  let ui: UIController;
  let elementsById: Record<string, any>;

  beforeEach(() => {
    elementsById = {};
    const mockDocument = {
      getElementById: (id: string) => {
        if (!elementsById[id]) elementsById[id] = createMockElement();
        return elementsById[id];
      },
      createElement: () => createMockElement(),
    };
    Object.defineProperty(globalThis, 'document', {
      value: mockDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { devicePixelRatio: 2 },
      writable: true,
      configurable: true,
    });
    ui = new UIController();
  });

  const el = (id: string) => (ui as any).elements[id];

  // --- Touch / pointer coordinate conversion ---

  test('should convert screen coordinates to world coordinates', () => {
    const canvas = {
      width: 800,
      height: 400,
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 400,
        height: 200,
      }),
    } as unknown as HTMLCanvasElement;

    // sparkX = 100 -> cameraOffsetX = -100 + 150 = 50
    const coords = ui.getWorldCoords(210, 120, 100, canvas);
    // cssX = 200, cssY = 100
    // localX = (200/400) * (800/2) = 200; localY = (100/200) * (400/2) = 100
    // worldX = 200 - 50 = 150; worldY = 100
    expect(coords.worldX).toBe(150);
    expect(coords.worldY).toBe(100);
  });

  test('should shift world coordinates based on spark camera offset', () => {
    const canvas = {
      width: 800,
      height: 400,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 400,
        height: 200,
      }),
    } as unknown as HTMLCanvasElement;

    // sparkX = 1150 -> cameraOffsetX = -1150 + 150 = -1000
    const coords = ui.getWorldCoords(200, 100, 1150, canvas);
    // localX = 200 -> worldX = 200 - (-1000) = 1200
    expect(coords.worldX).toBe(1200);
  });

  // --- Pause overlay ---

  test('should toggle pause overlay visibility and pointer events', () => {
    ui.showPauseOverlay(true);
    expect(el('pause-overlay').style.opacity).toBe('1');
    expect(el('pause-overlay').style.pointerEvents).toBe('auto');

    ui.showPauseOverlay(false);
    expect(el('pause-overlay').style.opacity).toBe('0');
    expect(el('pause-overlay').style.pointerEvents).toBe('none');
  });

  test('should toggle launch overlay visibility and pointer events', () => {
    ui.showLaunchOverlay(true);
    expect(el('launch-prompt-overlay').style.opacity).toBe('1');
    expect(el('launch-prompt-overlay').style.pointerEvents).toBe('auto');

    ui.showLaunchOverlay(false);
    expect(el('launch-prompt-overlay').style.opacity).toBe('0');
    expect(el('launch-prompt-overlay').style.pointerEvents).toBe('none');
  });

  // --- Game over panel (repeat play surface) ---

  test('should populate and show game over panel', () => {
    ui.showGameOverPanel(1234, 3, true, 5000, false, 0, false);

    expect(el('game-over-score').textContent).toBe('01234');
    expect(el('game-over-sector').textContent).toBe('SEC 3');
    expect(el('game-over-best').textContent).toBe('05000');
    expect(el('game-over-label').textContent).toBe('NEW HIGH SCORE!');
    expect(el('game-over-panel').style.opacity).toBe('1');
    expect(el('game-over-panel').style.pointerEvents).toBe('auto');
  });

  test('should show daily best label in daily mode', () => {
    ui.showGameOverPanel(800, 2, false, 900, true, 900, true);
    expect(el('game-over-label').textContent).toBe('NEW DAILY BEST!');
    expect(el('game-over-best').textContent).toBe('00900');
  });

  test('should hide game over panel', () => {
    ui.hideGameOverPanel();
    expect(el('game-over-panel').style.opacity).toBe('0');
    expect(el('game-over-panel').style.pointerEvents).toBe('none');
  });

  // --- Tab switching ---

  test('should switch active tab classes', () => {
    ui.switchTab(ViewTab.TERMINAL, ViewTab.COCKPIT);

    expect(el('tab-cockpit').classList.remove).toHaveBeenCalledWith(
      'tab-active',
    );
    expect(el('tab-terminal').classList.add).toHaveBeenCalledWith('tab-active');
    expect(el('view-cockpit').classList.remove).toHaveBeenCalledWith(
      'view-active',
    );
    expect(el('view-cockpit').classList.add).toHaveBeenCalledWith(
      'view-hidden',
    );
    expect(el('view-terminal').classList.remove).toHaveBeenCalledWith(
      'view-hidden',
    );
    expect(el('view-terminal').classList.add).toHaveBeenCalledWith(
      'view-active',
    );
  });

  // --- HUD sync ---

  test('should pad score and render combo multiplier', () => {
    ui.updateScore(42, 3);
    expect(el('hud-score').textContent).toBe('00042');
    expect(el('hud-combo').textContent).toBe('x3');
  });

  test('should sync core counts across HUD, shop and telemetry', () => {
    ui.updateCoreCount(5, 120);
    expect(el('hud-run-cores').textContent).toBe('5');
    expect(el('mini-cores').textContent).toBe('120');
    expect(el('shop-cores-count').textContent).toBe('120');
    expect(el('telemetry-cores').textContent).toBe('120');
  });

  test('should render shield hearts for current and max shield', () => {
    el('shield-heart-container').innerHTML = '';
    ui.updateShieldDisplay(2, 3);
    expect(el('shield-heart-container').appendChild).toHaveBeenCalledTimes(3);
    expect(el('mini-shield').textContent).toBe('2/3');
  });

  test('should update sector progress bar and label', () => {
    ui.updateSectorProgress(0.75, 3);
    expect(el('sector-hud-bar').style.width).toBe('75%');
    expect(el('sector-hud-label').textContent).toBe('SEC 3');
  });

  test('should toggle danger warning opacity', () => {
    ui.showDangerWarning(true);
    expect(el('danger-warning').style.opacity).toBe('1');
    ui.showDangerWarning(false);
    expect(el('danger-warning').style.opacity).toBe('0');
  });

  test('should update telemetry readouts', () => {
    ui.updateTelemetry('σ = 1', '360 px/s', '180px');
    expect(el('telemetry-sigma').textContent).toBe('σ = 1');
    expect(el('telemetry-velocity').textContent).toBe('360 px/s');
    expect(el('telemetry-reach').textContent).toBe('180px');
  });

  test('should update synth parameter readouts', () => {
    ui.updateSynthDisplay('120 Hz', '900 Hz', '7.5 Hz');
    expect(el('synth-freq').textContent).toBe('120 Hz');
    expect(el('synth-mod').textContent).toBe('900 Hz');
    expect(el('synth-tempo').textContent).toBe('7.5 Hz');
  });

  test('should update personal best display and label', () => {
    ui.updatePersonalBest(1234, false);
    expect(el('hud-personal-best').textContent).toBe('01234');
    expect(el('hud-pb-label').textContent).toBe('Personal Best');

    ui.updatePersonalBest(500, true);
    expect(el('hud-pb-label').textContent).toBe('Daily Best');
  });

  // --- Sector popup ---

  test('should show sector popup and auto-hide after timeout', () => {
    vi.useFakeTimers();
    ui.showSectorPopup(3);
    expect(el('sector-milestone-title').textContent).toBe('SECTOR 3');
    expect(el('sector-milestone-popup').style.opacity).toBe('1');
    vi.advanceTimersByTime(2300);
    expect(el('sector-milestone-popup').style.opacity).toBe('0');
    vi.useRealTimers();
  });

  // --- Log ---

  test('should append timestamped log entries', () => {
    el('metric-log').appendChild = vi.fn();
    ui.appendLog('Test message', 'info');
    expect(el('metric-log').appendChild).toHaveBeenCalledTimes(1);
  });

  test('should cap log history at 25 entries', () => {
    const container = el('metric-log');
    container.children = new Array(25).fill({});
    ui.appendLog('overflow', 'info');
    expect(container.removeChild).toHaveBeenCalled();
    expect(container.children.length).toBe(25);
  });

  // --- Leaderboard ---

  test('should render leaderboard entries', () => {
    el('leaderboard-list').innerHTML = '';
    el('leaderboard-list').appendChild = vi.fn();
    ui.updateLeaderboardDisplay([
      { score: 500, sector: 2, date: 'Oct 6' },
      { score: 300, sector: 1, date: 'Oct 5' },
    ]);
    expect(el('leaderboard-list').appendChild).toHaveBeenCalledTimes(2);
  });

  test('should show empty state when no high scores', () => {
    el('leaderboard-list').innerHTML = '';
    el('leaderboard-list').appendChild = vi.fn();
    ui.updateLeaderboardDisplay([]);
    expect(el('leaderboard-list').appendChild).toHaveBeenCalledTimes(1);
  });

  // --- Shop sync ---

  test('should sync upgrade button labels and costs from save state', () => {
    const saveState = { shieldLvl: 2, magnetLvl: 3, tetherLvl: 1 } as any;
    ui.syncUpgradeButtons(saveState);

    expect(el('upg-shield-level').textContent).toBe('Lvl 2');
    expect(el('upg-magnet-level').textContent).toBe('Lvl 3');
    expect(el('upg-tether-level').textContent).toBe('Lvl 1');
    // upgradeCost(10, 2) = 15; upgradeCost(15, 3) = 33; upgradeCost(20, 1) = 20
    expect(el('buy-shield-cost').textContent).toBe('15 Cores');
    expect(el('buy-magnet-cost').textContent).toBe('33 Cores');
    expect(el('buy-tether-cost').textContent).toBe('20 Cores');
  });

  test('should disable and label maxed upgrade buttons', () => {
    const saveState = { shieldLvl: 10, magnetLvl: 10, tetherLvl: 10 } as any;
    ui.syncUpgradeButtons(saveState);

    expect(el('buy-shield-btn').disabled).toBe(true);
    expect(el('buy-shield-label').textContent).toBe('MAX LEVEL');
    expect(el('buy-shield-cost').textContent).toBe('CAPPED');
  });

  test('should show next skin cost when skins remain locked', () => {
    const saveState = {
      unlockedSkins: [0],
      activeSkinId: 0,
      totalCores: 0,
    } as any;
    ui.syncSkinButton(saveState);
    expect(el('buy-skin-label').textContent).toBe('Unlock Cyber Pink');
    expect(el('buy-skin-cost').textContent).toBe('30 Cores');
  });

  test('should show cycle option when all skins unlocked', () => {
    const saveState = {
      unlockedSkins: [0, 1, 2, 3],
      activeSkinId: 0,
      totalCores: 0,
    } as any;
    ui.syncSkinButton(saveState);
    expect(el('buy-skin-label').textContent).toBe('Cycle Active Theme');
    expect(el('buy-skin-cost').textContent).toBe('FREE');
  });

  // --- Calibration state ---

  test('should read calibration toggles with safe defaults', () => {
    const state = ui.getCalibrationState();
    expect(state).toEqual({
      subSteppingEnabled: false,
      safetyGapsEnabled: false,
      collinearFallbackEnabled: false,
    });

    el('toggle-substep').checked = true;
    el('toggle-safety').checked = true;
    el('toggle-singularity').checked = true;
    expect(ui.getCalibrationState()).toEqual({
      subSteppingEnabled: true,
      safetyGapsEnabled: true,
      collinearFallbackEnabled: true,
    });
  });
});

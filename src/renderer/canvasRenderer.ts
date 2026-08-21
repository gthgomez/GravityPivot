import { SparkState, MapData, TrailBuffer } from '../types';
import { ParticleEngine } from '../effects/particles';
import { FlightState, GamePhase, SHIP_SKINS } from '../constants';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shakeIntensity: number = 0;
  private floatingTexts: Array<{
    screenX: number;
    screenY: number;
    text: string;
    color: string;
    alpha: number;
    vy: number;
    life: number;
  }> = [];
  private stars: Array<{ x: number; y: number; size: number; speedMult: number }> = [];

  public triggerShake(intensity: number): void {
    this.shakeIntensity = intensity;
  }

  public spawnFloatingText(screenX: number, screenY: number, text: string, color: string): void {
    this.floatingTexts.push({
      screenX,
      screenY,
      text,
      color,
      alpha: 1.0,
      vy: -0.8,
      life: 45
    });
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D rendering context from canvas');
    }
    this.ctx = context;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public setupResizing(parentWidth: number, parentHeight: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = parentWidth * dpr;
    this.canvas.height = parentHeight * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  public draw(
    spark: Readonly<SparkState>,
    mapData: Readonly<MapData>,
    historyTrail: Readonly<TrailBuffer>,
    particles: ParticleEngine,
    maxTetherRadius: number,
    sectorIndex: number,
    gamePhase: GamePhase,
    activeSkinId: number
  ): void {
    const scale = window.devicePixelRatio || 1;
    const logicalWidth = this.canvas.width / scale;
    const logicalHeight = this.canvas.height / scale;

    const activeSkin = SHIP_SKINS.find(s => s.id === activeSkinId) || SHIP_SKINS[0];
    const shipColor = activeSkin.shipColor;
    const trailColor = activeSkin.trailColor;

    this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Initialize stars once if empty
    if (this.stars.length === 0) {
      for (let i = 0; i < 45; i++) {
        this.stars.push({
          x: Math.random() * logicalWidth,
          y: Math.random() * logicalHeight,
          size: 0.5 + Math.random() * 1.5,
          speedMult: 0.05 + Math.random() * 0.15
        });
      }
    }

    // Render stars/dust for ambient parallax depth
    const sectorHue = (sectorIndex * 40) % 360;
    this.ctx.fillStyle = `hsl(${sectorHue}, 40%, 65%)`;
    for (const star of this.stars) {
      const screenX = (star.x - (spark.x * star.speedMult)) % logicalWidth;
      const finalX = screenX < 0 ? screenX + logicalWidth : screenX;
      
      this.ctx.beginPath();
      this.ctx.arc(finalX, star.y, star.size, 0, Math.PI * 2);
      this.ctx.save();
      this.ctx.globalAlpha = 0.15 + (star.size * 0.10);
      this.ctx.fill();
      this.ctx.restore();
    }

    const cameraOffsetX = Math.round(-spark.x + 150);
    const shakeX = this.shakeIntensity > 0.5 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
    const shakeY = this.shakeIntensity > 0.5 ? (Math.random() - 0.5) * this.shakeIntensity : 0;

    this.ctx.save();
    this.ctx.translate(cameraOffsetX + shakeX, shakeY);
    this.shakeIntensity *= 0.85;

    // Draw grid lines
    this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.2)';
    this.ctx.lineWidth = 1;
    const gridGap = 40;
    const startGridX = Math.floor((spark.x - 200) / gridGap) * gridGap;
    for (let gx = startGridX; gx < startGridX + 1000; gx += gridGap) {
      this.ctx.beginPath();
      this.ctx.moveTo(Math.round(gx), 0);
      this.ctx.lineTo(Math.round(gx), 400);
      this.ctx.stroke();
    }

    // Draw Cave walls
    if (mapData.upperWallSpline.length > 0) {
      const upperSpline = new Path2D();
      upperSpline.moveTo(mapData.upperWallSpline[0].x, mapData.upperWallSpline[0].y);
      for (let i = 1; i < mapData.upperWallSpline.length; i++) {
        upperSpline.lineTo(mapData.upperWallSpline[i].x, mapData.upperWallSpline[i].y);
      }

      const upperFill = new Path2D(upperSpline);
      upperFill.lineTo(mapData.upperWallSpline[mapData.upperWallSpline.length - 1].x, 0);
      upperFill.lineTo(mapData.upperWallSpline[0].x, 0);
      upperFill.closePath();

      const lowerSpline = new Path2D();
      lowerSpline.moveTo(mapData.lowerWallSpline[0].x, mapData.lowerWallSpline[0].y);
      for (let i = 1; i < mapData.lowerWallSpline.length; i++) {
        lowerSpline.lineTo(mapData.lowerWallSpline[i].x, mapData.lowerWallSpline[i].y);
      }

      const lowerFill = new Path2D(lowerSpline);
      lowerFill.lineTo(mapData.lowerWallSpline[mapData.lowerWallSpline.length - 1].x, 400);
      lowerFill.lineTo(mapData.lowerWallSpline[0].x, 400);
      lowerFill.closePath();

      this.ctx.fillStyle = `hsl(${sectorHue}, 25%, 8%)`;
      this.ctx.fill(upperFill);
      this.ctx.fill(lowerFill);

      // Walls neon edge stroke
      this.ctx.strokeStyle = `hsl(${sectorHue}, 60%, 25%)`;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke(upperSpline);
      this.ctx.stroke(lowerSpline);
    }

    // Draw gravity pivot nodes
    for (let i = 0; i < mapData.nodes.length; i++) {
      const node = mapData.nodes[i];
      const playerDist = Math.hypot(node.x - spark.x, node.y - spark.y);
      const active = playerDist <= maxTetherRadius;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, maxTetherRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = active ? 'rgba(34, 211, 238, 0.05)' : 'rgba(255, 255, 255, 0.01)';
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#03050a';
      this.ctx.strokeStyle = active ? '#22d3ee' : '#334155';
      this.ctx.lineWidth = 2;
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = active ? '#22d3ee' : '#334155';
      this.ctx.fill();
    }

    // Draw collectible cores
    for (let i = 0; i < mapData.cores.length; i++) {
      const core = mapData.cores[i];
      if (core.collected) continue;

      this.ctx.beginPath();
      this.ctx.arc(core.x, core.y, core.radius + 3, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fill();
    }

    // Draw active gravity tether anchor connection
    if (spark.flightState === FlightState.ORBITAL) {
      const targetNode = mapData.nodes.find(n => n.id === spark.orbitalNodeId);
      if (targetNode) {
        this.ctx.beginPath();
        this.ctx.moveTo(spark.x, spark.y);
        this.ctx.lineTo(targetNode.x, targetNode.y);
        this.ctx.strokeStyle = '#22d3ee';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }

    // Draw player's flight trail
    const trailPoints = historyTrail.points;
    const trailLen = historyTrail.length;
    const trailHead = historyTrail.head;

    if (trailLen > 1) {
      this.ctx.beginPath();
      const firstIndex = trailHead % trailLen;
      const firstPt = trailPoints[firstIndex];
      this.ctx.moveTo(firstPt.x, firstPt.y);
      for (let i = 1; i < trailLen; i++) {
        const pt = trailPoints[(trailHead + i) % trailLen];
        this.ctx.lineTo(pt.x, pt.y);
      }
      this.ctx.strokeStyle = spark.combo === 5 ? '#ec4899' : trailColor;
      this.ctx.lineWidth = spark.combo === 5 ? 4 : 2;
      this.ctx.stroke();
    }

    // Draw spacecraft
    if (spark.shieldInvulnFrames % 4 < 2) {
      const heading = Math.atan2(spark.vy, spark.vx);
      this.ctx.save();
      this.ctx.translate(spark.x, spark.y);
      this.ctx.rotate(heading);

      this.ctx.beginPath();
      this.ctx.moveTo(8, 0);
      this.ctx.lineTo(-6, -5);
      this.ctx.lineTo(-3, 0);
      this.ctx.lineTo(-6, 5);
      this.ctx.closePath();

      this.ctx.fillStyle = spark.combo === 5 ? '#f43f5e' : shipColor;
      this.ctx.fill();

      // Draw active shield ring
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.restore();
    }

    this.ctx.restore();

    // Draw visual particles
    particles.draw(this.ctx, cameraOffsetX);

    // Draw crashed overlay screen
    if (gamePhase === GamePhase.CRASHED) {
      this.ctx.fillStyle = 'rgba(3, 4, 9, 0.85)';
      this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    }

    // Draw floating texts in screen space
    if (this.floatingTexts.length > 0) {
      this.ctx.save();
      this.ctx.font = 'bold 11px "Space Grotesk"';
      this.ctx.textAlign = 'center';
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        this.ctx.globalAlpha = ft.alpha;
        this.ctx.fillStyle = ft.color;
        this.ctx.fillText(ft.text, ft.screenX, ft.screenY);

        ft.screenY += ft.vy;
        ft.alpha -= 0.022;
        ft.life--;

        if (ft.life <= 0 || ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
      this.ctx.restore();
    }
  }
}

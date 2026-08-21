export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export class ParticleEngine {
  private maxParticles: number;
  private pool: Particle[];
  private activeCount: number = 0;

  constructor(maxParticles: number = 150) {
    this.maxParticles = maxParticles;
    this.pool = new Array(this.maxParticles);
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool[i] = { x: 0, y: 0, vx: 0, vy: 0, radius: 0, color: '', alpha: 0, decay: 0 };
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getPool(): ReadonlyArray<Particle> {
    return this.pool;
  }

  public spawn(x: number, y: number, color: string, speed: number = 4, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) return;

      const angle = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * speed;

      const p = this.pool[this.activeCount];
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * s;
      p.vy = Math.sin(angle) * s;
      p.radius = 1 + Math.random() * 1.5;
      p.color = color;
      p.alpha = 1.0;
      p.decay = 0.02 + Math.random() * 0.03;

      this.activeCount++;
    }
  }

  public update(): void {
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        // Swap-and-Pop garbage-free removal
        const temp = this.pool[i];
        this.pool[i] = this.pool[this.activeCount - 1];
        this.pool[this.activeCount - 1] = temp;
        this.activeCount--;
        i--;
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, cameraOffsetX: number): void {
    ctx.save();
    ctx.translate(cameraOffsetX, 0);
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.restore();
  }
}

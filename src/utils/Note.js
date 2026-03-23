import { GAME_CONFIG } from '../constants/gameConfig.js';

export class Note {
  constructor(midi, targetX, keyData, spawnX) {
    this.midi = midi;
    this.targetX = targetX;
    this.spawnX = spawnX !== undefined ? spawnX : targetX;
    this.x = this.spawnX;
    this.y = GAME_CONFIG.NOTE_START_Y;
    this.radius = GAME_CONFIG.NOTE_RADIUS;
    this.active = true;
    this.hitLand = false;
    this.baseSpeed = GAME_CONFIG.NOTE_BASE_SPEED;
    this.displayName = keyData?.name || midi;
  }

  update(bpmMultiplier, landY) {
    if (!this.active) return;
    this.y += this.baseSpeed * bpmMultiplier;

    // Lerp X from spawn position toward target key position as note falls
    // Fully arrive at targetX by the time it reaches the target zone
    const totalFallDistance = landY - GAME_CONFIG.NOTE_START_Y;
    const fallen = this.y - GAME_CONFIG.NOTE_START_Y;
    const t = Math.min(1, fallen / (totalFallDistance * 0.7));
    this.x = this.spawnX + (this.targetX - this.spawnX) * t;
  }

  draw(ctx, queuePosition) {
    if (!this.active) return;

    const color = this.getColor(queuePosition);

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = color.bg;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color.text;
    ctx.fillText(this.displayName, this.x, this.y);
  }

  getColor(queuePosition) {
    const colors = GAME_CONFIG.COLORS;
    const colorMap = [
      { bg: colors.NEXT, text: '#000' },
      { bg: colors.UPCOMING_1, text: '#000' },
      { bg: colors.UPCOMING_2, text: '#000' },
      { bg: colors.QUEUE, text: '#fff' }
    ];
    return colorMap[Math.min(queuePosition, 3)];
  }

  isInTargetZone(landY) {
    const zoneTop = landY - GAME_CONFIG.TARGET_ZONE_TOP;
    const zoneBottom = landY - GAME_CONFIG.TARGET_ZONE_BOTTOM;
    return this.y >= zoneTop && this.y <= zoneBottom;
  }

  isOffScreen(windowHeight) {
    return this.y > windowHeight;
  }
}

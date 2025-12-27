import { GAME_CONFIG } from '../constants/gameConfig.js';

export class Note {
  constructor(midi, x, keyData) {
    this.midi = midi;
    this.x = x;
    this.y = GAME_CONFIG.NOTE_START_Y;
    this.radius = GAME_CONFIG.NOTE_RADIUS;
    this.active = true;
    this.baseSpeed = GAME_CONFIG.NOTE_BASE_SPEED;
    this.displayName = keyData?.name || midi;
  }

  update(bpmMultiplier) {
    if (!this.active) return;
    this.y += this.baseSpeed * bpmMultiplier;
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

  isInTargetZone(windowHeight) {
    const targetY = windowHeight - GAME_CONFIG.BASE_BOTTOM_OFFSET;
    return this.y >= targetY - 40 && this.y <= targetY + 20;
  }

  isOffScreen(windowHeight) {
    return this.y > windowHeight;
  }
}

import { GAME_CONFIG } from '../constants/gameConfig.js';

const PIXEL_SIZE = 4;

// Building templates (# = filled pixel)
const TEMPLATES = {
  tallBuilding: [
    '  ####  ',
    '  #  #  ',
    '  #  #  ',
    '  ####  ',
    '  #  #  ',
    '  #  #  ',
    '  ####  ',
    '  #  #  ',
    '  ####  ',
  ],
  shortBuilding: [
    ' ###### ',
    ' #  # # ',
    ' #  # # ',
    ' ###### ',
    ' # ## # ',
    ' ###### ',
  ],
  wideBuilding: [
    '##########',
    '#  ##  # #',
    '#  ##  # #',
    '##########',
    '# ##  ## #',
    '##########',
  ],
  house: [
    '   ##   ',
    '  ####  ',
    ' ###### ',
    ' # ## # ',
    ' ###### ',
  ],
  pineTree: [
    '   #   ',
    '  ###  ',
    ' ##### ',
    '#######',
    '   #   ',
    '   #   ',
  ],
  oakTree: [
    '  ###  ',
    ' ##### ',
    ' ##### ',
    '  ###  ',
    '   #   ',
    '   #   ',
  ],
  bush: [
    ' ### ',
    '#####',
    '#####',
    ' ### ',
  ],
  antenna: [
    '  #  ',
    '  #  ',
    ' ### ',
    '  #  ',
    '  #  ',
    '  #  ',
    '  #  ',
  ],
};

// Ordered sets to build variety
const STRUCTURE_SETS = [
  ['tallBuilding', 'bush', 'pineTree', 'shortBuilding', 'oakTree', 'house', 'bush', 'wideBuilding', 'pineTree'],
  ['house', 'pineTree', 'wideBuilding', 'bush', 'tallBuilding', 'oakTree', 'shortBuilding', 'bush', 'pineTree'],
  ['shortBuilding', 'oakTree', 'tallBuilding', 'bush', 'house', 'pineTree', 'wideBuilding', 'bush', 'oakTree'],
];

export class LandStrip {
  constructor(canvasWidth, yPosition) {
    this.canvasWidth = canvasWidth;
    this.yPosition = yPosition;
    this.pixelSize = PIXEL_SIZE;
    this.pixels = [];
    this.generateTerrain();
  }

  generateTerrain() {
    this.pixels = [];
    const groundRows = 2;
    const groundY = this.yPosition;

    // Ground layer spanning full width
    const cols = Math.ceil(this.canvasWidth / this.pixelSize);
    for (let row = 0; row < groundRows; row++) {
      for (let col = 0; col < cols; col++) {
        this.pixels.push({
          x: col * this.pixelSize,
          y: groundY + row * this.pixelSize,
          active: true,
          shade: '#0a0',
        });
      }
    }

    // Place structures along the ground
    const set = STRUCTURE_SETS[Math.floor(Math.random() * STRUCTURE_SETS.length)];
    let cursorX = Math.floor(Math.random() * 20) + 5;
    let structIdx = 0;

    while (cursorX < this.canvasWidth - 10) {
      const templateName = set[structIdx % set.length];
      const template = TEMPLATES[templateName];
      structIdx++;

      const templateWidth = template[0].length;
      const templateHeight = template.length;

      // Place template so its bottom row sits on the ground
      const baseY = groundY - templateHeight * this.pixelSize;

      const isTree = ['pineTree', 'oakTree', 'bush'].includes(templateName);
      const shade = isTree ? '#0d0' : '#0f0';
      const trunkShade = '#080';
      const windowShade = '#050';

      for (let row = 0; row < templateHeight; row++) {
        for (let col = 0; col < templateWidth; col++) {
          if (template[row][col] === '#') {
            let pixelShade = shade;

            if (isTree) {
              // Trunk pixels: bottom rows, center column(s)
              const centerCol = Math.floor(templateWidth / 2);
              if (row >= templateHeight - 2 && Math.abs(col - centerCol) <= 0) {
                pixelShade = trunkShade;
              }
            } else {
              // Building windows: spaces inside the border suggest windows
              // Darken interior pixels for window effect
              if (row > 0 && row < templateHeight - 1 && col > 0 && col < templateWidth - 1) {
                // Check if neighboring chars suggest a window area
                if (template[row][col] === '#' && col % 3 === 1 && row % 2 === 1) {
                  pixelShade = windowShade;
                }
              }
            }

            this.pixels.push({
              x: cursorX + col * this.pixelSize,
              y: baseY + row * this.pixelSize,
              active: true,
              shade: pixelShade,
            });
          }
        }
      }

      // Gap between structures
      const gap = Math.floor(Math.random() * 15) + 8;
      cursorX += templateWidth * this.pixelSize + gap;
    }
  }

  bomb(noteX, radius) {
    let destroyed = 0;
    const radiusSq = radius * radius;

    for (const pixel of this.pixels) {
      if (!pixel.active) continue;
      const dx = pixel.x + this.pixelSize / 2 - noteX;
      const dy = pixel.y + this.pixelSize / 2 - this.yPosition;
      if (dx * dx + dy * dy <= radiusSq) {
        pixel.active = false;
        destroyed++;
      }
    }
    return destroyed;
  }

  draw(ctx) {
    for (const pixel of this.pixels) {
      if (!pixel.active) continue;
      ctx.fillStyle = pixel.shade;
      ctx.fillRect(pixel.x, pixel.y, this.pixelSize, this.pixelSize);
    }
  }

  getActiveCount() {
    let count = 0;
    for (const p of this.pixels) {
      if (p.active) count++;
    }
    return count;
  }
}

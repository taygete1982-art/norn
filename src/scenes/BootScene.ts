import { Container, Graphics, Text } from 'pixi.js';

export class BootScene extends Container {
  constructor() {
    super();
    this.x = -200;
    this.y = -100;
  }

  public start() {
    const title = new Text('Norn', {
      fontSize: 64,
      fontFamily: 'monospace',
      fill: 0xffffff,
      dropShadow: true,
    });
    this.addChild(title);

    const subtitle = new Text('Vite + PixiJS v8', {
      fontSize: 32,
      fontFamily: 'monospace',
      fill: 0xffffff,
    });
    this.addChild(subtitle);

    this.addChild(new Graphics().fromText('Resolution: 1280x720', { fontSize: 16, fill: 0xcccccc }));
    this.addChild(new Graphics().fromText('Nearest Filter: ON', { fontSize: 16, fill: 0xcccccc }));
    this.addChild(new Graphics().fromText('Round Pixels: ON', { fontSize: 16, fill: 0xcccccc }));
    this.addChild(new Graphics().fromText('Pixel Art: ON', { fontSize: 16, fill: 0xcccccc }));
  }

  public update(delta: number): void {
    this.x += 1;
  }
}

import { IsoMath } from '../iso/IsoMath';
import { ScreenPos } from '../components/ScreenPos';
import { PathIndex } from '../components/PathIndex';
import { Health } from '../components/Health';

/**
 * PathFollowSystem — движение врага по waypoint-пути сверху вниз
 */
export class PathFollowSystem {
  private iso: IsoMath;
  private speed: number;

  constructor(iso: IsoMath, speed: number = 10) {
    this.iso = iso;
    this.speed = speed;
  }

  update(world: World, dt: number): void {
    const entities = world.query(['ScreenPos', 'PathIndex']);
    
    for (const entity of entities) {
      const screenPos = ScreenPos.getComponent(entity);
      
      // Движение вниз по экранным координатам
      screenPos.y += this.speed * dt;

      // Проверка, достиг ли враг конца пути
      const height = screenPos.y; // Высота экрана
      if (height > 1200) { // 1280 - height - 50 (margins)
        // Достиг конца пути — сброс health
        Health.getComponent(entity).heal(Health.getComponent(entity).maxHp);
      }
    }
  }
}

export default PathFollowSystem;

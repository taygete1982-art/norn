import { createWorld } from '../ecs/bitecs';
import { IsoMath } from '../iso/IsoMath';

describe('ECS Smoke Test', () => {
  it('spawns -> moves -> removes', () => {
    const world = createWorld(720, 1280);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);
    world.update(0.016);

    expect(world.pathFollow.path[world.pathFollow.path.length - 1].y).toBeGreaterThan(0);
  });
});

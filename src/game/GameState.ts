import { ConfigLoader } from './config/ConfigLoader';

export interface GameState {
  gold: number;
  crystalHP: number;
  status: 'playing' | 'won' | 'lost';
}

export class GameStateManager {
  private static currentState: GameState = {
    gold: ConfigLoader.getEconomy().startingGold,
    crystalHP: ConfigLoader.getEconomy().crystalHP,
    status: 'playing',
  };

  public static getGameState(): GameState {
    return { ...this.currentState };
  }

  public static setGameState(state: GameState): void {
    this.currentState = { ...state };
  }

  public static reset(): void {
    this.currentState = {
      gold: ConfigLoader.getEconomy().startingGold,
      crystalHP: ConfigLoader.getEconomy().crystalHP,
      status: 'playing',
    };
  }

  public static addGold(amount: number): void {
    this.currentState.gold += amount;
  }

  public static spendGold(amount: number): boolean {
    if (this.currentState.gold < amount) return false;
    this.currentState.gold -= amount;
    return true;
  }

  public static takeCrystalDamage(amount: number): void {
    this.currentState.crystalHP -= amount;
    if (this.currentState.crystalHP <= 0) {
      this.currentState.crystalHP = 0;
      this.currentState.status = 'lost';
    }
  }

  public static setStatus(status: 'playing' | 'won' | 'lost'): void {
    this.currentState.status = status;
  }

  public static getGold(): number {
    return this.currentState.gold;
  }

  public static getCrystalHP(): number {
    return this.currentState.crystalHP;
  }

  public static getStatus(): 'playing' | 'won' | 'lost' {
    return this.currentState.status;
  }
}

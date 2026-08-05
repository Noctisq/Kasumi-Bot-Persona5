import { Collection } from 'discord.js';
import { Command } from '../interface/Command.interface';

export class CommandRegistry {
  private readonly commands = new Collection<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }
}

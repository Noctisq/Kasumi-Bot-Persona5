export interface Command {
    name: string;
    description: string;
    execute(interaction): void;
}

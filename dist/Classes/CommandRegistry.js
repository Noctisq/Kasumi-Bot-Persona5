"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRegistry = void 0;
const discord_js_1 = require("discord.js");
class CommandRegistry {
    constructor() {
        this.commands = new discord_js_1.Collection();
    }
    register(command) {
        this.commands.set(command.name, command);
    }
    get(name) {
        return this.commands.get(name);
    }
}
exports.CommandRegistry = CommandRegistry;
//# sourceMappingURL=CommandRegistry.js.map
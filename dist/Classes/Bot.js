"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const { Client, GatewayIntentBits, Collection } = require('discord.js');
class Bot {
    constructor() { }
    static getInstance() {
        if (!Bot.instance) {
            Bot.instance = new Bot();
        }
        return Bot.instance;
    }
    getClient() {
        if (!Bot.client) {
            Bot.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
        }
        return Bot.client;
    }
    createCommandsCollection() {
        if (!Bot.commands) {
            Bot.commands = new Collection();
        }
        return Bot.commands;
    }
    getCommandsCollection() {
        return Bot.commands;
    }
    setCommandsCollection(command) {
        Bot.commands.set(command.name, command);
    }
    getCommandFromCollection(commandName) {
        return Bot.commands.get(commandName);
    }
    /**
     * Finally, any singleton should define some business logic, which can be
     * executed on its instance.
     */
    loginBot(token) {
        Bot.client.login(token);
    }
}
exports.Bot = Bot;
//# sourceMappingURL=Bot.js.map
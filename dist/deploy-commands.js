"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require("dotenv/config");
const fs = require('fs');
const commands = [];
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.ts'));
const clientId = process.env.CLIENT_ID;
for (const file of commandFiles) {
    const command = require(`./commands/${file.replace(/\.ts$/, '')}`);
    const commandInstance = Object.values(command)[0];
    commands.push(new commandInstance());
}
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        const existing = await rest.get(Routes.applicationCommands(clientId));
        const entryPointCommands = existing.filter(c => c.type === 4); // ENTRY_POINT (Activity launch command)
        await rest.put(Routes.applicationCommands(clientId), { body: [...entryPointCommands, ...commands] });
        console.log('Successfully reloaded application (/) commands.');
    }
    catch (error) {
        console.error(error);
    }
})();
//# sourceMappingURL=deploy-commands.js.map
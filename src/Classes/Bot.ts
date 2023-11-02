const { Client, GatewayIntentBits, Collection } = require('discord.js');
export class Bot {
    private static instance: Bot;
    private static client;
    public static commands;
    private constructor() { }

    public static getInstance(): Bot {
        if (!Bot.instance) {
            Bot.instance = new Bot()
        }
        return Bot.instance;
        
    }

    public getClient() {
        if(!Bot.client){
            Bot.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
        }
        return Bot.client;
    }

    public createCommandsCollection() { 
        if(!Bot.commands){
            Bot.commands = new Collection();
        }
        return Bot.commands
    }

    public getCommandsCollection(){
        return Bot.commands;
    }

    public setCommandsCollection (command) {
        Bot.commands.set(command.name, command)
    }

    public getCommandFromCollection(commandName){
        return Bot.commands.get(commandName)
    }
    /**
     * Finally, any singleton should define some business logic, which can be
     * executed on its instance.
     */
    public loginBot(token) {        
        Bot.client.login(token)
    }
}

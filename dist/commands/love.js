"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoveCommand = void 0;
class LoveCommand {
    constructor() {
        this.name = 'love';
        this.description = 'love from kasumi!';
    }
    async execute(interaction) {
        return await interaction.reply('i love you senpai!');
    }
}
exports.LoveCommand = LoveCommand;
//# sourceMappingURL=love.js.map
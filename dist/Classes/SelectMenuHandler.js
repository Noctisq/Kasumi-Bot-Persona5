"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectMenuHandler = void 0;
class SelectMenuHandler {
    constructor(interaction, filter, songs) {
        this.interaction = interaction;
        this.filter = filter;
        this.songs = songs;
        this.collector = this.createCollector();
    }
    createCollector() {
        return this.interaction.createMessageComponentCollector(this.filter);
    }
    onCollect(collectInteraction) {
        this.valuesCollected = collectInteraction.values;
        this.collector.stop();
    }
    async onEndSelection() {
        return this.valuesCollected;
    }
    async start() {
        return new Promise(async (resolve) => {
            this.collector.on('collect', async (interaction) => {
                this.onCollect(interaction);
            });
            this.collector.on('end', async (collected) => {
                resolve(await this.onEndSelection());
            });
        });
    }
}
exports.SelectMenuHandler = SelectMenuHandler;
//# sourceMappingURL=SelectMenuHandler.js.map

export class SelectMenuHandler {
    public readonly interaction; 
    public readonly filter;
    public readonly songs;
    public collector;
    public valuesCollected: Array<any>;
    constructor(interaction, filter, songs) {
        this.interaction = interaction;
        this.filter = filter;
        this.songs = songs;
        this.collector = this.createCollector();
    }

    public createCollector() {
        return this.interaction.createMessageComponentCollector(this.filter);
    }

    public onCollect(collectInteraction) {
        this.valuesCollected = collectInteraction.values;
        this.collector.stop();
    }

    public async onEndSelection() {
        return this.valuesCollected;
    }

    public async start(): Promise<Array<any>> {
        return new Promise(async (resolve) => {
            this.collector.on('collect', async interaction => {
                this.onCollect(interaction)
            });

            this.collector.on('end', async collected => {
                resolve(await this.onEndSelection());
            });
        });
    }
}


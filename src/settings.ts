import {App, PluginSettingTab, Setting} from "obsidian";
import MathArchivist from "./main";

export interface ArchivistSettings {
	tagPath: string;
	defaultContent: string;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
	tagPath: '/',
	defaultContent: ''
}

export class ArchivistSettingTab extends PluginSettingTab {
	plugin: MathArchivist;

	constructor(app: App, plugin: MathArchivist) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Tag Path')
			.setDesc('Location for tag files.')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.tagPath)
				.onChange(async (value) => {
					this.plugin.settings.tagPath = value;
					await this.plugin.saveSettings();
				}));
	}
}

import {App, Editor, normalizePath, MarkdownView, FuzzySuggestModal, Modal, Notice, TFile, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, ArchivistSettings, ArchivistSettingTab} from "./settings";

const path = require('path');

// Remember to rename these classes and interfaces!

export default class MathArchivist extends Plugin {
	settings: ArchivistSettings;
	private tagCounter: number;

	async onload() {
		await this.loadSettings();

		this.tagCounter = parseInt(this.app.loadLocalStorage('tag-count') || "1");

		this.addCommand({
			id: 'create-note-with-new-tag',
			name: 'Create note with new tag',
			callback: async () => {
				this.createNoteWithNewTag(this.settings.defaultContent);
			},
		});

		this.addCommand({
			id: 'create-new-tag-from-selection',
			name: 'Create new tag from selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				this.createNoteWithNewTag(editor.getSelection());
				editor.replaceSelection('');
			},
		});

		this.addCommand({
			id: 'create-new-tag-with-type',
			name: 'Create new tag with type',
			callback: async () => {
				new NoteTypeModal(this.app, (result) => {
					let content = `**${result} ${this.getNextTag()}.** `;
					this.createNoteWithNewTag(content);
				}).open();
			}
		});

		this.addCommand({
			id: 'create-new-tag-with-type-from-selection',
			name: 'Create new tag with type from selection.',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				new NoteTypeModal(this.app, (result) => {
					let content = `**${result} ${this.getNextTag()}.** ${editor.getSelection()}`;
					this.createNoteWithNewTag(content);
				}).open();
			}
		});

		// add-tag-to-file
		
		// sync-tags
		this.addCommand({
			id: 'sync-tags',
			name: 'Sync tag counter.',
			callback: async () => {
				let maxTag = 1;

				const folder = this.app.vault.getFolderByPath(this.settings.tagPath);
				const children = folder.children || [];
				const tagFiles = children.filter((file) => file instanceof TFile);

				const regex = /^[A-Z0-9]{4}.md$/

				for (const file of tagFiles) {
					if (regex.test(file.name)) {
						maxTag = Math.max(maxTag, parseInt(file.basename, 36));
					}
				}
				this.tagCounter = maxTag + 1;
				this.app.saveLocalStorage('tag-count', this.tagCounter.toString());
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ArchivistSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			new Notice("Click");
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ArchivistSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createNoteWithNewTag(content: string) {
		try {
			const nextTag = this.getNextTagAndIncrementCounter();
			const fileName = nextTag + '.md';
			const filePath = path.join(this.settings.tagPath, fileName);
			const normalizedPath = normalizePath(filePath);

			try {
				const file = await this.app.vault.create(normalizedPath, content);
				new Notice(`Created note: ${file.name}`);
				
				// Open the new note
				const activeLeaf = this.app.workspace.getLeaf(false);
				if (activeLeaf) {
					await activeLeaf.openFile(file);
				}
			} catch (error) {
				new Notice(`Error creating note: ${error}`);
			}

		} catch (error) {
			// Already handled in createNote
			console.log(error);
		}
	}

	private getNextTagAndIncrementCounter(): string {
		const nextTag = this.getNextTag();
		this.tagCounter++;

		this.app.saveLocalStorage('tag-count', this.tagCounter.toString());
		return nextTag;
	}

	private getNextTag(): string {
		return this.pad4(this.tagCounter.toString(36).toUpperCase());
	}

	private pad4(tag: string): string {
		return ('0000' + tag).slice(-4);
	}
}

const NOTE_TYPES = [
	'Definition',
	'Lemma',
	'Proposition',
	'Theorem',
	'Remark',
	'Example',
	'Corollary',
];

class NoteTypeModal extends FuzzySuggestModal<string> {
	private onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	getItems(): string[] {
		return NOTE_TYPES;
	}

	getItemText(type: string): string {
		return type;
	}

	onChooseItem(type: string, evt: MouseEvent | KeyboardEvent) {
		this.onSubmit(type);
	}
}

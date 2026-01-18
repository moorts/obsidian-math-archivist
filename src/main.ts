import {App, Editor, normalizePath, MarkdownView, FuzzySuggestModal, Modal, Notice, TFile, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, ArchivistSettings, SampleSettingTab} from "./settings";

const path = require('path');

// Remember to rename these classes and interfaces!

export default class MathArchivist extends Plugin {
	settings: ArchivistSettings;
	private tagCounter: number = undefined;

	async onload() {
		await this.loadSettings();

		this.tagCounter = parseInt(this.app.loadLocalStorage('tag-count') || "1");

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});

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

				const tagFiles = this.app.vault.getFolderByPath(this.settings.tagPath).children.filter((file) => file instanceof TFile);

				const regex = /^[A-Z0-9]{4}.md$/

				for (const file of tagFiles) {
					if (regex.test(file.name)) {
						console.log(file.basename, parseInt(file.basename, 36));
						maxTag = Math.max(maxTag, parseInt(file.basename, 36));
					}
				}
				this.tagCounter = maxTag + 1;
				this.app.saveLocalStorage('tag-count', this.tagCounter.toString());
			}
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			new Notice("Click");
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

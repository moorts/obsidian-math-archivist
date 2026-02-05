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
				const tags = app.metadataCache.getFileCache(view.file).frontmatter.tags;
				const content = editor.getSelection();
				editor.replaceSelection(`![[${this.getNextTag()}]]`);
				this.createNoteWithNewTag(content, "", tags);
			},
		});

		this.addCommand({
			id: 'create-new-tag-with-type',
			name: 'Create new tag with type',
			callback: async () => {
				new NoteTypeModal(this.app, (result) => {
					this.createNoteWithNewTag('', result);
				}).open();
			}
		});

		this.addCommand({
			id: 'create-new-tag-with-type-from-selection',
			name: 'Create new tag with type from selection.',
			editorCallback: async (editor: Editor, view: MarkdownView) => {

				const tags = app.metadataCache.getFileCache(view.file).frontmatter.tags;
				const content = editor.getSelection();
				new NoteTypeModal(this.app, (result) => {
					editor.replaceSelection(`![[${this.getNextTag()}]]`);
					this.createNoteWithNewTag(content, result, tags);
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
				if (folder === null) {
					return;
				}

				const tagFiles = folder.children.filter((file) => file instanceof TFile);

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
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ArchivistSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createNoteWithNewTag(raw_content: string, note_type: string|undefined, note_tags:string[] = []) {
		const nextTag = this.getNextTagAndIncrementCounter();
		const fileName = nextTag + '.md';
		const filePath = path.join(this.settings.tagPath, fileName);
		const normalizedPath = normalizePath(filePath);

		const content = this.applyTemplate(raw_content, note_type, nextTag, note_tags);

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
	}

	private applyTemplate(raw_content: string, note_type: string|undefined, tag: string, note_tags: string[] = []): string {
		let frontmatter = "---\ntags:\n" + "  - math\n"

		if(note_type) {
			frontmatter += `  - ${note_type}\n`
		}

		for(let note_tag of note_tags) {
			if (note_tag === "math" || NOTE_TYPES.includes(note_tag)) {
				continue;
			}
			frontmatter += `  - ${note_tag}\n`;
		}

		frontmatter += "---\n"

		const type_str = note_type ? `**${note_type} ${tag}.** ` : ""

		return frontmatter + type_str + raw_content;
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
	'Algorithm',
	'Definition',
	'Lemma',
	'Proposition',
	'Theorem',
	'Remark',
	'Example',
	'Corollary',
	'Exercise',
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

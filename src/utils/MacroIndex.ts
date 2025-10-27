import * as vscode from 'vscode';
import { MacroParser, type MacroDefinition } from './MacroParser';

interface ReferenceCacheEntry {
  locations: vscode.Location[];
  expires: number;
}

export class MacroIndex {
  private static instance: MacroIndex | null = null;
  private resolveMainFile?: () => Promise<string | null>;
  private mainFile?: string;
  private initialized = false;
  private needsBaseRefresh = true;
  private refreshPromise: Promise<void> | null = null;

  private baseMacrosByFile = new Map<string, MacroDefinition[]>();
  private liveMacrosByFile = new Map<string, MacroDefinition[]>();
  private combinedMacros: MacroDefinition[] = [];
  private macrosByName = new Map<string, MacroDefinition[]>();
  private referenceCache = new Map<string, ReferenceCacheEntry>();

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  static getInstance(): MacroIndex {
    if (!this.instance) {
      this.instance = new MacroIndex();
    }
    return this.instance;
  }

  initialize(context: vscode.ExtensionContext, resolveMainFile: () => Promise<string | null>): void {
    if (this.initialized) return;
    this.resolveMainFile = resolveMainFile;
    this.initialized = true;

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(doc => this.updateDocument(doc)),
      vscode.workspace.onDidChangeTextDocument(event => this.updateDocument(event.document)),
      vscode.workspace.onDidSaveTextDocument(() => this.markWorkspaceDirty()),
      vscode.workspace.onDidCloseTextDocument(doc => {
        if (doc.languageId === 'latex') {
          this.removeDocument(doc.uri);
          this.markWorkspaceDirty();
        }
      }),
      vscode.workspace.onDidCreateFiles(() => this.markWorkspaceDirty()),
      vscode.workspace.onDidRenameFiles(() => this.markWorkspaceDirty()),
      vscode.workspace.onDidDeleteFiles(event => {
        this.markWorkspaceDirty();
        for (const uri of event.files) {
          this.liveMacrosByFile.delete(uri.fsPath);
        }
        this.rebuildIndex();
      })
    );

    vscode.workspace.textDocuments.forEach(doc => this.updateDocument(doc));
    this.markWorkspaceDirty();
    void this.ensureBase();
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  markWorkspaceDirty(): void {
    if (!this.initialized) return;
    this.needsBaseRefresh = true;
    this.referenceCache.clear();
  }

  async getAllMacros(): Promise<MacroDefinition[]> {
    if (!this.initialized) return [];
    await this.ensureBase();
    return this.combinedMacros;
  }

  async getMacroDefinition(name: string): Promise<MacroDefinition | null> {
    const definitions = await this.getMacroDefinitions(name);
    return definitions[0] ?? null;
  }

  async getMacroDefinitions(name: string): Promise<MacroDefinition[]> {
    if (!this.initialized) return [];
    await this.ensureBase();
    return this.macrosByName.get(name) ?? [];
  }

  async findReferences(name: string): Promise<vscode.Location[]> {
    if (!this.initialized) return [];
    await this.ensureBase();

    const cached = this.referenceCache.get(name);
    if (cached && cached.expires > Date.now()) {
      return cached.locations;
    }

    const locations: vscode.Location[] = [];
    const openDocs = new Map<string, vscode.TextDocument>();
    vscode.workspace.textDocuments.forEach(doc => {
      if (doc.languageId === 'latex') {
        openDocs.set(doc.uri.fsPath, doc);
      }
    });

    const patternFactory = () => new RegExp(`\\\\${name}(?![A-Za-z@])`, 'g');

    for (const [filePath, doc] of openDocs.entries()) {
      locations.push(...this.collectReferencesFromText(doc.getText(), filePath, patternFactory()));
    }

    const texFiles = await vscode.workspace.findFiles('**/*.tex');
    for (const uri of texFiles) {
      if (openDocs.has(uri.fsPath)) continue;
      try {
        const buffer = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buffer).toString('utf-8');
        locations.push(...this.collectReferencesFromText(text, uri.fsPath, patternFactory()));
      } catch (error) {
        console.error('MacroIndex reference scan error:', error);
      }
    }

    this.referenceCache.set(name, { locations, expires: Date.now() + 2000 });
    return locations;
  }

  private collectReferencesFromText(text: string, filePath: string, pattern: RegExp): vscode.Location[] {
    const locations: vscode.Location[] = [];
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = MacroIndex.offsetToPosition(text, match.index);
      const end = MacroIndex.offsetToPosition(text, match.index + match[0].length);
      locations.push(new vscode.Location(vscode.Uri.file(filePath), new vscode.Range(start, end)));
    }
    return locations;
  }

  private async ensureBase(): Promise<void> {
    if (!this.initialized) return;
    if (this.refreshPromise) {
      await this.refreshPromise;
    }
    if (!this.needsBaseRefresh) return;

    this.refreshPromise = this.reloadBase();
    await this.refreshPromise;
  }

  private async reloadBase(): Promise<void> {
    try {
      const mainFile = this.resolveMainFile ? await this.resolveMainFile() : null;
      if (!mainFile) {
        this.baseMacrosByFile.clear();
        this.mainFile = undefined;
        this.needsBaseRefresh = false;
        this.rebuildIndex();
        return;
      }

      if (this.mainFile !== mainFile) {
        this.mainFile = mainFile;
      }

      const macros = await MacroParser.findAllMacrosInProject(mainFile);
      this.baseMacrosByFile.clear();
      for (const macro of macros) {
        const bucket = this.baseMacrosByFile.get(macro.location.file) ?? [];
        bucket.push(macro);
        this.baseMacrosByFile.set(macro.location.file, bucket);
      }
      this.needsBaseRefresh = false;
      this.rebuildIndex();
    } catch (error) {
      console.error('MacroIndex reload error:', error);
      this.needsBaseRefresh = false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private updateDocument(document: vscode.TextDocument): void {
    if (document.languageId !== 'latex') return;
    const macros = MacroParser.parseMacrosFromText(document.getText(), document.uri.fsPath);
    this.liveMacrosByFile.set(document.uri.fsPath, macros);
    this.referenceCache.clear();
    this.rebuildIndex();
  }

  private removeDocument(uri: vscode.Uri): void {
    if (this.liveMacrosByFile.delete(uri.fsPath)) {
      this.referenceCache.clear();
      this.rebuildIndex();
    }
  }

  private rebuildIndex(): void {
    if (!this.initialized) return;

    const combined = new Map<string, MacroDefinition[]>();
    for (const [file, macros] of this.baseMacrosByFile.entries()) {
      combined.set(file, macros);
    }
    for (const [file, macros] of this.liveMacrosByFile.entries()) {
      combined.set(file, macros);
    }

    this.macrosByName.clear();
    this.combinedMacros = [];

    for (const macros of combined.values()) {
      for (const macro of macros) {
        this.combinedMacros.push(macro);
        const bucket = this.macrosByName.get(macro.name) ?? [];
        bucket.push(macro);
        this.macrosByName.set(macro.name, bucket);
      }
    }

    this._onDidChange.fire();
  }

  private static offsetToPosition(text: string, offset: number): vscode.Position {
    let line = 0;
    let character = 0;
    for (let i = 0; i < offset; i++) {
      if (text.charCodeAt(i) === 10) {
        line++;
        character = 0;
      } else {
        character++;
      }
    }
    return new vscode.Position(line, character);
  }
}

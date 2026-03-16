import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';


export async function createTmpTestDir(prefix: string): Promise<string> {
	return fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
}

export class MockMemento implements vscode.Memento {
	private storage = new Map<string, unknown>();

	keys(): readonly string[] {
		return [...this.storage.keys()];
	}

	get<T>(key: string, defaultValue?: T): T {
		if (this.storage.has(key)) {
			return this.storage.get(key) as T;
		}
		return defaultValue as T;
	}

	update(key: string, value: unknown): Thenable<void> {
		this.storage.set(key, value);
		return Promise.resolve();
	}
}

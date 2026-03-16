import assert from 'assert';
import * as vscode from 'vscode';
import { FavoritesManager } from '../favorites';

class MockMemento implements vscode.Memento {
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

suite('FavoritesManager', () => {

	test('initially returns empty starred set', () => {
		const manager = new FavoritesManager(new MockMemento());
		const starred = manager.getStarredPaths();
		assert.strictEqual(starred.size, 0);
	});

	test('toggle on returns true and persists', async () => {
		const manager = new FavoritesManager(new MockMemento());
		const result = await manager.toggle('Python.gitignore');
		assert.strictEqual(result, true);
		assert.strictEqual(manager.isStarred('Python.gitignore'), true);
	});

	test('toggle off returns false and removes', async () => {
		const manager = new FavoritesManager(new MockMemento());
		await manager.toggle('Python.gitignore');
		const result = await manager.toggle('Python.gitignore');
		assert.strictEqual(result, false);
		assert.strictEqual(manager.isStarred('Python.gitignore'), false);
	});

	test('isStarred returns correct values', async () => {
		const manager = new FavoritesManager(new MockMemento());
		assert.strictEqual(manager.isStarred('Node.gitignore'), false);
		await manager.toggle('Node.gitignore');
		assert.strictEqual(manager.isStarred('Node.gitignore'), true);
		assert.strictEqual(manager.isStarred('Python.gitignore'), false);
	});

	test('multiple starred templates persist', async () => {
		const manager = new FavoritesManager(new MockMemento());
		await manager.toggle('Python.gitignore');
		await manager.toggle('Node.gitignore');
		await manager.toggle('Go.gitignore');

		const starred = manager.getStarredPaths();
		assert.strictEqual(starred.size, 3);
		assert.strictEqual(starred.has('Python.gitignore'), true);
		assert.strictEqual(starred.has('Node.gitignore'), true);
		assert.strictEqual(starred.has('Go.gitignore'), true);
	});
});

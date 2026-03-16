import assert from 'assert';
import * as vscode from 'vscode';
import { GitignoreTemplate } from '../interfaces';
import { buildQuickPickItems } from '../extension';
import { FavoritesManager } from '../favorites';
import { MockMemento } from './utils';

function makeTemplate(name: string): GitignoreTemplate {
	return { name, path: `${name}.gitignore` };
}

suite('buildQuickPickItems', () => {

	test('no starred templates produces flat list without separators', () => {
		const templates = [makeTemplate('Go'), makeTemplate('Node'), makeTemplate('Python')];
		const starred = new Set<string>();
		const items = buildQuickPickItems(templates, starred);

		assert.strictEqual(items.length, 3);
		for (const item of items) {
			assert.notStrictEqual(item.kind, vscode.QuickPickItemKind.Separator);
			assert.ok(item.template);
		}
	});

	test('some starred templates appear first with separators', () => {
		const templates = [makeTemplate('Go'), makeTemplate('Node'), makeTemplate('Python')];
		const starred = new Set(['Node.gitignore']);
		const items = buildQuickPickItems(templates, starred);

		// Starred separator, Node, Other separator, Go, Python
		assert.strictEqual(items.length, 5);
		assert.strictEqual(items[0].kind, vscode.QuickPickItemKind.Separator);
		assert.strictEqual(items[0].label, 'Starred');
		assert.strictEqual(items[1].label, 'Node');
		assert.strictEqual(items[2].kind, vscode.QuickPickItemKind.Separator);
		assert.strictEqual(items[2].label, 'Other');
		assert.strictEqual(items[3].label, 'Go');
		assert.strictEqual(items[4].label, 'Python');
	});

	test('all starred templates shows no "Other" separator', () => {
		const templates = [makeTemplate('Go'), makeTemplate('Node')];
		const starred = new Set(['Go.gitignore', 'Node.gitignore']);
		const items = buildQuickPickItems(templates, starred);

		// Starred separator, Go, Node
		assert.strictEqual(items.length, 3);
		assert.strictEqual(items[0].kind, vscode.QuickPickItemKind.Separator);
		assert.strictEqual(items[0].label, 'Starred');
		const separatorCount = items.filter(i => i.kind === vscode.QuickPickItemKind.Separator).length;
		assert.strictEqual(separatorCount, 1);
	});

	test('correct button assignment for starred vs unstarred', () => {
		const templates = [makeTemplate('Go'), makeTemplate('Node')];
		const starred = new Set(['Node.gitignore']);
		const items = buildQuickPickItems(templates, starred);

		const nodeItem = items.find(i => i.label === 'Node')!;
		const goItem = items.find(i => i.label === 'Go')!;

		assert.ok(nodeItem.buttons);
		assert.strictEqual((nodeItem.buttons[0].iconPath as vscode.ThemeIcon).id, 'star-full');
		assert.ok(goItem.buttons);
		assert.strictEqual((goItem.buttons[0].iconPath as vscode.ThemeIcon).id, 'star-empty');
	});

	test('template reference preserved on non-separator items', () => {
		const templates = [makeTemplate('Go'), makeTemplate('Node')];
		const starred = new Set(['Node.gitignore']);
		const items = buildQuickPickItems(templates, starred);

		const nonSeparators = items.filter(i => i.kind !== vscode.QuickPickItemKind.Separator);
		for (const item of nonSeparators) {
			assert.ok(item.template, `Item "${item.label}" should have a template`);
		}
	});
});

suite('Favorites + QuickPick Integration', () => {

	test('toggle favorites then build items produces correct ordering', async () => {
		const manager = new FavoritesManager(new MockMemento());
		const templates = [makeTemplate('Go'), makeTemplate('Node'), makeTemplate('Python')];

		await manager.toggle('Python.gitignore');
		await manager.toggle('Go.gitignore');

		const items = buildQuickPickItems(templates, manager.getStarredPaths());

		// Starred separator, Go, Python, Other separator, Node
		assert.strictEqual(items.length, 5);
		assert.strictEqual(items[0].kind, vscode.QuickPickItemKind.Separator);
		assert.strictEqual(items[0].label, 'Starred');

		const starredLabels = [items[1].label, items[2].label];
		assert.ok(starredLabels.includes('Go'));
		assert.ok(starredLabels.includes('Python'));

		assert.strictEqual(items[3].kind, vscode.QuickPickItemKind.Separator);
		assert.strictEqual(items[3].label, 'Other');
		assert.strictEqual(items[4].label, 'Node');
	});
});

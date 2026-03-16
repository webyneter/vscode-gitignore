import * as vscode from 'vscode';

const STARRED_TEMPLATES_KEY = 'gitignore.starredTemplates';

export class FavoritesManager {
	constructor(private readonly state: vscode.Memento) {}

	getStarredPaths(): Set<string> {
		const paths = this.state.get<string[]>(STARRED_TEMPLATES_KEY, []);
		return new Set(paths);
	}

	isStarred(path: string): boolean {
		return this.getStarredPaths().has(path);
	}

	async toggle(path: string): Promise<boolean> {
		const paths = this.getStarredPaths();
		const starred = !paths.has(path);
		if (starred) {
			paths.add(path);
		} else {
			paths.delete(path);
		}
		await this.state.update(STARRED_TEMPLATES_KEY, [...paths]);
		return starred;
	}
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import { join as joinPath } from 'path';

import { Cache } from './cache';
import { GitignoreTemplate, GitignoreOperation, GitignoreOperationType, GitignoreProvider } from './interfaces';
import { GithubGitignoreRepositoryProvider } from './providers/github-gitignore-repository';
import { AuthenticationCancellationError, GithubContext, GithubSession } from './github/session';
import { GithubApiRateLimitReachedError } from './github/client';
import { mergeTemplates, TemplateSection } from './merge';
import { FavoritesManager } from './favorites';


class CancellationError extends Error {

}

export interface GitignoreQuickPickItem extends vscode.QuickPickItem {
	template?: GitignoreTemplate;
}

const starFullButton: vscode.QuickInputButton = {
	iconPath: new vscode.ThemeIcon('star-full'),
	tooltip: 'Remove from favorites'
};
const starEmptyButton: vscode.QuickInputButton = {
	iconPath: new vscode.ThemeIcon('star-empty'),
	tooltip: 'Add to favorites'
};

export function buildQuickPickItems(templates: GitignoreTemplate[], starredPaths: Set<string>): GitignoreQuickPickItem[] {
	const starred: GitignoreQuickPickItem[] = [];
	const other: GitignoreQuickPickItem[] = [];

	for (const t of templates) {
		const isStarred = starredPaths.has(t.path);
		const item: GitignoreQuickPickItem = {
			label: t.name,
			description: t.path,
			template: t,
			buttons: [isStarred ? starFullButton : starEmptyButton]
		};
		if (isStarred) {
			starred.push(item);
		} else {
			other.push(item);
		}
	}

	const items: GitignoreQuickPickItem[] = [];
	if (starred.length > 0) {
		items.push({ label: 'Starred', kind: vscode.QuickPickItemKind.Separator });
		items.push(...starred);
		if (other.length > 0) {
			items.push({ label: 'Other', kind: vscode.QuickPickItemKind.Separator });
		}
	}
	items.push(...other);
	return items;
}

function showTemplateQuickPick(templates: GitignoreTemplate[], favoritesManager: FavoritesManager): Promise<GitignoreTemplate[]> {
	return new Promise<GitignoreTemplate[]>((resolve, reject) => {
		const quickPick = vscode.window.createQuickPick<GitignoreQuickPickItem>();
		quickPick.canSelectMany = true;
		quickPick.placeholder = 'Select one or more .gitignore templates';
		quickPick.items = buildQuickPickItems(templates, favoritesManager.getStarredPaths());
		quickPick.keepScrollPosition = true;

		let resolved = false;

		quickPick.onDidTriggerItemButton(async (e) => {
			const item = e.item;
			if (!item.template) {
				return;
			}
			await favoritesManager.toggle(item.template.path);

			const savedValue = quickPick.value;
			const savedSelection = [...quickPick.selectedItems];
			quickPick.items = buildQuickPickItems(templates, favoritesManager.getStarredPaths());
			quickPick.value = savedValue;

			// Restore selection by matching template paths
			const selectedPaths = new Set(savedSelection.filter(i => i.template).map(i => i.template!.path));
			quickPick.selectedItems = quickPick.items.filter(i => i.template && selectedPaths.has(i.template.path));
		});

		quickPick.onDidAccept(() => {
			if (resolved) {
				return;
			}
			resolved = true;
			const selected = quickPick.selectedItems
				.filter(i => i.template)
				.map(i => i.template!);
			quickPick.dispose();
			if (selected.length === 0) {
				reject(new CancellationError());
			} else {
				resolve(selected);
			}
		});

		quickPick.onDidHide(() => {
			if (resolved) {
				return;
			}
			resolved = true;
			quickPick.dispose();
			reject(new CancellationError());
		});

		quickPick.show();
	});
}


// Initialize cache
// The cache is the only instance shared across the whole lifetime of the extension
// Everything else should be scoped to the invocation of a command
const cache = createCache();
// NOOP: Silence stupid eslint
createNeverUsedCache();

function createCache() : Cache {
	const config = vscode.workspace.getConfiguration('gitignore');

	const cacheExpirationInterval = config.get('cacheExpirationInterval', 3600);
	console.log(`vscode-gitignore: creating cache with cacheExpirationInterval: ${cacheExpirationInterval}`);

	return new Cache(cacheExpirationInterval);
}

/**
 * Create a cache that never caches, used for testing only
 * @returns
 */
function createNeverUsedCache() : Cache {
	const cacheExpirationInterval = 0;
	console.log(`vscode-gitignore: creating cache with cacheExpirationInterval: ${cacheExpirationInterval}`);

	return new Cache(cacheExpirationInterval);
}

/**
 * Resolves the workspace folder by
 * - using the single opened workspace
 * - prompting for the workspace to use when multiple workspaces are open
 */
async function resolveWorkspaceFolder(gitIgnoreTemplates: GitignoreTemplate[]) {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) {
		throw new CancellationError();
	}
	else if (folders.length === 1) {
		return { templates: gitIgnoreTemplates, path: folders[0].uri.fsPath };
	}
	else {
		const folder = await vscode.window.showWorkspaceFolderPick();
		if (!folder) {
			throw new CancellationError();
		}
		return { templates: gitIgnoreTemplates, path: folder.uri.fsPath };
	}
}

function checkIfFileExists(path: string) {
	return new Promise<boolean>((resolve) => {
		fs.stat(path, (err) => {
			if (err) {
				// File does not exists
				return resolve(false);
			}
			return resolve(true);
		});
	});
}

async function checkExistenceAndPromptForOperation(path: string, templates: GitignoreTemplate[]): Promise<GitignoreOperation> {
	path = joinPath(path, '.gitignore');

	const exists = await checkIfFileExists(path);
	if (!exists) {
		return { path, templates, type: GitignoreOperationType.Overwrite };
	}

	const operation = await promptForOperation();
	if (!operation) {
		throw new CancellationError();
	}
	const typedString = <keyof typeof GitignoreOperationType>operation.label;
	const type = GitignoreOperationType[typedString];

	return { path, templates, type };
}

export async function writeGitignoreFile(gitignoreRepository: GitignoreProvider, operation: GitignoreOperation) {
	const flags = operation.type === GitignoreOperationType.Overwrite ? 'w' : 'a';

	try {
		const contents = await Promise.all(
			operation.templates.map(t => gitignoreRepository.downloadAsString(t.path))
		);

		const sections: TemplateSection[] = operation.templates.map((t, i) => ({
			name: t.name,
			content: contents[i]
		}));

		const config = vscode.workspace.getConfiguration('gitignore');
		const deduplicate = config.get('deduplicateLines', true);
		let merged = mergeTemplates(sections, deduplicate);

		if (flags === 'a') {
			merged = '\n' + merged;
		}

		fs.writeFileSync(operation.path, merged, { flag: flags });
	}
	catch(error) {
		if (flags === 'w') {
			fs.unlink(operation.path, err => {
				if(err) {
					console.error(`vscode-gitignore: ${err.message}`);
				}
			});
		}
		throw error;
	}
}

function promptForOperation() {
	return vscode.window.showQuickPick([
		{
			label: 'Append',
			description: 'Append to existing .gitignore file'
		},
		{
			label: 'Overwrite',
			description: 'Overwrite existing .gitignore file'
		}
	]);
}

function showSuccessMessage(operation: GitignoreOperation) {
	const templateDesc = operation.templates.length === 1
		? operation.templates[0].path
		: `${operation.templates.length} templates`;

	switch (operation.type) {
		case GitignoreOperationType.Append:
			return vscode.window.showInformationMessage(`Appended ${templateDesc} to the existing .gitignore in the project root`);
		case GitignoreOperationType.Overwrite:
			return vscode.window.showInformationMessage(`Created .gitignore file in the project root based on ${templateDesc}`);
		default:
			throw new Error('Unsupported operation');
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('vscode-gitignore: extension activated');

	const githubContext = new GithubContext();
	const favoritesManager = new FavoritesManager(context.globalState);

	const disposable = vscode.commands.registerCommand('gitignore.addgitignore', async () => {
		const githubSession = new GithubSession(githubContext);

		try {
			// Check if workspace open
			if (!vscode.workspace.workspaceFolders) {
				await vscode.window.showErrorMessage('No workspace/directory open');
				return;
			}

			// Create gitignore repository provider
			const gitignoreRepository: GitignoreProvider = new GithubGitignoreRepositoryProvider(cache, githubSession);

			// Load templates
			const templates = await gitignoreRepository.getTemplates();

			// Let the user pick gitignore file(s)
			const selectedTemplates = await showTemplateQuickPick(templates, favoritesManager);

			// Resolve the path to the folder where we should write the gitignore file
			const { templates: resolvedTemplates, path } = await resolveWorkspaceFolder(selectedTemplates);

			// Calculate operation
			console.log(`vscode-gitignore: add/append gitignore for directory: ${path}`);
			const operation = await checkExistenceAndPromptForOperation(path, resolvedTemplates);

			// Store the file on file system
			await writeGitignoreFile(gitignoreRepository, operation);

			// Show success message
			await showSuccessMessage(operation);
		}
		catch (error) {
			if (error instanceof CancellationError) {
				console.info('vscode-gitignore: command cancelled');
				return;
			}
			else if (error instanceof GithubApiRateLimitReachedError) {
				console.error('vscode-gitignore: GitHub API rate limit reached');

				// In case we are already authenticated, there is no other way to continue
				// => fail with error message
				if (await githubSession.isAuthenticated()) {
					await vscode.window.showErrorMessage('GitHub API rate limit reached');
					return;
				}

				// In case we are not authenticated yet, we can continue by trying to authenticate
				try {
					const token = await githubSession.tryGetGithubToken();
					if(token) {
						console.info('vscode-gitignore: acquiring GitHub access token succeeded');
						await vscode.window.showInformationMessage('Acquired GitHub access token. Please try again.');
					}
					else {
						console.error('vscode-gitignore: acquiring GitHub access token failed');
						await vscode.window.showErrorMessage('Acquiring GitHub access token failed');
					}
				}
				catch(error) {
					if (error instanceof CancellationError) {
						console.info('vscode-gitignore: command cancelled');
					}
					else if (error instanceof AuthenticationCancellationError) {
						console.info('vscode-gitignore: acquiring GitHub access token cancelled');
					}
					else {
						console.error('vscode-gitignore: ', error);
						await vscode.window.showErrorMessage(String(error));
					}
				}
			}
			else {
				console.error('vscode-gitignore: ', error);
				await vscode.window.showErrorMessage(String(error));
			}
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('vscode-gitignore: extension is now deactivated!');
}

export interface GitignoreTemplate {
	name: string;
	path: string;
	download_url: string;
	type: string;
}

export interface GitignoreProvider {
	getTemplates(): Promise<GitignoreTemplate[]>;
	downloadAsString(templatePath: string): Promise<string>;
}

export enum GitignoreOperationType {
	Append,
	Overwrite
}

export interface GitignoreOperation {
	type: GitignoreOperationType;
	/**
	 * Path to the .gitignore file to write to
	 */
	path: string;
	/**
	 * gitignore template files to use
	 */
	templates: GitignoreTemplate[];
}

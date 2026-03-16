export interface GitignoreTemplate {
	name: string;
	path: string;
}

export interface GitignoreProvider {
	getTemplates(): Promise<GitignoreTemplate[]>;
	downloadAsString(templatePath: string): Promise<string>;
}

export enum GitignoreOperationType {
	Append = 'Append',
	Overwrite = 'Overwrite'
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

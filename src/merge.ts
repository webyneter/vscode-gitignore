interface TemplateSection {
	name: string;
	content: string;
}

export function mergeTemplates(sections: TemplateSection[], deduplicate: boolean): string {
	if (sections.length === 1) {
		return sections[0].content;
	}

	const parts = sections.map(section => {
		return `### ${section.name}.gitignore ###\n${section.content}`;
	});

	const merged = parts.join('\n\n');
	return deduplicate ? deduplicateLines(merged) : merged;
}

export function deduplicateLines(content: string): string {
	const lines = content.split('\n');
	const seen = new Set<string>();
	const result: string[] = [];

	for (const line of lines) {
		const trimmed = line.trimEnd();

		if (trimmed === '' || trimmed.startsWith('#') || /^### .+ ###$/.test(trimmed)) {
			result.push(line);
			continue;
		}

		if (!seen.has(trimmed)) {
			seen.add(trimmed);
			result.push(line);
		}
	}

	return result.join('\n');
}

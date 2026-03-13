import * as assert from 'assert';
import {suite, test} from 'mocha';
import * as vscode from 'vscode';
import {Decorator} from '../../decorator';

async function setupEditor(content: string) {
	const doc = await vscode.workspace.openTextDocument({
		language: 'markdown',
		content,
	});
	const editor = await vscode.window.showTextDocument(doc);
	const decorator = new Decorator();
	decorator.setActiveEditor(editor);
	return {editor, decorator, doc};
}

suite('Decorator – code block filtering', () => {
	test('headings inside fenced code blocks are not decorated', async () => {
		const {decorator, doc} = await setupEditor([
			'# Real heading',
			'',
			'```python',
			'# this is a comment',
			'## another comment',
			'```',
			'',
			'## Another real heading',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);
		assert.ok(codeBlockRanges.length > 0, 'should detect the fenced code block');

		const filtered = decorator.headings(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		const uniqueLines = new Set(filtered.map((d) => d.parent.start.line));
		assert.ok(uniqueLines.has(0), '"# Real heading" (line 0) should be decorated');
		assert.ok(uniqueLines.has(7), '"## Another real heading" (line 7) should be decorated');
		assert.ok(!uniqueLines.has(3), '"# this is a comment" inside code block should not be decorated');
		assert.ok(!uniqueLines.has(4), '"## another comment" inside code block should not be decorated');
	});

	test('bold/italic inside fenced code blocks are not decorated', async () => {
		const {decorator, doc} = await setupEditor([
			'**real bold**',
			'',
			'```',
			'**not bold**',
			'_not italic_',
			'```',
			'',
			'_real italic_',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);

		const boldLines = new Set(decorator.bold(documentText)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges))
			.map((d) => d.parent.start.line));
		const italicLines = new Set(decorator.italic(documentText)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges))
			.map((d) => d.parent.start.line));

		assert.ok(boldLines.has(0), '"**real bold**" should be decorated');
		assert.ok(!boldLines.has(3), '"**not bold**" inside code block should not be decorated');
		assert.ok(italicLines.has(7), '"_real italic_" should be decorated');
		assert.ok(!italicLines.has(4), '"_not italic_" inside code block should not be decorated');
	});

	test('tilde fenced code blocks also exclude decorations', async () => {
		const {decorator, doc} = await setupEditor([
			'~~~',
			'# heading inside tilde fence',
			'**bold inside tilde fence**',
			'~~~',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);
		assert.ok(codeBlockRanges.length > 0, 'should detect tilde-fenced code block');

		const headings = decorator.headings(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));
		const bold = decorator.bold(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		assert.strictEqual(headings.length, 0, 'no headings should survive filtering');
		assert.strictEqual(bold.length, 0, 'no bold should survive filtering');
	});

	test('inline code content is excluded from other decorations', async () => {
		const {decorator, doc} = await setupEditor('Some `**not bold**` text and **real bold**.');

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);

		const boldDecorations = decorator.bold(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		assert.strictEqual(boldDecorations.length, 2, 'should have 2 bold decorations (hide + color) for the real bold only');
		boldDecorations.forEach((d) => {
			assert.ok(
				d.range.start.character >= 25,
				'bold decoration should only be for "**real bold**" near end of line',
			);
		});
	});

	test('code blocks with info strings containing spaces are detected', async () => {
		const {decorator, doc} = await setupEditor([
			'```toml title="config.toml"',
			'# this is a TOML comment',
			'[profile.default]',
			'```',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);
		assert.ok(codeBlockRanges.length > 0, 'should detect code block with info string containing spaces');

		const headings = decorator.headings(documentText)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));
		assert.strictEqual(headings.length, 0, 'TOML comment should not be decorated as heading');
	});

	test('code blocks at end of file without trailing newline are detected', async () => {
		const content = '```\n# not a heading\n```';
		const {decorator, doc} = await setupEditor(content);

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);
		assert.ok(codeBlockRanges.length > 0, 'should detect code block without trailing newline');

		const headings = decorator.headings(documentText)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));
		assert.strictEqual(headings.length, 0, 'content should not be decorated as heading');
	});

	test('italic regex does not match underscores spanning across code span boundaries', async () => {
		const {decorator, doc} = await setupEditor('Use `TEMPORAL_NAMESPACE` for the _config_ variable');

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);

		const italicDecorations = decorator.italic(documentText)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		// Only _config_ should produce italic decorations, not the _ in TEMPORAL_NAMESPACE
		italicDecorations.forEach((d) => {
			assert.ok(
				d.range.start.character >= 37,
				`italic decoration at char ${d.range.start.character} should only be for "_config_" near end of line`,
			);
		});
	});

	test('underscores in identifiers are not treated as italic', async () => {
		const {decorator, doc} = await setupEditor('| `_workflow.py` | `_discover_workflows()` |');

		const documentText = doc.getText();
		const italicDecorations = decorator.italic(documentText);

		assert.strictEqual(italicDecorations.length, 0, 'no italic decorations for mid-word underscores');
	});

	test('aliased URIs with relative paths are detected', async () => {
		const {decorator, doc} = await setupEditor('See [List Filter](/list-filter) for details.');

		const documentText = doc.getText();
		const result = decorator.aliasedURI(documentText);

		assert.ok(result.decorations.length > 0, 'should produce decorations for relative path link');
		assert.ok(result.linkData.length > 0, 'should produce link data for relative path link');
		assert.strictEqual(result.linkData[0]?.target, '/list-filter');
	});

	test('tables: pipes are hidden and header is bolded', async () => {
		const {decorator, doc} = await setupEditor([
			'| Name | Value |',
			'|------|-------|',
			'| foo  | 42    |',
			'| bar  | 99    |',
		].join('\n'));

		const documentText = doc.getText();
		const decorations = decorator.table(documentText);

		// Pipes: 3 per row × 3 rows (header + 2 body) = 9 hide decorations
		// Separator: 1 hide decoration
		// Header: 1 bold decoration
		const hideDecorations = decorations.filter((d) => d.type === decorator.hideDecorationType);
		const headerDecorations = decorations.filter((d) => d.type === decorator.tableHeaderDecorationType);
		const knownTypes = new Set([decorator.hideDecorationType, decorator.tableHeaderDecorationType]);
		const separatorDecorations = decorations.filter((d) => !knownTypes.has(d.type));

		assert.strictEqual(hideDecorations.length, 9, 'should hide 9 pipe characters (3 per non-separator row)');
		assert.strictEqual(headerDecorations.length, 1, 'should bold the header row');
		assert.strictEqual(separatorDecorations.length, 1, 'should hide the separator row');

		// Header decoration should be on line 0
		assert.strictEqual(headerDecorations[0]?.range.start.line, 0);

		// Separator decoration should be on line 1
		assert.strictEqual(separatorDecorations[0]?.range.start.line, 1);
	});

	test('tables: pipes inside inline code are filtered by code block ranges', async () => {
		const {decorator, doc} = await setupEditor([
			'| Code | Result |',
			'|------|--------|',
			'| `a|b` | yes  |',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);
		const decorations = decorator.table(documentText);

		// The pipe inside `a|b` should be filtered out by code block ranges
		const filteredHides = decorations
			.filter((d) => d.type === decorator.hideDecorationType)
			.filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		// 3 pipes on header row + 2 outer pipes on body row = 5 (pipe inside code filtered)
		assert.strictEqual(filteredHides.length, 5, 'pipe inside inline code should be filtered out');
	});

	test('tables: non-table pipe lines are not matched', async () => {
		const {decorator, doc} = await setupEditor('| just a line with pipes |');

		const documentText = doc.getText();
		const decorations = decorator.table(documentText);

		assert.strictEqual(decorations.length, 0, 'single pipe line without separator is not a table');
	});

	test('decorations outside code blocks are unaffected', async () => {
		const {decorator, doc} = await setupEditor([
			'# Heading 1',
			'',
			'**bold text**',
			'',
			'```',
			'code here',
			'```',
			'',
			'_italic text_',
		].join('\n'));

		const documentText = doc.getText();
		const codeBlockRanges = decorator.getCodeBlockRanges(documentText);

		const headings = decorator.headings(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));
		const bold = decorator.bold(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));
		const italic = decorator.italic(documentText).filter((d) => !Decorator.isInsideCodeBlock(d.parent, codeBlockRanges));

		assert.ok(headings.length > 0, 'heading decorations should still apply');
		assert.ok(bold.length > 0, 'bold decorations should still apply');
		assert.ok(italic.length > 0, 'italic decorations should still apply');
	});
});

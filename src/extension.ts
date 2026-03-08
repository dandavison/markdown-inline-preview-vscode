import * as vscode from 'vscode';
import {Decorator} from './decorator';
import {MarkdownDocumentLinkProvider} from './documentLinkProvider';

export function activate(context: vscode.ExtensionContext) {
	const linkProviderInstance = new MarkdownDocumentLinkProvider();
	const decorator = new Decorator();
	decorator.setLinkProvider(linkProviderInstance);
	decorator.setActiveEditor(vscode.window.activeTextEditor);

	const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(() => {
		decorator.setActiveEditor(vscode.window.activeTextEditor);
	});

	const changeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(() => {
		decorator.updateDecorations();
	});

	const changeConfiguration = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('markdownInlinePreview')) {
			decorator.updateDecorations();
		}
	});

	const linkProvider = vscode.languages.registerDocumentLinkProvider(
		[{language: 'markdown'}, {language: 'mdx'}, {language: 'md'}],
		linkProviderInstance,
	);

	const toggleRevealOnCursor = vscode.commands.registerCommand('markdownInlinePreview.toggleRevealOnCursor', () => {
		decorator.revealOnCursor = !decorator.revealOnCursor;
		decorator.updateDecorations();
		vscode.window.setStatusBarMessage(`Markdown reveal on cursor: ${decorator.revealOnCursor ? 'on' : 'off'}`, 3000);
	});

	context.subscriptions.push(changeActiveTextEditor);
	context.subscriptions.push(changeTextEditorSelection);
	context.subscriptions.push(changeConfiguration);
	context.subscriptions.push(linkProvider);
	context.subscriptions.push(toggleRevealOnCursor);
}

export function deactivate(context: vscode.ExtensionContext) {
	context.subscriptions.forEach((subscription) => subscription.dispose());
}

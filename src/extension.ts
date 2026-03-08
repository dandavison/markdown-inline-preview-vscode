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

	// Status bar: extension icon (always visible) + lock (when reveal-on-cursor is off)
	const extensionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	extensionStatus.command = 'markdownInlinePreview.toggleEnabled';

	const revealStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	revealStatus.command = 'markdownInlinePreview.toggleRevealOnCursor';

	const updateStatusBar = () => {
		extensionStatus.text = 'Md';
		extensionStatus.tooltip = decorator.enabled
			? 'Markdown Inline Preview: on (click to disable)'
			: 'Markdown Inline Preview: off (click to enable)';
		extensionStatus.color = decorator.enabled ? undefined : new vscode.ThemeColor('disabledForeground');
		extensionStatus.show();

		if (decorator.enabled && !decorator.revealOnCursor) {
			revealStatus.text = '🔒';
			revealStatus.tooltip = 'Reveal on cursor: off (click to toggle)';
			revealStatus.show();
		} else {
			revealStatus.hide();
		}
	};

	updateStatusBar();

	const toggleEnabled = vscode.commands.registerCommand('markdownInlinePreview.toggleEnabled', () => {
		decorator.enabled = !decorator.enabled;
		decorator.updateDecorations();
		updateStatusBar();
	});

	const toggleRevealOnCursor = vscode.commands.registerCommand('markdownInlinePreview.toggleRevealOnCursor', () => {
		decorator.revealOnCursor = !decorator.revealOnCursor;
		decorator.updateDecorations();
		updateStatusBar();
	});

	context.subscriptions.push(changeActiveTextEditor);
	context.subscriptions.push(changeTextEditorSelection);
	context.subscriptions.push(changeConfiguration);
	context.subscriptions.push(linkProvider);
	context.subscriptions.push(toggleEnabled);
	context.subscriptions.push(toggleRevealOnCursor);
	context.subscriptions.push(extensionStatus);
	context.subscriptions.push(revealStatus);
}

export function deactivate(context: vscode.ExtensionContext) {
	context.subscriptions.forEach((subscription) => subscription.dispose());
}

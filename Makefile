install: clean build uninstall
	code --install-extension markdown-inline-preview-vscode-*.vsix --force
	code --list-extensions --show-versions | rg markdown-inline-preview-vscode

clean:
	@rm *.vsix 2>/dev/null || true

build:
	npx tsc --project tsconfig.build.json
	yes | npx vsce package

uninstall:
	code --uninstall-extension dan.markdown-inline-preview-vscode || true
	! code --list-extensions --show-versions | rg markdown-inline-preview-vscode

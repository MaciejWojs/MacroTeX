# MacroTeX Usage Guide

MacroTeX is a VSCode extension that helps with inserting macros in LaTeX documents.

## Features

1. Macro completion for image paths
2. Image preview on hover
3. Bulk image insertion from explorer
4. Configurable LaTeX macros

## Getting Started

1. Install the MacroTeX extension from the VSCode marketplace
2. Open your LaTeX project in VSCode
3. The extension will automatically detect your main LaTeX file

## Using MacroTeX

### Auto-completion

1. Start typing a LaTeX macro (e.g. `\fg`) in your .tex file
2. The extension will show available paths that match the macro's file typrs requirements
3. Select a path to automatically insert the complete macro with proper paths

Extension creates snippets from user defined macros.

### Image Preview

1. Hover over an image path in your LaTeX document
2. A preview of the image will be displayed in a hover tooltip

### Bulk Image Insertion

1. In the VSCode explorer, select one or multiple images/folders
2. Right-click and select "Insert in active document"
3. Choose the macro you want to use
4. The extension will:
    - Insert the selected images using the chosen macro
    - Create proper relative paths
    - Generate identifiers based on folder/file names
    - Optionally insert `\clearpage` after every 2 images

Example usage:

![Inserting in bulk](assets/bulk.gif)

## Configuration

Configure macros in VSCode settings. Example minimal setup:

```json
"latexMacros.macrosList": [
    {
         "signature": "\\fg{PATH}{}{}",
         "extensions": ["png", "jpg"]
    }
]
```

### Path Management
- Automatic relative path generation to main LaTeX file
- Smart path completion based on workspace
- Support for nested directory structures

### Custom Macros

When creating custom macros, understand these placeholders:

- `{PATH}`: Required for path autocompletion
- `{Caption}`: Optional, for image captions
- `{Identifier}`: Optional, for reference labels

Example configuration:

```json
{
    "signature": "\\fg[width]{PATH}{Caption}{Identifier}",
    "extensions": ["png", "jpg"]
}
```

Corresponding LaTeX macro:
```latex
\newcommand*{\fg}[4][\textwidth]{
        \begin{figure}[!htb]
                \begin{center}
                        \includegraphics[width=#1]{#2}
                        \caption{#3}
                        \label{rys:#4}
                \end{center}
        \end{figure}
}
```

## Troubleshooting

### Common Issues
1. Macro not appearing in suggestions
    - Check if file extension is supported
    - Verify macro configuration in settings
2. Image preview not working
    - Ensure image path is correct
    - Check if image format is supported

### Support
- Report issues on GitHub repository
- Check documentation for updates
- Join community discussions
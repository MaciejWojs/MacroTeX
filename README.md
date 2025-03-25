# MacroTeX Usage Guide
MacroTeX is a VSCode extension that helps with inserting macros in LaTeX documents.

## Table of contents
- [MacroTeX Usage Guide](#macrotex-usage-guide)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Getting Started](#getting-started)
  - [Using MacroTeX](#using-macrotex)
    - [Auto-completion](#auto-completion)
    - [Image Preview](#image-preview)
    - [Bulk Image Insertion](#bulk-image-insertion)
    - [Table Generator Sidebar](#table-generator-sidebar)
  - [Configuration](#configuration)
    - [Path Management](#path-management)
    - [Custom Macros](#custom-macros)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Support](#support)


## Features

1. Macro completion for image paths
2. Image preview on hover
3. Bulk image insertion from explorer
4. Configurable LaTeX macros
5. Smart multi-document support:
   - Automatic detection of main LaTeX files
   - Intelligent path resolution based on document hierarchy
6. File system tracking:
   - Automatic path updates when files are moved or renamed
   - Smart commenting of references to deleted files
7. Enhanced path suggestions:
   - Prioritized local files in suggestions
   - Intelligent path completion based on context
8. Support for various file extensions in path suggestions
9. Table Generator Sidebar:
   - Visual creation of LaTeX tables
   - Direct insertion into documents

## Getting Started

1. Install the MacroTeX extension from the VSCode marketplace
2. Open your LaTeX project in VSCode
3. The extension will automatically detect all main LaTeX files in your workspace
4. Start using macros in any .tex file - paths will be automatically resolved to the nearest main file

## Using MacroTeX

### Auto-completion

1. Start typing a LaTeX macro (e.g. `\fg`) in your .tex file
2. The extension will show available paths that match the macro's file types requirements
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

[![Inserting in bulk](https://i.postimg.cc/XJnhCdXh/bulk.gif)](https://i.postimg.cc/XJnhCdXh/bulk.gif)

### Table Generator Sidebar

1. Open the sidebar by clicking on the MacroTeX icon in the activity bar
2. Use the Table Generator panel to:
   - Set the number of rows and columns
   - Preview the table structure
3. Click "Convert to LaTeX" to add the LaTeX table code to your active document
4. The table will be inserted at the current cursor position with proper LaTeX formatting

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
- Automatic detection and handling of multiple main LaTeX files
- Smart relative path generation based on document hierarchy
- Automatic path updates when files are moved or renamed
- Intelligent handling of deleted files
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
    - Ensure there is a main LaTeX file in your workspace
2. Image preview not working
    - Ensure image path is correct
    - Check if image format is supported
    - Verify the path relative to the main LaTeX file
3. Path resolution issues
    - Check if your document is in the same workspace as the main LaTeX file
    - Verify that the file contains a \documentclass declaration

### Support
- Report issues on GitHub repository
- Check documentation for updates
- Join community discussions
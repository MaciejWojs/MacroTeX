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
    - [CSV to LaTeX Table Conversion](#csv-to-latex-table-conversion)
    - [Macro Finder](#macro-finder)
    - [Macro Expansion & Collapse](#macro-expansion--collapse)
  - [Configuration](#configuration)
    - [Path Management](#path-management)
    - [Custom Macros](#custom-macros)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
    - [Support](#support)


## Features

1. **Macro completion for file paths**
   - Auto-completion for images and various file types
   - Smart path suggestions with proper relative paths
2. **Image preview on hover**
   - Preview images directly in the editor
3. **Bulk image insertion from explorer**
   - Multi-select files and insert with chosen macro
   - Automatic path generation and identifier creation
4. **Configurable LaTeX macros**
   - Support for custom macro signatures
   - Advanced parameter extraction modes (LaTeX notation, positional, smart)
5. **Smart multi-document support**
   - Automatic detection of main LaTeX files
   - Intelligent path resolution based on document hierarchy
6. **File system tracking**
   - Automatic path updates when files are moved or renamed
   - Smart commenting of references to deleted files
7. **Enhanced path suggestions**
   - Prioritized local files in suggestions
   - Support for various file extensions in path suggestions
8. **Interactive Table Generator Sidebar**
   - Visual creation and editing of LaTeX tables
   - Live LaTeX preview with real-time updates
   - Support for multiple table environments (table, longtable, tabularx, tabulary)
   - One-click insertion into documents
9. **CSV to LaTeX Table Conversion**
   - Convert CSV files directly to LaTeX tables
   - Automatic insertion with proper formatting
10. **Macro Finder & Management**
    - Browse and search through all macros in your project
    - Filter by macro type (newcommand, renewcommand, def)
    - Save project macros to extension configuration
    - Navigate to macro definitions
11. **Macro Expansion & Collapse**
    - Expand macro usage to its full definition
    - Collapse expanded definitions back to macro usage
    - Context menu integration in LaTeX files

## Getting Started

1. Install the MacroTeX extension from the VSCode marketplace
2. Open your LaTeX project in VSCode
3. The extension will automatically detect all main LaTeX files in your workspace
4. Start using macros in any .tex file - paths will be automatically resolved to the nearest main file

## Using MacroTeX

### Auto-completion

1. Start typing a LaTeX macro (e.g. `\fg`) in your .tex file
2. The extension will show available paths that match the macro's file type requirements
3. Select a path to automatically insert the complete macro with proper paths
4. The extension creates snippets from user-defined macros for quick insertion

Features:
- **Smart path completion**: Prioritizes local files and shows relative paths
- **File type filtering**: Only shows files matching macro's configured extensions
- **Snippet generation**: Automatic creation of VS Code snippets from macro signatures
- **Multi-file support**: Works across multiple LaTeX documents in your project

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
   - Choose table type (table, longtable, tabularx, tabulary)
   - Edit table content directly in the visual editor
   - Preview the generated LaTeX code in real-time
3. Click "Insert LaTeX Table" to add the LaTeX table code to your active document
4. The table will be inserted at the current cursor position with proper LaTeX formatting

The Table Generator features:
- **Live preview**: See LaTeX code update automatically as you edit
- **Multiple table environments**: Support for different LaTeX table types
- **Interactive editing**: Add/remove rows and columns dynamically
- **Real-time validation**: Immediate feedback on table structure

### CSV to LaTeX Table Conversion

1. Select a CSV file in the VSCode explorer
2. Right-click and select "Insert CSV as table"
3. The extension will:
   - Convert the CSV data to a properly formatted LaTeX table
   - Insert the table at the current cursor position in the active editor
   - Maintain the structure and data from your CSV file
   - Escape special LaTeX characters automatically

Use this feature to quickly import data tables from CSV files into your LaTeX documents without manual formatting.

### Macro Finder

The Macro Finder is a powerful tool for managing LaTeX macros in your project:

1. Open the MacroTeX sidebar and navigate to the "Macro Finder" panel
2. The extension automatically scans your project for all macro definitions
3. Browse through macros organized by type:
   - `\newcommand` - Standard command definitions
   - `\newcommand*` - Non-long command definitions  
   - `\renewcommand` - Redefined commands
   - `\renewcommand*` - Non-long redefined commands
   - `\def` - TeX primitive definitions

Features:
- **Smart filtering**: Filter macros by type or search by name
- **Quick navigation**: Click "Go to" to jump to macro definition
- **Usage examples**: See how each macro should be used
- **Save to configuration**: Convert project macros to extension configuration for auto-completion
- **Macro management**: Delete or edit macro definitions directly

### Macro Expansion & Collapse

Work more efficiently with LaTeX macros using expansion and collapse features:

#### Expanding Macros
1. Select a macro usage in your LaTeX file (e.g., `\fg{image.png}{Caption}{label}`)
2. Right-click and select "Expand Macro to Definition" or use the command palette
3. The macro usage will be replaced with its full definition
4. Requires the macro to be configured in extension settings

#### Collapsing Definitions  
1. Select an expanded macro definition in your LaTeX file
2. Right-click and select "Collapse Definition to Macro Usage" or use the command palette
3. The full definition will be collapsed back to simple macro usage
4. Automatically finds matching macro signatures from your configuration

These features help you:
- **Debug macro behavior**: See exactly what your macros expand to
- **Clean up code**: Collapse verbose definitions to concise macro calls
- **Learn LaTeX**: Understand how complex macros work internally

## Configuration

Configure macros in VSCode settings. Example minimal setup:

```json
"latexMacros.macrosList": [
    {
        "signature": "\\fg{PATH}{Caption}{Identifier}",
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

## Macro Parameter Extraction

### 🎯 **Best Method - LaTeX Notation** (RECOMMENDED)

Use standard LaTeX notation with `#1`, `#2`, `#3` - exactly as in macro definition:

```json
{
  "signature": "\\MyMacro{#1}{#2}{#3}",
  "extensions": ["pdf"]
}
```

**Example:**
- Usage: `\MyMacro{dog}{cat}{bird}`
- Macro definition: `\newcommand{\MyMacro}[3]{\myspecialcommand[title=#1, id=#2]{#3}}`
- Expanded: `\myspecialcommand[title=dog, id=cat]{bird}`
- Collapse: System finds `dog`, `cat`, `bird` and returns `\MyMacro{dog}{cat}{bird}`

### 🔧 **Positional Mode** (only with LaTeX notation)

For LaTeX notation with positional extraction:

```json
{
  "signature": "\\MyMacro{#1}{#2}{#3}",
  "extensions": ["txt", "pdf"],
  "extractionMode": "positional"
}
```

**Important:** Positional mode only works with LaTeX notation (`#1`, `#2`, etc.), not with custom parameter names.

### 🧠 **Smart Method** (only for standard patterns)

System recognizes standard LaTeX patterns:

```json
{
  "signature": "\\fg{PATH}{Caption}{Identifier}",
  "extensions": ["png", "jpg"]
}
```

### 📋 **Configuration Examples**

#### Macro with LaTeX notation (RECOMMENDED):
```json
{
  "signature": "\\ShowCode{#1}{#2}{#3}",
  "extensions": ["py", "js", "cpp"]
}
```

#### Complex macro with many square bracket parameters:
```json
{
  "signature": "\\MyComplexMacro[#1][#2][#3]{#4}{#5}",
  "extensions": ["png", "jpg"]
}
```

#### Standard figure macro:
```json
{
  "signature": "\\fg{PATH}{Caption}{Identifier}",
  "extensions": ["png", "jpg", "pdf"]
}
```

#### Macro with positional mode (LaTeX notation only):
```json
{
  "signature": "\\CustomMacro{#1}{#2}{#3}",
  "extensions": ["tex"],
  "extractionMode": "positional"
}
```

### ✅ **Recommendations**

1. **For new macros**: use LaTeX notation `{#1}{#2}{#3}` - simplest and most natural!
2. **For complex macros with multiple square brackets**: use LaTeX notation `[#1,#2]{#3}{#4}`
3. **For standard patterns** (PATH, Caption, Identifier): leave default settings
4. **For positional extraction**: only use with LaTeX notation (`#1`, `#2`, etc.)

### 🔧 **Complete Configuration Example**

```json
{
  "latexMacros.macrosList": [
    {
      "signature": "\\fg{PATH}{Caption}{Identifier}",
      "extensions": ["png", "jpg"]
    },
    {
      "signature": "\\code{#1}{#2}{#3}",
      "extensions": ["py", "js", "cpp"]
    },
    {
      "signature": "\\ref{#1}{#2}",
      "extensions": ["tex"]
    },
    {
      "signature": "\\ComplexMacro[#1,#2,#3]{#4}{#5}",
      "extensions": ["txt", "c", "cpp"]
    }
  ]
}
```

### 🚀 **How It Works**

#### LaTeX Notation:
1. Expand: `\MyMacro{A}{B}{C}` → macro definition substitutes #1=A, #2=B, #3=C
2. Collapse: System finds values in order and maps 1:1 → `\MyMacro{A}{B}{C}`

#### Positional Mode (LaTeX notation only):
1. Expand: `\MyMacro{A}{B}` → `\section{A}\input{B}`
2. Collapse: Finds all parameters → takes first two → `\MyMacro{A}{B}`

#### Smart Mode:
1. Expand: `\fg{path.png}{My Caption}{fig1}` → `\includegraphics{path.png}\caption{My Caption}\label{fig:fig1}`
2. Collapse: Recognizes patterns → PATH, Caption, Identifier → `\fg{path.png}{My Caption}{fig1}`

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
1. **Macro not appearing in suggestions**
    - Check if file extension is supported in macro configuration
    - Verify macro configuration in settings (`latexMacros.macrosList`)
    - Ensure there is a main LaTeX file in your workspace (file with `\documentclass`)
2. **Image preview not working**
    - Ensure image path is correct relative to the main LaTeX file
    - Check if image format is supported (png, jpg, jpeg etc.)
    - Verify the path relative to the main LaTeX file
3. **Path resolution issues**
    - Check if your document is in the same workspace as the main LaTeX file
    - Verify that the file contains a `\documentclass` declaration
    - Ensure file paths use forward slashes (/) not backslashes (\)
4. **Table Generator not working**
    - Ensure you have an active LaTeX editor open
    - Check that the cursor is positioned where you want to insert the table
    - Verify your VS Code version supports webview panels
5. **Macro Finder not showing macros**
    - Ensure your project contains LaTeX files with macro definitions
    - Check that files are properly saved and accessible
    - Try refreshing the Macro Finder panel
6. **Expansion/Collapse not working**
    - Ensure the macro is configured in extension settings
    - Check that you have selected the complete macro usage or definition
    - Verify you're working in a `.tex` file

### Support
- Report issues on GitHub repository
- Check documentation for updates
- Join community discussions
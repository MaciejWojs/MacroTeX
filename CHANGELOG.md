# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

# [0.2.2]

### Added
- **LaTeX Macro Finder** - new sidebar panel for discovering and managing LaTeX macros
- Automatic scanning of all .tex files in project for macro definitions
- Support for all macro types: `\newcommand`, `\newcommand*`, `\renewcommand`, `\renewcommand*`, `\def`
- Advanced parsing with multi-line definitions and nested braces
- Macro filtering by type with dropdown selector
- **Save Macro feature** - convert found macros to configuration signatures with PATH placeholders
- One-click save to user settings with optional editing

### Changed
- Renamed "Macro Manager" to "Macro Finder"
- Updated activity bar title to "MacroTeX"
- Enhanced UI with `@vscode-elements` components
- Improved file structure and class naming consistency

# [0.2.1]

### Fixed
- Resolved issue with UI components not loading correctly in Table Generator webview
- Fixed fallback resource loading mechanism for @vscode-elements components
- Improved path resolution for bundled.js and toolkit.js fallback scripts
- Enhanced debugging output for webview resource loading (can be enabled via IS_LOGGING_ENABLED flag)

# [0.2.1]

### Added
- Live LaTeX preview in Table Generator - preview updates automatically as you edit the table
- Real-time table editing feedback with instant LaTeX code generation
- Enhanced table reconstruction system for better column/row management

### Changed
- Converted "Convert to LaTeX" button to "Insert LaTeX Table" - now only inserts code instead of replacing preview
- Improved table manipulation reliability - fixed issues with adding/removing columns
- Enhanced table rebuild mechanism using data-driven approach instead of DOM manipulation
- Better event handling for live preview updates on all table changes
- Migrated Table Generator UI to use @vscode-elements web components for better VS Code integration and consistency
- Replaced custom HTML table elements with vscode-table, vscode-button, vscode-checkbox, and vscode-single-select components
- Improved visual consistency with VS Code's native UI components and theming

# [0.2.0]

### Added
- Enhanced LaTeX Table Generator with support for different table environments
- Added selection for multiple LaTeX table types: table, longtable, tabularx, and tabulary
- Improved special character escaping for LaTeX compatibility
- Enhanced table styling and user interface elements

### Changed
- Refactored LaTeX table generation algorithm for better output
- Improved table editor interface with visual feedback
- Enhanced content validation and input handling in editable cells

# [0.1.9]

### Added
- Added CSV to LaTeX table conversion feature
- Support for converting CSV files to properly formatted LaTeX tables
- Right-click context menu for converting CSV files directly to LaTeX tables
- Automatic insertion of generated tables into active document
- Special character handling in CSV data when converting to LaTeX format

### Fixed
- Fixed incorrect backslash escaping in LaTeX table generator output

# [0.1.8]

### Added
- Added new LaTeX Table Generator sidebar UI
- Interactive table creation and editing with direct LaTeX output
- Support for adding/removing rows and columns
- One-click conversion of tables to LaTeX format
- Automatic insertion of generated tables into active document

# [0.1.7]

### Added
- Added macro filtering based on file extensions when using context commands

### Changed
- Improved directory handling when using context commands

# [0.1.6]

### Added
- Added new auto-completion functionality for files with extensions other than images
- Added support for new file types in path suggestions

### Fixed
- Fixed a bug causing incorrect path suggestions display for certain file types
- In previous version accidentally brought back older algorithm

# [0.1.5]

### Fixed
- Files with extensions other than images are now suggested in auto-completion
- Improved handling of file extensions in path suggestions

# [0.1.4]

### Added
- Improved support for Windows file paths
- Enhanced path handling for cross-platform compatibility
- Added diagnostic output channel for improved debugging and user feedback
- Added support for multiple main LaTeX files
- Added automatic file tracking system:
  - Comment out references to deleted files
  - Update paths in documents when files are renamed
- Added comprehensive JSDoc documentation

### Changed
- Optimized file searching pattern (GLOB) to reduce disk I/O operations
- Updated changelog format and structure
- Refined path resolution logic for Windows environments
- Restructured code for better maintainability:
  - Extracted common functionality into separate functions
  - Improved type safety and error handling
  - Added better function documentation

# [0.1.3]

### Added
- Added path suggestions configuration
- Added README table of contents

### Changed
- Improved path configuration system

# [0.1.2]

### Changed
- Improved path matching algorithm
- Enhanced path suggestions functionality
- Updated suggestion display format

# [0.1.1]

### Added
- Implemented basic path suggestion functionality
- Added hover feature for path information
- Added image preview in path suggestions
- Added context menu integration for macro insertion:
  - Support for inserting predefined macros
  - Right-click menu in file explorer
  - Dynamic macro list based on configuration

### Changed
- Updated suggestion display mechanism
- Improved path resolution logic

# [0.0.1]

### Added
- Initial extension setup based on template
- Basic extension structure and configuration
- Project scaffolding from https://github.com/lalunamel/bun-vscode-extension
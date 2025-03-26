# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

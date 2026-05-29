# Requirements Document

## Introduction

Package the existing interactive story game (Fastify backend + React/Vite frontend) into a standalone Electron desktop application. Users double-click an executable to launch the game without needing to install Node.js, run terminal commands, or manage separate processes. The Electron shell embeds the backend server, serves the frontend, bundles all game data, and provides a settings UI for API key configuration.

## Glossary

- **Electron_Shell**: The Electron main process that orchestrates application lifecycle, spawns the backend, and hosts the renderer window
- **Backend_Server**: The Fastify HTTP server (currently apps/api) running embedded within the Electron process on a local port
- **Frontend**: The React/Vite application (currently apps/web) built as static assets and served by the Backend_Server or loaded directly in the renderer
- **Story_Package**: A bundled story definition stored in the application data directory (currently apps/data/task-packages/)
- **Save_File**: A user's game progress file stored in the user data directory (currently apps/data/saves/)
- **API_Key**: The user's DeepSeek API key required for LLM-powered story generation
- **App_Data_Directory**: The platform-specific writable directory where the application stores user configuration, saves, and runtime data (e.g., %APPDATA% on Windows)
- **Bundled_Assets**: Static resources packaged inside the application installer including story packages, frontend build output, and backend code
- **Settings_UI**: An in-app interface allowing users to configure their API key and other preferences
- **Installer**: The distributable package (exe for Windows) that installs the application on the user's system

## Requirements

### Requirement 1: Application Launch

**User Story:** As a player, I want to launch the game by double-clicking a desktop icon, so that I can play without any technical setup.

#### Acceptance Criteria

1. WHEN the user launches the application executable, THE Electron_Shell SHALL start the Backend_Server on an available local port within 10 seconds
2. WHEN the Backend_Server reports ready, THE Electron_Shell SHALL open the main application window and load the Frontend
3. IF the Backend_Server fails to start within 10 seconds, THEN THE Electron_Shell SHALL display an error dialog with the failure reason and offer a retry option
4. THE Electron_Shell SHALL ensure only one instance of the application runs at a time

### Requirement 2: Backend Embedding

**User Story:** As a player, I want the game server to run automatically inside the app, so that I do not need to manage separate processes or install Node.js.

#### Acceptance Criteria

1. THE Electron_Shell SHALL start the Backend_Server as a child process or in-process module without requiring a separate Node.js installation
2. THE Backend_Server SHALL listen on localhost only, preventing external network access to the game server
3. WHEN the application window is closed, THE Electron_Shell SHALL gracefully shut down the Backend_Server before exiting
4. THE Backend_Server SHALL use a dynamically selected available port to avoid conflicts with other applications
5. IF the Backend_Server crashes during gameplay, THEN THE Electron_Shell SHALL attempt to restart the Backend_Server and notify the user

### Requirement 3: Frontend Serving

**User Story:** As a player, I want the game interface to load reliably within the desktop app, so that I have the same experience as the web version.

#### Acceptance Criteria

1. THE Electron_Shell SHALL load the Frontend from the embedded Backend_Server URL after the server is ready
2. THE Frontend SHALL be pre-built as static assets and bundled within the application package
3. THE Backend_Server SHALL serve the static Frontend assets in addition to API routes
4. WHEN the Frontend makes API requests, THE Backend_Server SHALL handle them on the same origin without requiring proxy configuration

### Requirement 4: Data Bundling

**User Story:** As a player, I want story packages included with the game, so that I can play immediately after installation without downloading additional content.

#### Acceptance Criteria

1. THE Installer SHALL include all Story_Package files from the task-packages directory as Bundled_Assets
2. WHEN the application launches for the first time, THE Electron_Shell SHALL copy Bundled_Assets to the App_Data_Directory if they do not already exist
3. THE Backend_Server SHALL read Story_Package files from the App_Data_Directory at runtime
4. THE Backend_Server SHALL read and write Save_File data to the App_Data_Directory
5. WHEN the application is updated, THE Installer SHALL preserve existing Save_File data in the App_Data_Directory

### Requirement 5: API Key Configuration

**User Story:** As a player, I want to enter my DeepSeek API key in the app, so that I can use LLM-powered story generation without editing configuration files.

#### Acceptance Criteria

1. WHEN the application launches without a configured API_Key, THE Electron_Shell SHALL display the Settings_UI prompting the user to enter an API_Key
2. THE Settings_UI SHALL provide a text input field for the user to enter, view (masked), and save the API_Key
3. WHEN the user saves an API_Key, THE Electron_Shell SHALL persist the API_Key to a configuration file in the App_Data_Directory
4. WHEN the Backend_Server starts, THE Backend_Server SHALL read the API_Key from the persisted configuration file
5. THE Settings_UI SHALL allow the user to update the API_Key at any time from within the application
6. THE Electron_Shell SHALL store the API_Key configuration file with restricted read permissions accessible only to the current user

### Requirement 6: Application Packaging and Distribution

**User Story:** As a player, I want to install the game using a standard Windows installer, so that I can set up the game like any other desktop application.

#### Acceptance Criteria

1. THE build system SHALL produce a Windows Installer (exe) using electron-builder or equivalent tooling
2. THE Installer SHALL create a desktop shortcut and Start Menu entry for the application
3. THE Installer SHALL include an uninstaller that removes application files while preserving user data in the App_Data_Directory
4. WHERE the build targets macOS, THE build system SHALL produce a DMG or pkg installer
5. WHERE the build targets Linux, THE build system SHALL produce an AppImage or deb package

### Requirement 7: Window Management

**User Story:** As a player, I want the game window to behave like a native desktop application, so that I have a familiar and comfortable experience.

#### Acceptance Criteria

1. THE Electron_Shell SHALL open the main window with a default size of 1280x800 pixels
2. THE Electron_Shell SHALL remember and restore the window size and position from the previous session
3. THE Electron_Shell SHALL set the application title to the game name and display an application icon
4. WHEN the user closes the window, THE Electron_Shell SHALL minimize to the system tray or exit based on user preference
5. THE Electron_Shell SHALL disable navigation to external URLs within the application window

### Requirement 8: Error Handling and Logging

**User Story:** As a player, I want clear error messages when something goes wrong, so that I can troubleshoot issues or report them.

#### Acceptance Criteria

1. IF the Backend_Server encounters an unhandled error, THEN THE Electron_Shell SHALL log the error to a file in the App_Data_Directory
2. IF the application fails to connect to the DeepSeek API, THEN THE Frontend SHALL display a user-friendly error message indicating the API is unreachable
3. THE Electron_Shell SHALL write application logs to a rotating log file in the App_Data_Directory
4. WHEN the user reports an issue, THE Settings_UI SHALL provide a button to open the log file directory

### Requirement 9: Auto-Update Support

**User Story:** As a player, I want the game to notify me of updates, so that I can get new features and bug fixes without manually downloading a new installer.

#### Acceptance Criteria

1. WHEN the application starts, THE Electron_Shell SHALL check for available updates from a configured update server
2. WHEN an update is available, THE Electron_Shell SHALL notify the user and offer to download and install the update
3. IF the update check fails due to network issues, THEN THE Electron_Shell SHALL silently continue without blocking application usage
4. WHEN the user accepts an update, THE Electron_Shell SHALL download the update in the background and apply it on next restart

### Requirement 10: TTS Integration

**User Story:** As a player, I want text-to-speech to work in the desktop app if configured, so that I can listen to story narration.

#### Acceptance Criteria

1. WHERE TTS is enabled in the application configuration, THE Backend_Server SHALL connect to the configured TTS service URL
2. THE Backend_Server SHALL cache TTS audio files in the App_Data_Directory
3. IF the TTS service is unavailable, THEN THE Backend_Server SHALL return a descriptive error and the Frontend SHALL continue without audio

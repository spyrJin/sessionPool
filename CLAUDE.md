# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SessionPool is a Google Apps Script (GAS) project for managing collaborative session pools. It allows users to sign up for time-blocked sessions (30-minute intervals), automatically groups participants (2-3 people), and assigns Google Meet rooms for focused work sessions.

## Commands

### Testing
```bash
# Run unit tests (uses Bun)
bun test

# Run specific test file
bun test test/matching.test.js

# Run UI tests (Playwright)
npm run test:ui
```

### Deployment
```bash
# Push to Google Apps Script
npm run deploy        # or: clasp push

# Login to clasp (one-time setup)
npm run login         # or: clasp login
```

## Architecture

### Core Flow
The system operates on a **gate-based timing model**:
1. Gates open every 30 minutes (00-05 and 30-35 of each hour)
2. Users select sessions during open gates
3. When gate closes, the MatchingEngine groups participants
4. MeetAssigner distributes groups to Google Meet rooms

### Key Files in `gas/`

- **Config.gs**: Global configuration (time blocks, cohorts, colors, admin emails)
- **MatchingEngine.gs**: Core grouping algorithm (2-3 person groups, 4→2+2 split rule, Universal Pool for leftovers)
- **GateManager.gs**: Gate open/close handling, triggers matching and room assignment
- **MeetAssigner.gs**: Assigns Meet rooms to groups using round-robin per cohort
- **DailyManager.gs**: Creates daily session sheets and sends email notifications via Resend API
- **UserManager.gs**: User registration, streak tracking (consecutive participation days)
- **Utils.gs**: Time calculations, parsing utilities, `getMainSheet()` for remote sheet control
- **Triggers.gs**: Time-based trigger setup for gate management

### Matching Logic (MatchingEngine.gs)
- Groups users by session type first
- Sorts by streak (descending) within each session
- Splits into 2-3 person groups (4 people → 2+2, never 3+1)
- Single leftover users go to Universal Pool for cross-session matching
- Final leftover goes to Lobby (waiting room)

### Testing Setup
Tests use a custom `gas-loader.js` that loads GAS files into a Node.js VM context with mocked GAS services (`gas-mocks.js`). This allows running MatchingEngine and other pure logic locally.

## CI/CD

GitHub Actions workflow runs:
1. Unit tests with Bun
2. UI tests with Playwright
3. Auto-deploy to GAS via clasp (on main branch push)

Deployment requires `CLASP_TOKEN` secret containing clasp credentials.

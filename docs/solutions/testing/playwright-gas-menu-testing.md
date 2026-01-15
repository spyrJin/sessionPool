---
title: "Playwright Testing for Google Apps Script Custom Menus"
problem_type: testing
severity: low
date_solved: 2026-01-15
component: test/ui.playwright.js
affected_files:
  - test/ui.playwright.js
  - playwright.config.js
symptoms:
  - No automated testing for GAS custom menu functionality
  - Manual testing required for each deployment
  - OAuth flow complexity made automation difficult
root_cause: GAS custom menus only exist in Sheets UI and require authentication
solution_summary: Used Playwright MCP tools with OAuth flow handling to automate menu testing
tags:
  - playwright
  - e2e-testing
  - google-apps-script
  - oauth
  - browser-automation
---

# Playwright Testing for GAS Custom Menus

## Problem

Google Apps Script custom menus (added via `onOpen()`) can only be tested in the actual Google Sheets UI. This requires:
- Browser automation
- Handling Google OAuth authorization flows
- Reading dialog results from the accessibility tree

## Solution: Playwright MCP Browser Testing

### Navigation Flow

```
Apps Script Dashboard → Find Project → Open Sheet → Access Custom Menu
```

### Step 1: Navigate to Apps Script Dashboard

```javascript
await mcp__playwright__browser_navigate({
  url: 'https://script.google.com/home'
});
```

### Step 2: Open Associated Spreadsheet

```javascript
// Find the "Open Sheet" link in project list
await mcp__playwright__browser_snapshot({});

await mcp__playwright__browser_click({
  element: 'Open Sheet link',
  ref: 'spreadsheet-link-ref'  // Get from snapshot
});
```

### Step 3: Handle OAuth Authorization (First Time Only)

When a GAS function runs for the first time, Google prompts for authorization:

```javascript
// 1. Authorization required dialog appears
await mcp__playwright__browser_click({
  element: 'OK button to authorize',
  ref: 'ok-button-ref'
});

// 2. Handle "Google hasn't verified this app" warning
await mcp__playwright__browser_click({
  element: 'Advanced link',
  ref: 'advanced-ref'
});

// 3. Click "Go to [App Name] (unsafe)"
await mcp__playwright__browser_click({
  element: 'Go to unsafe app link',
  ref: 'unsafe-link-ref'
});

// 4. Grant all permissions
await mcp__playwright__browser_click({
  element: 'Select all checkbox',
  ref: 'select-all-ref'
});

// 5. Confirm
await mcp__playwright__browser_click({
  element: 'Continue button',
  ref: 'continue-ref'
});
```

### Step 4: Test Custom Menu

```javascript
// Click the custom menu button
await mcp__playwright__browser_click({
  element: '🔧 관리자 menu button',
  ref: 'admin-menu-ref'
});

// Select menu item
await mcp__playwright__browser_click({
  element: '📋 활성 시트 정보 menu item',
  ref: 'menu-item-ref'
});

// Read dialog result
const snapshot = await mcp__playwright__browser_snapshot({});
// Dialog content appears in snapshot with dialog role
```

## Key Gotchas

1. **Element refs change**: Always call `browser_snapshot` before each click to get current refs

2. **OAuth flow varies**: Depends on:
   - Previous authorization state
   - Google Workspace domain settings
   - App verification status

3. **Timing is critical**: GAS operations can be slow
   ```javascript
   await mcp__playwright__browser_wait_for({
     text: 'Expected dialog title',
     time: 10  // seconds
   });
   ```

4. **Tab management**: OAuth opens new tabs
   ```javascript
   await mcp__playwright__browser_tabs({ action: 'select', index: 3 });
   ```

5. **Dialog detection**: GAS dialogs appear as `dialog` role in accessibility tree

## Local Sidebar Testing (Alternative)

For faster CI testing, mock `google.script.run`:

**File**: `test/ui.playwright.js`

```javascript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.google = {
      script: {
        run: {
          withSuccessHandler: function(cb) {
            this._success = cb;
            return this;
          },
          withFailureHandler: function(cb) {
            this._failure = cb;
            return this;
          },
          getSidebarData: function() {
            setTimeout(() => {
              this._success({
                registered: true,
                email: 'test@example.com',
                gateStatus: { isOpen: true }
              });
            }, 100);
          }
        }
      }
    };
  });

  await page.goto('file://' + sidebarPath);
});
```

## CI/CD Considerations

| Test Type | Run in CI? | Notes |
|-----------|-----------|-------|
| Mocked sidebar tests | Yes | Fast, no auth needed |
| Full OAuth flow tests | No | Requires credentials |
| Menu interaction tests | No | Requires live Sheets |

For CI, use mocked tests:

```yaml
# .github/workflows/test.yml
- run: npm run test:ui
  env:
    CI: true
```

## Test Verification Checklist

- [ ] Custom menus appear after spreadsheet loads
- [ ] Menu items trigger correct functions
- [ ] Dialogs display expected content
- [ ] Error dialogs show user-friendly messages
- [ ] Authorization flow completes successfully (first-time setup)

## Related

- Playwright MCP Documentation
- GAS Custom Menus: https://developers.google.com/apps-script/guides/menus

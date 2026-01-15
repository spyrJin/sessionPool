---
title: "XSS Prevention with escapeHtml() in Google Apps Script"
problem_type: security_issue
severity: high
date_solved: 2026-01-15
component: gas/Utils.gs
affected_files:
  - gas/Utils.gs
  - gas/DailyManager.gs
symptoms:
  - User-supplied data (instagram handles, emails) rendered directly in HTML emails
  - Potential script injection via malicious usernames
  - HTML entity characters could break email formatting
root_cause: Template variables interpolated into HTML without sanitization
solution_summary: Implemented escapeHtml() utility function to sanitize all user input before HTML template injection
tags:
  - xss
  - security
  - html-injection
  - email-templates
  - google-apps-script
  - sanitization
---

# XSS Prevention in Google Apps Script Email Templates

## Problem

User-supplied data (Instagram handles, emails, names) was being interpolated directly into HTML email templates without sanitization. This created XSS vulnerabilities where malicious usernames like `<script>alert('xss')</script>` could execute in email clients.

## Solution

### 1. Created `escapeHtml()` Function

**File**: `gas/Utils.gs` (lines 33-44)

```javascript
/**
 * HTML 엔티티 이스케이프 (XSS 방지)
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')   // Must be first (avoid double-escaping)
    .replace(/</g, '&lt;')    // Prevents <script> injection
    .replace(/>/g, '&gt;')    // Closes tags
    .replace(/"/g, '&quot;')  // Prevents attribute injection
    .replace(/'/g, '&#039;'); // Prevents JS string injection
}
```

### 2. Applied to Email Templates

**File**: `gas/DailyManager.gs` (lines 173-174)

```javascript
// XSS-safe variable substitution
html = html.replace(/{{name}}/g, escapeHtml(user.instagram || '멤버'));
html = html.replace(/{{email}}/g, escapeHtml(user.email));
```

## Key Gotchas

1. **Order matters**: Always escape `&` first to avoid double-escaping (`<` becomes `&lt;` not `&amp;lt;`)

2. **Null safety**: Always check for null/undefined input:
   ```javascript
   if (!text) return '';
   ```

3. **Type coercion**: Use `String(text)` to handle numeric inputs

4. **Where to apply**:
   - User-provided data in HTML emails
   - Data from spreadsheet cells in sidebars/dialogs
   - Any `innerHTML` assignments

5. **What NOT to escape**: System-generated URLs that aren't user input

## Common Injection Points in GAS

| Location | Risk | Safe? |
|----------|------|-------|
| `ui.alert()` | Low | Auto-escapes |
| `toast()` | Low | Auto-escapes |
| `textContent` | None | Does not parse HTML |
| `innerHTML` | High | Must escape manually |
| Email HTML templates | High | Must escape manually |

## Prevention Checklist

- [ ] All user input escaped before HTML interpolation
- [ ] Email template variables use `escapeHtml()`
- [ ] Sidebar error messages use `textContent` not `innerHTML`
- [ ] Announcement text escaped before display

## Related

- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

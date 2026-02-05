/**
 * ============================================================
 * Lightweight GAS Mocks for Bun/Node.js Testing
 * @mcpher/gas-fakes 대체용 경량 mock 구현
 * ============================================================
 */

// ─────────────────────────────────────────────────────────
// Mock Sheet Class
// ─────────────────────────────────────────────────────────
class MockRange {
  constructor(values = [[]]) {
    this._values = values;
    this._backgrounds = values.map(row => row.map(() => '#ffffff'));
    this._fontColors = values.map(row => row.map(() => '#000000'));
  }
  
  getValue() { return this._values[0]?.[0] ?? ''; }
  getValues() { return this._values; }
  setValue(value) { this._values = [[value]]; return this; }
  setValues(values) { this._values = values; return this; }
  getBackground() { return this._backgrounds[0]?.[0] ?? '#ffffff'; }
  getBackgrounds() { return this._backgrounds; }
  setBackground(color) { this._backgrounds = [[color]]; return this; }
  setBackgrounds(colors) { this._backgrounds = colors; return this; }
  getFontColor() { return this._fontColors[0]?.[0] ?? '#000000'; }
  setFontColor(color) { this._fontColors = [[color]]; return this; }
  getNumRows() { return this._values.length; }
  getNumColumns() { return this._values[0]?.length ?? 0; }
  getRow() { return 1; }
  getColumn() { return 1; }
  offset(rowOffset, colOffset, numRows = 1, numCols = 1) { return new MockRange([['']]); }
}

class MockSheet {
  constructor(name = 'Sheet1') {
    this._name = name;
    this._data = [];
    this._lastRow = 0;
    this._lastColumn = 0;
  }
  
  getName() { return this._name; }
  setName(name) { this._name = name; return this; }
  getRange(row, col, numRows = 1, numCols = 1) { return new MockRange([['']]); }
  getDataRange() { return new MockRange(this._data.length ? this._data : [['']]); }
  getLastRow() { return this._lastRow; }
  getLastColumn() { return this._lastColumn; }
  appendRow(values) { this._data.push(values); this._lastRow++; return this; }
  deleteRow(row) { return this; }
  insertRowAfter(row) { return this; }
  clear() { this._data = []; this._lastRow = 0; return this; }
  getSheetId() { return 123456; }
  activate() { return this; }
}

class MockSpreadsheet {
  constructor(name = 'Untitled Spreadsheet') {
    this._name = name;
    this._sheets = { 'Sheet1': new MockSheet('Sheet1') };
    this._activeSheet = this._sheets['Sheet1'];
  }
  
  getName() { return this._name; }
  getId() { return 'mock-spreadsheet-id-' + Date.now(); }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/mock-id/edit'; }
  getSheetByName(name) { 
    if (!this._sheets[name]) {
      this._sheets[name] = new MockSheet(name);
    }
    return this._sheets[name]; 
  }
  getSheets() { return Object.values(this._sheets); }
  getActiveSheet() { return this._activeSheet; }
  insertSheet(name) { 
    const sheet = new MockSheet(name);
    this._sheets[name] = sheet;
    return sheet;
  }
  deleteSheet(sheet) { delete this._sheets[sheet.getName()]; }
  toast(msg, title, timeout) { console.log(`[Toast] ${title}: ${msg}`); }
}

// ─────────────────────────────────────────────────────────
// SpreadsheetApp Mock
// ─────────────────────────────────────────────────────────
const SpreadsheetApp = {
  _active: null,
  
  create(name) {
    return new MockSpreadsheet(name);
  },
  
  getActiveSpreadsheet() {
    if (!this._active) {
      this._active = new MockSpreadsheet('Active Spreadsheet');
    }
    return this._active;
  },
  
  getActive() {
    return this.getActiveSpreadsheet();
  },
  
  openById(id) {
    return new MockSpreadsheet('Opened Spreadsheet');
  },
  
  openByUrl(url) {
    return new MockSpreadsheet('Opened Spreadsheet');
  },
  
  getUi() {
    return {
      createMenu: (name) => ({
        addItem: function() { return this; },
        addSeparator: function() { return this; },
        addSubMenu: function() { return this; },
        addToUi: function() { return this; }
      }),
      alert: (msg) => console.log(`[Alert] ${msg}`),
      prompt: (msg) => ({ getResponseText: () => 'mock-response', getSelectedButton: () => 'OK' }),
      showSidebar: (html) => console.log('[Sidebar shown]'),
      showModalDialog: (html, title) => console.log(`[Modal] ${title}`),
      Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' },
      ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' }
    };
  },
  
  flush() {}
};

// ─────────────────────────────────────────────────────────
// PropertiesService Mock
// ─────────────────────────────────────────────────────────
class MockProperties {
  constructor() {
    this._props = {};
  }
  
  getProperty(key) { return this._props[key] ?? null; }
  setProperty(key, value) { this._props[key] = value; return this; }
  deleteProperty(key) { delete this._props[key]; return this; }
  getProperties() { return { ...this._props }; }
  setProperties(props, deleteAllOthers = false) {
    if (deleteAllOthers) this._props = {};
    Object.assign(this._props, props);
    return this;
  }
  deleteAllProperties() { this._props = {}; return this; }
  getKeys() { return Object.keys(this._props); }
}

const _scriptProps = new MockProperties();
const _userProps = new MockProperties();
const _documentProps = new MockProperties();

const PropertiesService = {
  getScriptProperties() { return _scriptProps; },
  getUserProperties() { return _userProps; },
  getDocumentProperties() { return _documentProps; }
};

// ─────────────────────────────────────────────────────────
// Session Mock
// ─────────────────────────────────────────────────────────
const Session = {
  getActiveUser() {
    return {
      getEmail() { return 'test@example.com'; }
    };
  },
  getEffectiveUser() {
    return {
      getEmail() { return 'test@example.com'; }
    };
  },
  getScriptTimeZone() { return 'Asia/Seoul'; },
  getTemporaryActiveUserKey() { return 'temp-user-key-123'; }
};

// ─────────────────────────────────────────────────────────
// Logger Mock
// ─────────────────────────────────────────────────────────
const Logger = {
  _logs: [],
  log(msg) { 
    this._logs.push(msg);
    console.log('[GAS Logger]', msg); 
  },
  getLog() { return this._logs.join('\n'); },
  clear() { this._logs = []; }
};

// ─────────────────────────────────────────────────────────
// Utilities Mock
// ─────────────────────────────────────────────────────────
const Utilities = {
  formatDate(date, timeZone, format) {
    if (!(date instanceof Date)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    
    return format
      .replace('yyyy', yyyy)
      .replace('MM', MM)
      .replace('dd', dd)
      .replace('HH', HH)
      .replace('mm', mm)
      .replace('ss', ss);
  },
  getUuid() { 
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },
  sleep(ms) { /* no-op in sync context */ },
  base64Encode(data) { return Buffer.from(data).toString('base64'); },
  base64Decode(encoded) { return Buffer.from(encoded, 'base64').toString(); },
  newBlob(data, contentType, name) {
    return {
      getDataAsString: () => data,
      getContentType: () => contentType,
      getName: () => name,
      setName: function(n) { name = n; return this; }
    };
  }
};

// ─────────────────────────────────────────────────────────
// HtmlService Mock
// ─────────────────────────────────────────────────────────
const HtmlService = {
  createHtmlOutput(html) {
    return {
      _html: html,
      getContent: function() { return this._html; },
      setContent: function(h) { this._html = h; return this; },
      setTitle: function() { return this; },
      setWidth: function() { return this; },
      setHeight: function() { return this; },
      append: function(h) { this._html += h; return this; }
    };
  },
  createHtmlOutputFromFile(filename) {
    return this.createHtmlOutput(`<!-- Content from ${filename} -->`);
  },
  createTemplateFromFile(filename) {
    return {
      _data: {},
      evaluate: function() { return HtmlService.createHtmlOutput(`<!-- Template: ${filename} -->`); }
    };
  }
};

// ─────────────────────────────────────────────────────────
// ScriptApp Mock
// ─────────────────────────────────────────────────────────
const ScriptApp = {
  _triggers: [],
  
  getProjectTriggers() { return this._triggers; },
  deleteTrigger(trigger) {
    this._triggers = this._triggers.filter(t => t !== trigger);
  },
  newTrigger(functionName) {
    const trigger = {
      _fn: functionName,
      _type: null,
      timeBased() {
        this._type = 'time';
        return {
          everyMinutes: (n) => ({ create: () => { trigger._interval = n; ScriptApp._triggers.push(trigger); return trigger; } }),
          everyHours: (n) => ({ create: () => { trigger._interval = n * 60; ScriptApp._triggers.push(trigger); return trigger; } }),
          atHour: (h) => ({ nearMinute: (m) => ({ everyDays: (d) => ({ create: () => { ScriptApp._triggers.push(trigger); return trigger; } }) }) }),
          after: (ms) => ({ create: () => { ScriptApp._triggers.push(trigger); return trigger; } })
        };
      },
      forSpreadsheet(ss) {
        this._type = 'spreadsheet';
        return {
          onEdit: () => ({ create: () => { ScriptApp._triggers.push(trigger); return trigger; } }),
          onOpen: () => ({ create: () => { ScriptApp._triggers.push(trigger); return trigger; } }),
          onChange: () => ({ create: () => { ScriptApp._triggers.push(trigger); return trigger; } })
        };
      }
    };
    return trigger;
  },
  getService() {
    return {
      getUrl: () => 'https://script.google.com/macros/s/mock-deployment-id/exec'
    };
  },
  getScriptId() { return 'mock-script-id-123'; },
  AuthMode: { NONE: 'NONE', LIMITED: 'LIMITED', FULL: 'FULL' },
  TriggerSource: { SPREADSHEETS: 'SPREADSHEETS', CLOCK: 'CLOCK' },
  EventType: { ON_EDIT: 'ON_EDIT', ON_OPEN: 'ON_OPEN', ON_CHANGE: 'ON_CHANGE' }
};

// ─────────────────────────────────────────────────────────
// CacheService Mock
// ─────────────────────────────────────────────────────────
class MockCache {
  constructor() {
    this._cache = new Map();
  }
  
  get(key) { 
    const item = this._cache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this._cache.delete(key);
      return null;
    }
    return item.value;
  }
  put(key, value, expirationInSeconds = 600) {
    this._cache.set(key, {
      value,
      expiry: Date.now() + (expirationInSeconds * 1000)
    });
  }
  remove(key) { this._cache.delete(key); }
  getAll(keys) {
    const result = {};
    keys.forEach(k => { result[k] = this.get(k); });
    return result;
  }
  putAll(values, expirationInSeconds = 600) {
    Object.entries(values).forEach(([k, v]) => this.put(k, v, expirationInSeconds));
  }
  removeAll(keys) { keys.forEach(k => this.remove(k)); }
}

const _scriptCache = new MockCache();
const _userCache = new MockCache();
const _documentCache = new MockCache();

const CacheService = {
  getScriptCache() { return _scriptCache; },
  getUserCache() { return _userCache; },
  getDocumentCache() { return _documentCache; }
};

// ─────────────────────────────────────────────────────────
// LockService Mock
// ─────────────────────────────────────────────────────────
class MockLock {
  constructor() {
    this._locked = false;
  }
  
  tryLock(timeoutInMillis) { 
    this._locked = true; 
    return true; 
  }
  waitLock(timeoutInMillis) { 
    this._locked = true; 
  }
  releaseLock() { 
    this._locked = false; 
  }
  hasLock() { 
    return this._locked; 
  }
}

const LockService = {
  getScriptLock() { return new MockLock(); },
  getUserLock() { return new MockLock(); },
  getDocumentLock() { return new MockLock(); }
};

// ─────────────────────────────────────────────────────────
// UrlFetchApp Mock
// ─────────────────────────────────────────────────────────
const UrlFetchApp = {
  fetch(url, options = {}) {
    console.log(`[UrlFetchApp] Fetching: ${url}`);
    return {
      getResponseCode: () => 200,
      getContentText: () => '{"mock": true}',
      getHeaders: () => ({ 'content-type': 'application/json' }),
      getBlob: () => Utilities.newBlob('mock data', 'application/octet-stream', 'mock.dat')
    };
  },
  fetchAll(requests) {
    return requests.map(req => this.fetch(typeof req === 'string' ? req : req.url, req));
  }
};

// ─────────────────────────────────────────────────────────
// ContentService Mock  
// ─────────────────────────────────────────────────────────
const ContentService = {
  MimeType: {
    JSON: 'application/json',
    TEXT: 'text/plain',
    XML: 'application/xml',
    HTML: 'text/html'
  },
  createTextOutput(content) {
    return {
      _content: content,
      _mimeType: 'text/plain',
      setMimeType(type) { this._mimeType = type; return this; },
      getContent() { return this._content; },
      getMimeType() { return this._mimeType; }
    };
  }
};

// ─────────────────────────────────────────────────────────
// GmailApp Mock
// ─────────────────────────────────────────────────────────
const GmailApp = {
  _sent: [],
  sendEmail(recipient, subject, body, options) {
    this._sent.push({ recipient, subject, body, options });
  },
  _reset() { this._sent = []; }
};

// ─────────────────────────────────────────────────────────
// DriveApp Mock
// ─────────────────────────────────────────────────────────
const DriveApp = {
  Access: {
    ANYONE: 'ANYONE',
    ANYONE_WITH_LINK: 'ANYONE_WITH_LINK',
    DOMAIN: 'DOMAIN',
    DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK',
    PRIVATE: 'PRIVATE'
  },
  Permission: {
    VIEW: 'VIEW',
    EDIT: 'EDIT',
    COMMENT: 'COMMENT',
    OWNER: 'OWNER',
    ORGANIZER: 'ORGANIZER',
    NONE: 'NONE'
  },
  getFileById(id) {
    return {
      _id: id,
      getId: function() { return this._id; },
      getName: function() { return 'Mock File'; },
      getUrl: function() { return 'https://docs.google.com/document/d/' + this._id + '/edit'; },
      makeCopy: function(title, folder) {
        return {
          _id: 'copy-' + id,
          getId: function() { return this._id; },
          getUrl: function() { return 'https://docs.google.com/document/d/' + this._id + '/edit'; },
          setSharing: function() { return this; },
          addEditor: function() { return this; }
        };
      },
      setSharing: function() { return this; },
      addEditor: function() { return this; }
    };
  },
  getFolderById(id) {
    return {
      _id: id,
      getId: function() { return this._id; },
      getName: function() { return 'Mock Folder'; }
    };
  }
};

// ─────────────────────────────────────────────────────────
// Calendar Advanced Service Mock
// ─────────────────────────────────────────────────────────
const Calendar = {
  Events: {
    insert: function(event, calendarId, options) {
      return {
        id: 'mock-event-id',
        htmlLink: 'https://calendar.google.com/event?eid=mock',
        conferenceData: {
          entryPoints: [
            { entryPointType: 'video', uri: 'https://meet.google.com/mock-meet-link' }
          ]
        }
      };
    }
  }
};

// ─────────────────────────────────────────────────────────
// Export All Mocks
// ─────────────────────────────────────────────────────────
module.exports = {
  SpreadsheetApp,
  PropertiesService,
  Session,
  Logger,
  Utilities,
  HtmlService,
  ScriptApp,
  CacheService,
  LockService,
  UrlFetchApp,
  ContentService,
  GmailApp,
  DriveApp,
  Calendar,
  // Expose classes for advanced usage
  MockSpreadsheet,
  MockSheet,
  MockRange,
  MockProperties,
  MockCache,
  MockLock
};

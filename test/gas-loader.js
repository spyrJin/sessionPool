const fs = require('fs');
const path = require('path');
const vm = require('vm');
const gasMocks = require('./gas-mocks');

function loadGasCode(files) {
  const context = {
    ...gasMocks,
    console: console,
    Date: Date,
    Math: Math,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    JSON: JSON,
    RegExp: RegExp,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    Buffer: Buffer
  };

  vm.createContext(context);

  files.forEach(file => {
    const filePath = path.join(__dirname, '../gas', file);
    if (fs.existsSync(filePath)) {
      let code = fs.readFileSync(filePath, 'utf8');
      
      code = code.replace(/^const\s+(\w+)\s*=/gm, 'var $1 =');
      code = code.replace(/^let\s+(\w+)\s*=/gm, 'var $1 =');
      
      try {
        vm.runInContext(code, context);
      } catch (e) {
        console.error(`Error loading ${file}:`, e.message);
        throw e;
      }
    } else {
      console.warn(`File not found: ${file}`);
    }
  });

  return context;
}

module.exports = { loadGasCode };

// Folds index.html, style.css and the scripts into one self-contained page
// fragment (no doctype/html/head/body), the form a Claude artifact wants.
// Usage: node tools/build-artifact.js out.html
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const html = read('index.html');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
let body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head.split('\n').filter((l) => /<title>|claude:viewport|fonts\.googleapis/.test(l)).join('\n');
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${read(f).replace(/<\/script/g, '<\\/script')}\n</script>`);
const out = `${keep}\n<style>\n${read('style.css')}</style>\n${body.trim()}\n`;
fs.writeFileSync(process.argv[2], out);
console.log(`${process.argv[2]}: ${(out.length / 1024).toFixed(1)} kB`);

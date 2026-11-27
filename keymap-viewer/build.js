// Genera keymap-viewer/index.html a partir de config/eyelash_sofle.keymap
// y del layout físico de la placa. Uso:  node keymap-viewer/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const keymapSrc = fs.readFileSync(path.join(root, 'config/eyelash_sofle.keymap'), 'utf8');
const layoutSrc = fs.readFileSync(path.join(root, 'boards/arm/eyelash_sofle/eyelash_sofle-layouts.dtsi'), 'utf8');

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// Devuelve el contenido entre llaves del primer bloque "name {"
function block(src, name) {
  const m = new RegExp('\\b' + name + '\\s*\\{').exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  const start = i;
  for (; i < src.length && depth; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
  }
  return src.slice(start, i - 1);
}

// Divide "&kp A &lt 3 F &trans" en ["&kp A", "&lt 3 F", "&trans"]
function bindings(list) {
  const out = [];
  for (const tok of list.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok.startsWith('&') || !out.length) out.push(tok);
    else out[out.length - 1] += ' ' + tok;
  }
  return out;
}

const km = strip(keymapSrc);
const keymap = block(km, 'keymap');
const layers = [];
const layerRe = /(\w+)\s*\{([^{}]*)\}/g;
let m;
while ((m = layerRe.exec(keymap))) {
  const body = m[2];
  const b = /bindings\s*=\s*<([^>]*)>/.exec(body);
  if (!b) continue;
  const name = (/display-name\s*=\s*"([^"]*)"/.exec(body) || [, m[1]])[1];
  const sensor = /sensor-bindings\s*=\s*<([^>]*)>/.exec(body);
  layers.push({ node: m[1], name, bindings: bindings(b[1]), sensor: sensor ? bindings(sensor[1]).join(' ') : null });
}

const combos = [];
const combosBlock = block(km, 'combos');
if (combosBlock) {
  const re = /(\w+)\s*\{([^{}]*)\}/g;
  while ((m = re.exec(combosBlock))) {
    const pos = /key-positions\s*=\s*<([^>]*)>/.exec(m[2]);
    const bnd = /bindings\s*=\s*<([^>]*)>/.exec(m[2]);
    if (pos && bnd) combos.push({ name: m[1], positions: pos[1].trim().split(/\s+/).map(Number), binding: bnd[1].trim() });
  }
}

const conditional = [];
const condBlock = block(km, 'conditional_layers');
if (condBlock) {
  const re = /(\w+)\s*\{([^{}]*)\}/g;
  while ((m = re.exec(condBlock))) {
    const ifl = /if-layers\s*=\s*<([^>]*)>/.exec(m[2]);
    const then = /then-layer\s*=\s*<([^>]*)>/.exec(m[2]);
    if (ifl && then) conditional.push({ ifLayers: ifl[1].trim().split(/\s+/).map(Number), then: Number(then[1].trim()) });
  }
}

const physical = [];
const physRe = /&key_physical_attrs\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)\s+(\(?-?\d+\)?)/g;
const num = (s) => Number(s.replace(/[()]/g, ''));
while ((m = physRe.exec(strip(layoutSrc)))) {
  const [w, h, x, y, rot, rx, ry] = m.slice(1).map(num);
  physical.push({ w, h, x, y, rot, rx, ry });
}

for (const l of layers) {
  if (l.bindings.length !== physical.length) {
    console.warn(`Aviso: la capa ${l.name} tiene ${l.bindings.length} teclas y el layout ${physical.length}`);
  }
}

const data = { layers, physical, combos, conditional, generated: new Date().toISOString().slice(0, 10) };
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log(`OK: ${layers.length} capas, ${physical.length} teclas -> keymap-viewer/index.html`);

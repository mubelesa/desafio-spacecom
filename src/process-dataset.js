import { createReadStream } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { detectEncounters } from './encounters.js';

const HEADER = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
const unquote = value => value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

export function parsePosition(line) {
  const fields = line.split(';');
  if (fields.length !== 7) throw new Error('Esperadas sete colunas separadas por ponto e vírgula.');
  const [rawId, faction, rawTimestamp, rawLat, rawLon, rawProtected, rawRestrictions] = fields;
  const id = Number(rawId), lat = Number(rawLat), lon = Number(rawLon);
  const timestamp = unquote(rawTimestamp);
  const restrictionText = unquote(rawRestrictions);
  const restrictionIds = restrictionText ? restrictionText.split(',') : [];
  const restrictions = new Set(restrictionIds.map(Number));
  if (!INTEGER.test(rawId) || !Number.isSafeInteger(id) || !DECIMAL.test(rawLat) || !DECIMAL.test(rawLon) || !Number.isFinite(lat) || Math.abs(lat) > 90
      || !Number.isFinite(lon) || Math.abs(lon) > 180 || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)
      || !['true', 'false'].includes(rawProtected) || restrictionIds.some(value => !INTEGER.test(value) || !Number.isSafeInteger(Number(value)))) {
    throw new Error('ID, coordenadas, timestamp, booleano ou restrições inválidos.');
  }
  return { id, faction, timestamp, lat, lon, protected: rawProtected === 'true', restrictions };
}

export async function processDataset(input, output) {
  if (resolve(input) === resolve(output)) throw new Error('Entrada e saída devem ser diferentes.');
  const started = performance.now();
  const temporary = `${output}.${randomUUID()}.tmp`;
  const destination = await open(temporary, 'wx');
  let lineNumber = 0, rows = 0, groups = 0, encounters = 0;
  let timestamp = null, positions = [], ids = new Set(), pending = '', buffer = '';
  const emit = encounter => {
    buffer += `${encounters++ ? ',\n' : '\n'}${JSON.stringify(encounter)}`;
  };
  const flushGroup = () => { if (positions.length) { detectEncounters(positions, timestamp, emit); groups++; } };
  const consume = line => {
    lineNumber++;
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (lineNumber === 1) {
      if (line.replace(/^\uFEFF/, '') !== HEADER) throw new Error('Cabeçalho inválido.');
      return;
    }
    if (!line.trim()) return;
    const position = parsePosition(line);
    if (timestamp !== null && position.timestamp < timestamp) throw new Error('Os timestamps devem estar em ordem crescente. Ordene o arquivo antes de processar.');
    if (position.timestamp !== timestamp) {
      flushGroup(); positions = []; ids.clear(); timestamp = position.timestamp;
    }
    if (ids.has(position.id)) throw new Error(`ID ${position.id} repetido no mesmo timestamp.`);
    ids.add(position.id); positions.push(position); rows++;
  };
  try {
    await destination.write('[');
    for await (const chunk of createReadStream(input, { encoding: 'utf8', highWaterMark: 1024 * 1024 })) {
      const text = pending + chunk;
      let start = 0, end;
      while ((end = text.indexOf('\n', start)) !== -1) {
        consume(text.slice(start, end)); start = end + 1;
        if (buffer.length >= 1024 * 1024) { await destination.write(buffer); buffer = ''; }
      }
      pending = text.slice(start);
    }
    if (pending) consume(pending);
    if (!lineNumber) throw new Error('Arquivo vazio.');
    flushGroup();
    await destination.write(`${buffer}${encounters ? '\n' : ''}]\n`);
    await destination.close();
    await rename(temporary, output);
    return { input, output, rows, timestamps: groups, encounters, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    await destination.close().catch(() => {});
    await rm(temporary, { force: true });
    throw new Error(`${input}, linha ${lineNumber}: ${error.message}`, { cause: error });
  }
}

import { createReadStream } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { detectEncounters } from './encounters.js';

const HEADER = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
const unquote = value => value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+(?:\.\d+)?$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const INVALID_COLUMNS = 'Esperadas sete colunas separadas por ponto e vírgula.';
const INVALID_POSITION = 'ID, coordenadas, timestamp, booleano ou restrições inválidos.';

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// O formato já foi conferido por parsePosition. Não cria Date nem converte fusos.
function validateCalendar(timestamp) {
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(5, 7));
  const day = Number(timestamp.slice(8, 10));
  const hour = Number(timestamp.slice(11, 13));
  const minute = Number(timestamp.slice(14, 16));
  const second = Number(timestamp.slice(17, 19));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay = month === 2 && leapYear ? 29 : DAYS_PER_MONTH[month - 1];

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > maximumDay
      || hour > 23 || minute > 59 || second > 59) {
    throw new Error('Data ou horário inválido no timestamp: ' + timestamp);
  }
}

function parseRestrictions(rawRestrictions) {
  const text = unquote(rawRestrictions);
  // A ausência de restrições não precisa de uma coleção por posição.
  if (text === '') return null;

  const restrictions = new Set();
  for (const rawId of text.split(',')) {
    const id = Number(rawId);
    if (!INTEGER.test(rawId) || !Number.isSafeInteger(id)) {
      throw new Error(INVALID_POSITION);
    }
    restrictions.add(id);
  }
  return restrictions;
}

function findSeparator(line, start) {
  const separator = line.indexOf(';', start);
  if (separator === -1) throw new Error(INVALID_COLUMNS);
  return separator;
}

export function parsePosition(line) {
  // Localiza as seis divisões sem criar um array de campos por posição.
  const idEnd = findSeparator(line, 0);
  const factionEnd = findSeparator(line, idEnd + 1);
  const timestampEnd = findSeparator(line, factionEnd + 1);
  const latitudeEnd = findSeparator(line, timestampEnd + 1);
  const longitudeEnd = findSeparator(line, latitudeEnd + 1);
  const protectedEnd = findSeparator(line, longitudeEnd + 1);
  if (line.indexOf(';', protectedEnd + 1) !== -1) {
    throw new Error(INVALID_COLUMNS);
  }

  const rawId = line.slice(0, idEnd);
  const faction = line.slice(idEnd + 1, factionEnd);
  const rawTimestamp = line.slice(factionEnd + 1, timestampEnd);
  const rawLat = line.slice(timestampEnd + 1, latitudeEnd);
  const rawLon = line.slice(latitudeEnd + 1, longitudeEnd);
  const rawProtected = line.slice(longitudeEnd + 1, protectedEnd);
  const rawRestrictions = line.slice(protectedEnd + 1);
  const id = Number(rawId), lat = Number(rawLat), lon = Number(rawLon);
  const timestamp = unquote(rawTimestamp);
  if (
    !INTEGER.test(rawId) || !Number.isSafeInteger(id)
    || !DECIMAL.test(rawLat) || !DECIMAL.test(rawLon)
    || !Number.isFinite(lat) || Math.abs(lat) > 90
    || !Number.isFinite(lon) || Math.abs(lon) > 180
    || !TIMESTAMP.test(timestamp)
    || (rawProtected !== 'true' && rawProtected !== 'false')
  ) {
    throw new Error(INVALID_POSITION);
  }
  const restrictions = parseRestrictions(rawRestrictions);
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
      validateCalendar(position.timestamp);
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

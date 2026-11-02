// Define testes com o executor nativo do Node.js.
import { test } from 'node:test';
// Fornece comparações e verificações de erros esperados.
import assert from 'node:assert/strict';
// Cria, lê e remove arquivos temporários usados pelos testes.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
// Obtém a pasta temporária do sistema.
import { tmpdir } from 'node:os';
// Monta caminhos independentes do separador do sistema.
import { join } from 'node:path';
// Importa as regras geográficas que serão verificadas.
import { detectEncounters, haversine, EARTH_RADIUS } from '../src/encounters.js';
// Importa a leitura e interpretação das posições.
import { processDataset, parsePosition } from '../src/process-dataset.js';

// Cria uma posição de teste com padrões e campos opcionais.
const position = (id, lat = 0, lon = 0, extra = {}) => ({ id, lat, lon, faction: '', protected: false, restrictions: new Set(), ...extra });
// Executa a detecção e reúne os encontros em um array de teste.
const detect = positions => { const results = []; detectEncounters(positions, '2024-01-01 00:00:00', item => results.push(item)); return results; };

test('parser rejeita campos numéricos vazios disfarçados e restrições incompletas', () => {
  // Linha ou função auxiliar usada para variar o conteúdo da entrada.
  const row = '1;;"2024-01-01 00:00:00";0;0;true;"2,3"';
  assert.deepEqual([...parsePosition(row).restrictions], [2, 3]);
  assert.throws(() => parsePosition(row.replace(';0;0;', '; ;0;')), /inválidos/);
  assert.throws(() => parsePosition(row.replace('"2,3"', '"2,"')), /inválidos/);
  assert.throws(() => parsePosition(row.replace('"2,3"', '"2, ,3"')), /inválidos/);
});

test('tipos exclusivos, restrição em ambas as ordens e facção vazia', () => {
  assert.equal(detect([position(1), position(2)])[0].tipo, 'generico');
  assert.equal(detect([position(1, 0, 0, { faction: '1' }), position(2, 0, 0, { faction: '1' })])[0].tipo, 'faccao');
  // Vítima de teste com suas restrições.
  const victim = position(2, 0, 0, { protected: true, restrictions: new Set([1]) });
  assert.equal(detect([victim, position(1)])[0].tipo, 'protetiva');
  assert.equal(detect([victim, position(3)]).length, 0);
});

test('limite estrito de distância, pares únicos e meridiano de 180 graus', () => {
  // Converte um metro em diferença angular no equador.
  const degree = 180 / Math.PI / EARTH_RADIUS;
  assert.equal(detect([position(1), position(2, 19.999 * degree)]).length, 1);
  assert.equal(detect([position(1), position(2, 20.001 * degree)]).length, 0);
  assert.equal(detect([position(1), position(2), position(3)]).length, 3);
  assert.equal(detect([position(1, 0, 179.99999), position(2, 0, -179.99999)]).length, 1);
  assert.equal(haversine(position(1), position(2)), 0);
});

test('busca por latitude equivale à força bruta em amostra determinística', () => {
  // Semente fixa para repetir os mesmos dados pseudoaleatórios.
  let seed = 42;
  // Gera números pseudoaleatórios de forma reproduzível.
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  // Repete o cenário no equador e perto dos polos.
  for (const baseLatitude of [-89.99, -30, 0, 89.99]) {
    // Cria as posições da amostra determinística.
    const positions = Array.from({ length: 100 }, (_, i) => position(i, baseLatitude + random() * 0.001, random() * 0.001));
    // Guarda os pares encontrados pela busca de força bruta.
    const expected = [];
    // Compara todos os pares para obter a referência do teste.
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      if (haversine(positions[i], positions[j]) < 20) expected.push(`${i},${j}`);
    }
    assert.deepEqual(detect(positions).map(item => item.monitoradosEncontro.join(',')).sort(), expected.sort());
  }
});

test('fluxo separa timestamps, aceita CRLF e rejeita duplicatas e desordem', async () => {
  // Cria uma pasta exclusiva para os arquivos deste teste.
  const directory = await mkdtemp(join(tmpdir(), 'spacecom-'));
  // Caminho da entrada temporária.
  const input = join(directory, 'input.txt'), output = join(directory, 'output.json');
  // Cabeçalho válido usado para montar o arquivo.
  const header = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
  // Linha ou função auxiliar usada para variar o conteúdo da entrada.
  const row = (id, second) => `${id};;"2024-01-01 00:00:${second}";0;0;false;`;
  try {
    await writeFile(input, [header, row(1, '00'), row(2, '05')].join('\r\n'));
    await assert.rejects(processDataset(input, input), /devem ser diferentes/);
    await processDataset(input, output);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), []);
    await writeFile(input, [header, row(1, '00'), row(1, '00')].join('\n'));
    await assert.rejects(processDataset(input, output), /repetido/);
    await writeFile(input, [header, row(1, '05'), row(2, '00')].join('\n'));
    await assert.rejects(processDataset(input, output), /ordem crescente/);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), []);
  // Remove os arquivos de teste mesmo quando alguma verificação falha.
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Haversine reproduz exatamente as distâncias oficiais com diferenças de ponto flutuante', () => {
  assert.equal(haversine(position(10, -14.62732, -36.31859), position(11, -14.62731, -36.31869)), 10.81640474094182);
  assert.equal(haversine(position(12, -7.33193, -65.93130), position(13, -7.33197, -65.93137)), 8.909619516337239);
});


test('parser não cria coleção vazia e preserva restrições preenchidas', () => {
  // Linha ou função auxiliar usada para variar o conteúdo da entrada.
  const row = (protectedValue, restrictions) => '1;;"2024-01-01 00:00:00";0;0;' + protectedValue + ';' + restrictions;
  assert.equal(parsePosition(row('false', '')).restrictions, null);
  // Vítima de teste com suas restrições.
  const victim = parsePosition(row('true', '""'));
  assert.equal(victim.restrictions, null);
  assert.equal(detect([victim, position(2)]).length, 0);
  assert.deepEqual([...parsePosition(row('true', '"2,3,2"')).restrictions], [2, 3]);
  assert.equal(detect([parsePosition(row('true', '"2"')), position(2)])[0].tipo, 'protetiva');
  assert.throws(() => parsePosition(row('false', '"2,"')), /inválidos/);
  assert.throws(() => parsePosition(row('TRUE', '')), /inválidos/);
  assert.throws(() => parsePosition(row('true', '9007199254740992')), /inválidos/);
});


test('parser exige exatamente sete colunas e preserva campos vazios e opcionais', () => {
  // Linha ou função auxiliar usada para variar o conteúdo da entrada.
  const row = '12;;"2024-01-01 00:00:00";-7.33193;-65.93130;true;"13,15"';
  // Posição interpretada cujos campos serão conferidos.
  const parsed = parsePosition(row);
  assert.equal(parsed.id, 12);
  assert.equal(parsed.faction, '');
  assert.equal(parsed.timestamp, '2024-01-01 00:00:00');
  assert.equal(parsed.lat, -7.33193);
  assert.equal(parsed.lon, -65.93130);
  assert.equal(parsed.protected, true);
  assert.deepEqual([...parsed.restrictions], [13, 15]);
  assert.equal(parsePosition('1;2;2024-01-01 00:00:00;0;0;false;').restrictions, null);
  assert.equal(parsePosition('1;2;2024-01-01 00:00:00;0;0;false;').faction, '2');
  // Separa a linha de teste para criar entradas com colunas faltantes.
  const fields = row.split(';');
  // Testa cada quantidade de colunas abaixo das sete exigidas.
  for (let count = 0; count < 7; count++) {
    assert.throws(() => parsePosition(fields.slice(0, count).join(';')), /sete colunas/);
  }
  assert.throws(() => parsePosition(row + ';'), /sete colunas/);
  assert.throws(() => parsePosition(row + ';extra'), /sete colunas/);
  assert.throws(() => parsePosition('1;;2024-01-01 00:00:00;;0;false;'), /inválidos/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processDataset } from '../src/process-dataset.js';

const HEADER = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
const row = (id, timestamp) => id + ';;"' + timestamp + '";0;0;false;';

test('calendário aceita limites válidos e as regras completas de ano bissexto', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spacecom-calendar-'));
  const input = join(directory, 'input.txt');
  const output = join(directory, 'output.json');
  try {
    for (const timestamp of ['0001-01-01 00:00:00', '2000-02-29 23:59:59', '2024-02-29 00:00:00', '2026-04-30 12:30:00', '2026-12-31 23:59:59', '9999-12-31 23:59:59']) {
      await writeFile(input, [HEADER, row(1, timestamp), row(2, timestamp)].join('\n'));
      const metrics = await processDataset(input, output);
      assert.equal(metrics.timestamps, 1);
      assert.equal(metrics.encounters, 1);
      assert.equal(JSON.parse(await readFile(output, 'utf8'))[0].timestamp, timestamp);
    }
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
});

test('calendário rejeita datas e horários impossíveis e preserva a saída anterior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spacecom-calendar-'));
  const input = join(directory, 'input.txt');
  const output = join(directory, 'output.json');
  try {
    await writeFile(output, '[]\n');
    const invalid = ['0000-01-01 00:00:00', '1900-02-29 00:00:00', '2100-02-29 00:00:00', '2026-02-29 00:00:00', '2024-02-30 00:00:00', '2026-04-31 00:00:00', '2026-00-01 00:00:00', '2026-13-01 00:00:00', '2026-01-00 00:00:00', '2026-01-32 00:00:00', '2026-01-01 24:00:00', '2026-01-01 00:60:00', '2026-01-01 00:00:60'];
    for (const timestamp of invalid) {
      await writeFile(input, [HEADER, row(1, timestamp)].join('\n'));
      await assert.rejects(processDataset(input, output), /linha 2: Data ou horário inválido/);
      assert.equal(await readFile(output, 'utf8'), '[]\n');
      assert.equal((await readdir(directory)).some(name => name.endsWith('.tmp')), false);
    }
    await writeFile(input, [HEADER, row(1, '2026-01-01 00:00:00'), row(2, '2026-02-30 00:00:00')].join('\n'));
    await assert.rejects(processDataset(input, output), /linha 3: Data ou horário inválido/);
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); }
});

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { processDataset } from './process-dataset.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Uso: npm start -- [arquivo.txt] [pasta-saida]\nSem argumentos: processa inputs/dataset*.txt e grava em outputs.');
    return;
  }
  if (args.length > 2) throw new Error('Use --help para consultar os argumentos.');
  const outputDirectory = resolve(args[1] ?? 'outputs');
  await mkdir(outputDirectory, { recursive: true });
  const inputs = args[0] ? [resolve(args[0])] : (await readdir('inputs'))
    .filter(name => /^dataset\d+\.txt$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(name => resolve('inputs', name));
  if (!inputs.length) throw new Error('Nenhum dataset encontrado.');
  const metrics = [];
  for (const input of inputs) {
    const output = join(outputDirectory, basename(input, '.txt') + '.json');
    if (resolve(input) === output) throw new Error('Entrada e saída devem ser diferentes.');
    const result = await processDataset(input, output);
    metrics.push(result);
    console.log(`${basename(input)}: ${result.rows} posições, ${result.encounters} encontros, ${result.elapsedMs} ms`);
  }
  await writeFile(join(outputDirectory, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

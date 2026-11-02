// Lista arquivos, cria pastas e grava o resumo da execução.
import { readdir, mkdir, writeFile } from 'node:fs/promises';
// Monta caminhos e extrai nomes de arquivos.
import { resolve, basename, join } from 'node:path';
// Importa o processamento de um arquivo de posições.
import { processDataset } from './process-dataset.js';

// Organiza argumentos, entradas, processamento e métricas.
async function main() {
  // Remove o executável e o script, mantendo os argumentos do usuário.
  const args = process.argv.slice(2);
  // Mostra a ajuda sem processar arquivos.
  if (args.includes('--help')) {
    console.log('Uso: npm start -- [arquivo.txt] [pasta-saida]\nSem argumentos: processa inputs/dataset*.txt e grava em outputs.');
    return;
  }
  // Aceita apenas arquivo de entrada e pasta de saída.
  if (args.length > 2) throw new Error('Use --help para consultar os argumentos.');
  // Usa a pasta informada ou a pasta padrão, com caminho completo.
  const outputDirectory = resolve(args[1] ?? 'outputs');
  // Garante que a pasta de saída exista.
  await mkdir(outputDirectory, { recursive: true });
  // Usa o arquivo informado ou lista os nomes na pasta inputs.
  const inputs = args[0] ? [resolve(args[0])] : (await readdir('inputs'))
    // Seleciona dataset seguido de dígitos e ordena os nomes numericamente.
    .filter(name => /^dataset\d+\.txt$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    // Converte cada nome encontrado em um caminho completo.
    .map(name => resolve('inputs', name));
  // Interrompe se não houver arquivos para processar.
  if (!inputs.length) throw new Error('Nenhum dataset encontrado.');
  // Acumula as estatísticas retornadas por cada arquivo.
  const metrics = [];
  // Processa um arquivo por vez para limitar memória e concorrência no disco.
  for (const input of inputs) {
    // Define o JSON de saída com o nome do arquivo de entrada.
    const output = join(outputDirectory, basename(input, '.txt') + '.json');
    // Evita substituir o próprio arquivo de entrada.
    if (resolve(input) === output) throw new Error('Entrada e saída devem ser diferentes.');
    // Aguarda o processamento e recebe contagens e tempo.
    const result = await processDataset(input, output);
    // Adiciona as estatísticas ao resumo do lote.
    metrics.push(result);
    // Mostra arquivo, posições, encontros e duração em milissegundos.
    console.log(`${basename(input)}: ${result.rows} posições, ${result.encounters} encontros, ${result.elapsedMs} ms`);
  }
  // Grava as estatísticas do lote em JSON com indentação.
  await writeFile(join(outputDirectory, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
}
// Mostra a falha e define status de saída diferente de zero.
main().catch(error => { console.error(error.message); process.exitCode = 1; });

// Lê os resultados e os gabaritos para comparação.
import { readFile } from 'node:fs/promises';
// Importa verificações que interrompem a execução quando há diferença.
import assert from 'node:assert/strict';

// Monta a chave por horário, IDs ordenados e tipo, sem alterar o par original.
const key = item => `${item.timestamp}|${[...item.monitoradosEncontro].sort((a, b) => a - b).join(',')}|${item.tipo}`;
// Valida os dois datasets com respostas oficiais disponíveis.
for (const number of [1, 2]) {
  // Carrega o resultado produzido pelo programa.
  const actual = JSON.parse(await readFile(`outputs/dataset${number}.json`, 'utf8'));
  // Carrega o gabarito fornecido para o mesmo dataset.
  const expected = JSON.parse(await readFile(`outputs exemplos/respostas${number}.json`, 'utf8'));
  // Indexa cada encontro pela chave para localizar correspondências.
  const indexed = new Map(actual.map(item => [key(item), item]));
  // Detecta registros repetidos com a mesma chave.
  assert.equal(indexed.size, actual.length, 'Encontros duplicados');
  // Confere se a quantidade total corresponde ao gabarito.
  assert.equal(actual.length, expected.length, 'Quantidade diferente');
  // Confere individualmente cada encontro esperado.
  for (const reference of expected) {
    // Procura o encontro correspondente no resultado gerado.
    const match = indexed.get(key(reference));
    // Exige a presença do encontro.
    assert.ok(match, `Encontro ausente: ${key(reference)}`);
    // Exige as mesmas coordenadas para os participantes.
    assert.deepEqual(match.posicoes, reference.posicoes);
    // Compara a distância por igualdade numérica exata, sem tolerância.
    assert.equal(match.distanciaMetros, reference.distanciaMetros, `Distância diferente: ${key(reference)}`);
  }
  // Apresenta a confirmação do dataset validado.
  console.log(`Dataset ${number}: ${actual.length}/${expected.length} encontros corretos, sem extras.`);
}

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const key = item => `${item.timestamp}|${[...item.monitoradosEncontro].sort((a, b) => a - b).join(',')}|${item.tipo}`;
for (const number of [1, 2]) {
  const actual = JSON.parse(await readFile(`outputs/dataset${number}.json`, 'utf8'));
  const expected = JSON.parse(await readFile(`outputs exemplos/respostas${number}.json`, 'utf8'));
  const indexed = new Map(actual.map(item => [key(item), item]));
  assert.equal(indexed.size, actual.length, 'Encontros duplicados');
  assert.equal(actual.length, expected.length, 'Quantidade diferente');
  for (const reference of expected) {
    const match = indexed.get(key(reference));
    assert.ok(match, `Encontro ausente: ${key(reference)}`);
    assert.deepEqual(match.posicoes, reference.posicoes);
    assert.ok(Math.abs(match.distanciaMetros - reference.distanciaMetros) < 1e-7, 'Distância diferente');
  }
  console.log(`Dataset ${number}: ${actual.length}/${expected.length} encontros corretos, sem extras.`);
}

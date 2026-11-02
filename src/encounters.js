// Raio terrestre em metros exigido pelo desafio.
export const EARTH_RADIUS = 6_371_000;
// Distância máxima exclusiva: exatamente 20 metros não é encontro.
export const DISTANCE_LIMIT = 20;
// Fator de conversão de graus para radianos.
const RADIANS = Math.PI / 180;
// Margem apenas no filtro conservador; a decisão final continua estritamente < 20.
// Faixa de latitude que ainda pode conter pares abaixo do limite.
const LATITUDE_WINDOW = DISTANCE_LIMIT / EARTH_RADIUS / RADIANS + 1e-10;

// Calcula em metros a distância esférica entre as posições a e b.
export function haversine(a, b) {
  // Diferença de latitude convertida para radianos.
  const latitudeDelta = (b.lat - a.lat) * Math.PI / 180;
  // Diferença de longitude convertida para radianos.
  const longitudeDelta = (b.lon - a.lon) * Math.PI / 180;
  // Combina senos e cossenos para obter o termo de Haversine.
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(a.lat * RADIANS) * Math.cos(b.lat * RADIANS)
    * Math.sin(longitudeDelta / 2) ** 2;
  // Haversine com arco-seno; mantém a ordem numérica compatível com os exemplos oficiais.
  // Limita o termo a [0, 1] e recupera o ângulo central.
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, value))));
  // Converte o ângulo central em distância pela superfície.
  return EARTH_RADIUS * centralAngle;
}

// Retorna o tipo da relação ou null quando o par não é elegível.
export function classify(a, b) {
  // Consulta as restrições nas duas direções; ?. aceita uma coleção nula.
  if ((a.protected && a.restrictions?.has(b.id)) || (b.protected && b.restrictions?.has(a.id))) return 'protetiva';
  // Vítimas só participam de encontros com seus respectivos agressores.
  if (a.protected || b.protected) return null;
  // Classifica facção somente quando o identificador está preenchido.
  if (a.faction !== '' && a.faction === b.faction) return 'faccao';
  // Os demais pares de usuários de tornozeleira são genéricos.
  return 'generico';
}

// Analisa um grupo do mesmo horário e entrega cada encontro à função emit.
export function detectEncounters(positions, timestamp, emit) {
  // Ordena por latitude e usa o ID como desempate; modifica o array recebido.
  positions.sort((a, b) => a.lat - b.lat || a.id - b.id);
  // Percorre cada posição como primeiro participante.
  for (let i = 0; i < positions.length; i++) {
    // Posição do primeiro participante.
    const a = positions[i];
    // Começa na posição seguinte para não repetir pares nem comparar consigo mesmo.
    for (let j = i + 1; j < positions.length; j++) {
      // Posição do segundo participante.
      const b = positions[j];
      // Encerra a busca quando as próximas latitudes já impossibilitam o encontro.
      if (b.lat - a.lat > LATITUDE_WINDOW) break;
      // Determina a relação entre os participantes antes de calcular a distância.
      const type = classify(a, b);
      // Ignora pares sem relação elegível.
      if (!type) continue;
      // Aplica Haversine aos candidatos restantes.
      const distance = haversine(a, b);
      // Descarta distâncias maiores ou iguais ao limite, sem arredondar.
      if (distance >= DISTANCE_LIMIT) continue;
      // Organiza os participantes por ID para padronizar o resultado.
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      // Entrega tipo, participantes, horário, coordenadas e distância para gravação.
      emit({ tipo: type, monitoradosEncontro: [first.id, second.id], timestamp,
        posicoes: { [first.id]: { lat: first.lat, lon: first.lon }, [second.id]: { lat: second.lat, lon: second.lon } },
        distanciaMetros: distance });
    }
  }
}

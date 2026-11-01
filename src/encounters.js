export const EARTH_RADIUS = 6_371_000;
export const DISTANCE_LIMIT = 20;
const RADIANS = Math.PI / 180;
// Margem apenas no filtro conservador; a decisão final continua estritamente < 20.
const LATITUDE_WINDOW = DISTANCE_LIMIT / EARTH_RADIUS / RADIANS + 1e-10;

export function haversine(a, b) {
  const latitudeDelta = (b.lat - a.lat) * Math.PI / 180;
  const longitudeDelta = (b.lon - a.lon) * Math.PI / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(a.lat * RADIANS) * Math.cos(b.lat * RADIANS)
    * Math.sin(longitudeDelta / 2) ** 2;
  // Haversine com arco-seno; mantém a ordem numérica compatível com os exemplos oficiais.
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, value))));
  return EARTH_RADIUS * centralAngle;
}

export function classify(a, b) {
  if ((a.protected && a.restrictions?.has(b.id)) || (b.protected && b.restrictions?.has(a.id))) return 'protetiva';
  // Vítimas só participam de encontros com seus respectivos agressores.
  if (a.protected || b.protected) return null;
  if (a.faction !== '' && a.faction === b.faction) return 'faccao';
  return 'generico';
}

export function detectEncounters(positions, timestamp, emit) {
  positions.sort((a, b) => a.lat - b.lat || a.id - b.id);
  for (let i = 0; i < positions.length; i++) {
    const a = positions[i];
    for (let j = i + 1; j < positions.length; j++) {
      const b = positions[j];
      if (b.lat - a.lat > LATITUDE_WINDOW) break;
      const type = classify(a, b);
      if (!type) continue;
      const distance = haversine(a, b);
      if (distance >= DISTANCE_LIMIT) continue;
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      emit({ tipo: type, monitoradosEncontro: [first.id, second.id], timestamp,
        posicoes: { [first.id]: { lat: first.lat, lon: first.lon }, [second.id]: { lat: second.lat, lon: second.lon } },
        distanciaMetros: distance });
    }
  }
}

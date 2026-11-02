// Lê o arquivo em blocos, sem carregar todo o dataset.
import { createReadStream } from 'node:fs';
// Abre a saída, finaliza o arquivo e remove temporários em caso de erro.
import { open, rename, rm } from 'node:fs/promises';
// Gera um nome exclusivo para o arquivo temporário.
import { randomUUID } from 'node:crypto';
// Converte caminhos para comparar entrada e saída.
import { resolve } from 'node:path';
// Importa a busca de encontros para cada grupo temporal.
import { detectEncounters } from './encounters.js';

// Cabeçalho obrigatório, com as sete colunas na ordem esperada.
const HEADER = 'idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida';
// Retira aspas externas quando ambas estão presentes.
const unquote = value => value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
// Aceita texto de inteiro com sinal negativo opcional.
const INTEGER = /^-?\d+$/;
// Aceita número decimal com ponto, sem espaços ou notação científica.
const DECIMAL = /^-?\d+(?:\.\d+)?$/;
// Confere o formato fixo de data e horário.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
// Mensagem para quantidade incorreta de colunas.
const INVALID_COLUMNS = 'Esperadas sete colunas separadas por ponto e vírgula.';
// Mensagem para conteúdo inválido em uma posição.
const INVALID_POSITION = 'ID, coordenadas, timestamp, booleano ou restrições inválidos.';

// Quantidade de dias dos meses em um ano não bissexto.
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// O formato já foi conferido por parsePosition. Não cria Date nem converte fusos.
// Valida calendário e horário uma vez por novo timestamp.
function validateCalendar(timestamp) {
  // Ano numérico, com valores aceitos de 1 a 9999.
  const year = Number(timestamp.slice(0, 4));
  // Mês numérico, de 1 a 12.
  const month = Number(timestamp.slice(5, 7));
  // Dia informado no timestamp.
  const day = Number(timestamp.slice(8, 10));
  // Hora informada, de 0 a 23.
  const hour = Number(timestamp.slice(11, 13));
  // Minuto informado, de 0 a 59.
  const minute = Number(timestamp.slice(14, 16));
  // Segundo informado, de 0 a 59.
  const second = Number(timestamp.slice(17, 19));
  // Aplica as regras de divisibilidade por 4, 100 e 400.
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  // Obtém o último dia válido do mês, incluindo fevereiro bissexto.
  const maximumDay = month === 2 && leapYear ? 29 : DAYS_PER_MONTH[month - 1];

  // Rejeita datas impossíveis, ano zero e horários fora dos limites.
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > maximumDay
      || hour > 23 || minute > 59 || second > 59) {
    throw new Error('Data ou horário inválido no timestamp: ' + timestamp);
  }
}

// Converte a lista de IDs em Set; retorna null quando está vazia.
function parseRestrictions(rawRestrictions) {
  // Remove as aspas da lista de restrições.
  const text = unquote(rawRestrictions);
  // A ausência de restrições não precisa de uma coleção por posição.
  if (text === '') return null;

  // Guarda IDs únicos e permite consultas com has.
  const restrictions = new Set();
  // Percorre os IDs separados por vírgula.
  for (const rawId of text.split(',')) {
    // Converte um ID da lista para número.
    const id = Number(rawId);
    // Confere a escrita e a representação segura do ID.
    if (!INTEGER.test(rawId) || !Number.isSafeInteger(id)) {
      throw new Error(INVALID_POSITION);
    }
    // Adiciona o ID validado, sem duplicatas.
    restrictions.add(id);
  }
  // Retorna a coleção preenchida.
  return restrictions;
}

// Localiza o próximo ponto e vírgula a partir de start.
function findSeparator(line, start) {
  // Índice do separador; -1 indica que ele não existe.
  const separator = line.indexOf(';', start);
  // Interrompe se faltar uma das divisões obrigatórias.
  if (separator === -1) throw new Error(INVALID_COLUMNS);
  // Devolve o índice para extrair os campos com slice.
  return separator;
}

// Converte uma linha em posição e valida seus campos.
export function parsePosition(line) {
  // Localiza as seis divisões sem criar um array de campos por posição.
  // Fim do campo ID.
  const idEnd = findSeparator(line, 0);
  // Fim do campo facção.
  const factionEnd = findSeparator(line, idEnd + 1);
  // Fim do campo timestamp.
  const timestampEnd = findSeparator(line, factionEnd + 1);
  // Fim do campo latitude.
  const latitudeEnd = findSeparator(line, timestampEnd + 1);
  // Fim do campo longitude.
  const longitudeEnd = findSeparator(line, latitudeEnd + 1);
  // Fim do campo medida protetiva.
  const protectedEnd = findSeparator(line, longitudeEnd + 1);
  // Rejeita separadores extras depois das sete colunas.
  if (line.indexOf(';', protectedEnd + 1) !== -1) {
    throw new Error(INVALID_COLUMNS);
  }

  // ID ainda em texto.
  const rawId = line.slice(0, idEnd);
  // Identificador textual da facção; pode estar vazio.
  const faction = line.slice(idEnd + 1, factionEnd);
  // Timestamp ainda com possíveis aspas.
  const rawTimestamp = line.slice(factionEnd + 1, timestampEnd);
  // Latitude ainda em texto.
  const rawLat = line.slice(timestampEnd + 1, latitudeEnd);
  // Longitude ainda em texto.
  const rawLon = line.slice(latitudeEnd + 1, longitudeEnd);
  // Booleano ainda em texto.
  const rawProtected = line.slice(longitudeEnd + 1, protectedEnd);
  // Lista de restrições ainda em texto.
  const rawRestrictions = line.slice(protectedEnd + 1);
  // Converte ID, latitude e longitude para números.
  const id = Number(rawId), lat = Number(rawLat), lon = Number(rawLon);
  // Remove as aspas e preserva o horário original, sem conversão de fuso.
  const timestamp = unquote(rawTimestamp);
  // Valida números, coordenadas, formato do timestamp e booleano.
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
  // Interpreta as restrições somente depois de validar os outros campos.
  const restrictions = parseRestrictions(rawRestrictions);
  // Retorna a posição no formato interno usado pela detecção.
  return { id, faction, timestamp, lat, lon, protected: rawProtected === 'true', restrictions };
}

// Lê uma entrada, processa por horário e finaliza um JSON de saída.
export async function processDataset(input, output) {
  // Impede que a saída substitua o arquivo de entrada.
  if (resolve(input) === resolve(output)) throw new Error('Entrada e saída devem ser diferentes.');
  // Marca o início da medição de tempo.
  const started = performance.now();
  // Nome exclusivo da saída provisória.
  const temporary = `${output}.${randomUUID()}.tmp`;
  // Abre o temporário; wx recusa sobrescrever um arquivo já existente.
  const destination = await open(temporary, 'wx');
  // lineNumber: linha em leitura; rows: quantidade de posições válidas.
  // groups: horários processados; encounters: encontros emitidos.
  let lineNumber = 0, rows = 0, groups = 0, encounters = 0;
  // timestamp: horário atual; positions: posições do grupo; ids: IDs já vistos.
  // pending: fragmento de linha; buffer: texto JSON aguardando gravação.
  let timestamp = null, positions = [], ids = new Set(), pending = '', buffer = '';
  // Recebe cada encontro e o acrescenta ao buffer de texto JSON.
  const emit = encounter => {
    // Insere vírgula após o primeiro registro e atualiza a contagem.
    buffer += `${encounters++ ? ',\n' : '\n'}${JSON.stringify(encounter)}`;
  };
  // Detecta os encontros do grupo completo e conta o horário processado.
  const flushGroup = () => { if (positions.length) { detectEncounters(positions, timestamp, emit); groups++; } };
  // Interpreta uma linha e organiza a posição no grupo temporal correto.
  const consume = line => {
    // Atualiza a linha usada nas mensagens de erro.
    lineNumber++;
    // Remove o retorno de carro das quebras de linha do Windows.
    if (line.endsWith('\r')) line = line.slice(0, -1);
    // Trata a primeira linha como cabeçalho.
    if (lineNumber === 1) {
      // Aceita BOM inicial e exige o cabeçalho esperado.
      if (line.replace(/^\uFEFF/, '') !== HEADER) throw new Error('Cabeçalho inválido.');
      return;
    }
    // Ignora linhas vazias.
    if (!line.trim()) return;
    // Converte a linha atual em uma posição validada.
    const position = parsePosition(line);
    // Exige ordem crescente para processar um horário por vez.
    if (timestamp !== null && position.timestamp < timestamp) throw new Error('Os timestamps devem estar em ordem crescente. Ordene o arquivo antes de processar.');
    // Inicia um grupo quando o timestamp muda.
    if (position.timestamp !== timestamp) {
      // Confere a data real antes de aceitar o novo horário.
      validateCalendar(position.timestamp);
      // Processa o grupo anterior e reinicia as estruturas do próximo.
      flushGroup(); positions = []; ids.clear(); timestamp = position.timestamp;
    }
    // Rejeita IDs repetidos no mesmo horário.
    if (ids.has(position.id)) throw new Error(`ID ${position.id} repetido no mesmo timestamp.`);
    // Registra o ID, guarda a posição e incrementa a quantidade lida.
    ids.add(position.id); positions.push(position); rows++;
  };
  // Trata falhas de leitura, detecção, gravação e finalização.
  try {
    // Abre o array JSON de resultados.
    await destination.write('[');
    // Consome blocos de até 1 MiB usando o fluxo de leitura.
    for await (const chunk of createReadStream(input, { encoding: 'utf8', highWaterMark: 1024 * 1024 })) {
      // Une o fragmento anterior ao novo bloco.
      const text = pending + chunk;
      // start marca o início da linha; end recebe o índice da próxima quebra.
      let start = 0, end;
      // Percorre somente as linhas completas do bloco.
      while ((end = text.indexOf('\n', start)) !== -1) {
        // Processa a linha e avança o início para depois da quebra.
        consume(text.slice(start, end)); start = end + 1;
        // Grava o lote pendente e aguarda a escrita antes de continuar.
        if (buffer.length >= 1024 * 1024) { await destination.write(buffer); buffer = ''; }
      }
      // Preserva a linha incompleta para o próximo bloco.
      pending = text.slice(start);
    }
    // Processa a última linha quando não há quebra no fim do arquivo.
    if (pending) consume(pending);
    // Rejeita um arquivo vazio.
    if (!lineNumber) throw new Error('Arquivo vazio.');
    // Processa o último horário, que não foi fechado por outro timestamp.
    flushGroup();
    // Grava o texto restante e fecha o array JSON.
    await destination.write(`${buffer}${encounters ? '\n' : ''}]\n`);
    // Fecha o arquivo antes da renomeação.
    await destination.close();
    // Substitui a saída final somente após o processamento completo.
    await rename(temporary, output);
    // Retorna contagens e tempo total em milissegundos.
    return { input, output, rows, timestamps: groups, encounters, elapsedMs: Math.round(performance.now() - started) };
  // Remove a saída provisória e acrescenta contexto ao erro.
  } catch (error) {
    // Tenta fechar o arquivo sem ocultar a falha original.
    await destination.close().catch(() => {});
    // Apaga apenas o temporário desta execução.
    await rm(temporary, { force: true });
    // Informa arquivo e linha em leitura, preservando a causa do erro.
    throw new Error(`${input}, linha ${lineNumber}: ${error.message}`, { cause: error });
  }
}

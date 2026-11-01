# Spacecom — detecção de encontros

Programa desenvolvido em **JavaScript com Node.js** para identificar encontros entre pessoas a partir de registros de localização. Recebe arquivos de texto e gera arquivos JSON com os participantes, o horário, as coordenadas e a distância de cada encontro.

## O que o programa faz

Compara posições registradas no mesmo instante e identifica distâncias **menores que 20 metros**, classificando cada encontro em um dos tipos:

| Tipo | Quando é registrado |
| --- | --- |
| `generico` | Dois usuários de tornozeleira que não se enquadram nas outras classificações. |
| `faccao` | Dois usuários de tornozeleira com a mesma facção preenchida. |
| `protetiva` | Uma vítima e um agressor indicado na lista de restrições dela. |

Cada par é registrado apenas uma vez por horário. Encontros de facção e de medida protetiva recebem somente seu tipo específico. Uma vítima só participa de encontros com os agressores relacionados às suas restrições.

## Como utilizar

### 1. Preparar o computador

Instale o **Node.js versão 22 ou superior**, caso ainda não esteja instalado. O programa foi verificado com a versão 24.21.0.

O Node.js inclui o comando `npm`, utilizado nas instruções abaixo. Não é necessário instalar bibliotecas adicionais nem executar `npm install`.

Extraia os arquivos do projeto para uma pasta do computador. Abra essa pasta no terminal. No Windows, você pode abrir a pasta no Explorador de Arquivos, digitar `powershell` na barra de endereço e pressionar Enter.

Para conferir se o Node.js está disponível, execute:

```sh
node --version
```

### 2. Colocar os arquivos de entrada na pasta correta

Dentro da pasta do projeto, crie uma pasta chamada `inputs` e coloque nela os arquivos de localização. Para processar todos automaticamente, use nomes como:

```text
inputs/
  dataset1.txt
  dataset2.txt
  dataset3.txt
```

Os arquivos dos datasets não acompanham o projeto nem o ZIP de entrega para manter o tamanho do pacote reduzido e facilitar o download e o compartilhamento. Para executar o programa, adicione esses arquivos separadamente à pasta `inputs`, conforme o exemplo acima. Essa separação reduz o tamanho da distribuição, sem alterar o funcionamento do programa.

### 3. Processar todos os arquivos

No terminal aberto na pasta do projeto, execute:

```sh
npm start
```

O programa processa os arquivos com nomes no padrão `dataset1.txt`, `dataset2.txt` e assim por diante, dentro de `inputs`. Ao terminar cada arquivo, apresenta a quantidade de posições lidas, os encontros encontrados e o tempo de processamento.

### 4. Consultar os resultados

Os resultados ficam na pasta `outputs`, criada automaticamente:

```text
outputs/
  dataset1.json
  dataset2.json
  dataset3.json
  metrics.json
```

Cada arquivo JSON corresponde ao arquivo de entrada de mesmo nome. Você pode abri-lo em um editor de texto. O arquivo `metrics.json` reúne os caminhos dos arquivos, a quantidade de posições, a quantidade de horários distintos, os encontros e o tempo de execução em milissegundos.

Ao executar novamente, os resultados correspondentes são substituídos. O arquivo de métricas descreve apenas os arquivos processados naquela execução.

### Processar apenas um arquivo

Para escolher um arquivo específico, execute:

```sh
npm start -- inputs/dataset1.txt
```

Nesse modo, o arquivo pode ter qualquer nome, desde que siga o formato de entrada.

Para escolher também a pasta dos resultados:

```sh
npm start -- inputs/dataset1.txt meus-resultados
```

Use aspas quando o caminho tiver espaços:

```sh
npm start -- "meus arquivos/localizacoes.txt" "meus resultados"
```

Para consultar um resumo dos comandos:

```sh
npm start -- --help
```

## Formato dos arquivos de entrada

Cada arquivo deve começar com este cabeçalho, com os campos separados por ponto e vírgula:

```text
idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida
```

Cada linha seguinte representa a posição de uma pessoa em um horário:

```text
12;;"2024-01-01 00:00:00";-7.62716;-65.74641;true;"13"
13;;"2024-01-01 00:00:00";-7.62717;-65.74642;false;
```

| Campo | O que informar |
| --- | --- |
| `idMonitorado` | Número inteiro que identifica a pessoa. |
| `faccaoMonitorado` | Identificador da facção, ou campo vazio quando não houver. |
| `timestamp` | Data e horário no formato `YYYY-MM-DD HH:MM:SS`. |
| `latitude` | Latitude entre -90 e 90, usando ponto decimal. |
| `longitude` | Longitude entre -180 e 180, usando ponto decimal. |
| `medidaProtetiva` | `true` para vítima com medida protetiva; `false` para os demais. |
| `idsRestricaoMedida` | IDs dos agressores separados por vírgula, por exemplo `"13,15"`, ou campo vazio. |

As linhas devem estar em ordem de data e horário, do mais antigo para o mais recente. Uma mesma pessoa pode aparecer em vários horários, mas seu ID não pode se repetir no mesmo instante. Os arquivos podem usar quebras de linha do Windows ou do Linux.

O programa valida o calendário e o horário: aceita anos de 0001 a 9999, dias válidos para cada mês (incluindo anos bissextos), horas de 00 a 23 e minutos e segundos de 00 a 59. Essa validação é realizada uma vez quando o timestamp muda; o formato continua sendo conferido em cada linha. O programa compara o horário exatamente como informado, sem conversão de fuso. Posições com cinco segundos de diferença não são comparadas, mesmo que estejam no mesmo local.

## Formato dos resultados

Cada resultado é uma lista de encontros com esta estrutura:

```json
[
  {
    "tipo": "generico",
    "monitoradosEncontro": [4, 6],
    "timestamp": "2024-01-01 00:05:15",
    "posicoes": {
      "4": { "lat": -31.93195, "lon": -40.61438 },
      "6": { "lat": -31.93187, "lon": -40.61435 }
    },
    "distanciaMetros": 9.33522817789823
  }
]
```

- `tipo`: classificação do encontro.
- `monitoradosEncontro`: IDs dos dois participantes, em ordem numérica.
- `timestamp`: data e horário das posições comparadas.
- `posicoes`: coordenadas originais de cada participante.
- `distanciaMetros`: distância calculada, sem arredondamento.

Quando não há encontros, o arquivo contém uma lista vazia: `[]`. Um mesmo par pode aparecer novamente em outro horário.

## Como o processamento foi feito e por quê

1. **Leitura em blocos:** o arquivo é lido aos poucos, em blocos de 1 MiB, para processar arquivos grandes sem mantê-los inteiros na memória.
2. **Validação dos dados:** o programa confere o cabeçalho, os campos, as coordenadas, os IDs, os booleanos e o formato dos horários. Também verifica a ordem temporal e a ausência de IDs repetidos no mesmo instante.
3. **Agrupamento por horário:** apenas as posições de um mesmo instante ficam reunidas para comparação. Isso atende à regra do desafio e reduz o consumo de memória.
4. **Ordenação por latitude:** as posições de cada grupo são ordenadas de sul para norte. Quando a diferença de latitude já impossibilita uma distância menor que 20 metros, os pares seguintes são descartados dessa comparação.
5. **Classificação dos pares:** identifica a relação entre os participantes para escolher um único tipo de encontro.
6. **Cálculo por Haversine:** calcula a distância dos pares candidatos considerando a superfície de uma esfera, com raio terrestre de **6.371.000 metros**. Registra apenas resultados estritamente menores que 20 metros.
7. **Eliminação de duplicatas:** cada posição é comparada apenas com as posições seguintes, evitando registrar o mesmo par nas duas ordens.
8. **Gravação em lotes:** os encontros são escritos aos poucos. O arquivo final só é substituído depois que o processamento termina com sucesso, evitando resultados incompletos em caso de erro na entrada.

A abordagem por latitude foi escolhida por reduzir as comparações e permitir uma implementação simples de conferir. O filtro também funciona perto dos polos e na passagem entre longitudes de 180 e -180 graus. Quando muitas pessoas têm latitudes próximas, mais pares precisam ser examinados; o desempenho depende da distribuição das posições.

Os arquivos são processados um de cada vez para controlar o consumo de memória e o acesso ao disco.

### Redução de alocações na leitura

Posições sem restrições usam `null`, evitando criar um `Set` e arrays vazios para cada linha. Quando há restrições, a função `parseRestrictions` valida e converte cada ID uma única vez e o adiciona diretamente ao `Set`, sem criar um segundo array numérico. A classificação consulta essa coleção somente quando ela existe.

Os sete campos de cada linha são extraídos diretamente com `indexOf` e `slice`, sem criar o array intermediário de `split`. Os limites recebem nomes correspondentes aos campos e a função `findSeparator` rejeita separadores ausentes. Uma verificação final rejeita colunas extras.

A expressão regular do timestamp é reutilizada e os valores booleanos são comparados diretamente, sem um array temporário. Essas mudanças reduzem objetos transitórios e o trabalho de gerenciamento de memória, preservando as validações, a fórmula de Haversine e o formato dos resultados.


## Verificações realizadas

Foram criados testes automatizados para classificação dos encontros, limite de distância, pares únicos, restrições de medidas protetivas, separação de horários e leitura dos arquivos. A busca por latitude também foi comparada com uma busca que verifica todos os pares em amostras determinísticas, incluindo posições próximas dos polos.

Para executar esses testes:

```sh
npm test
```

Os resultados dos datasets 1 e 2 foram comparados com as respostas oficiais: **4 encontros no primeiro e 6 no segundo, sem encontros extras**.

Para repetir essa comparação, coloque `respostas1.json` e `respostas2.json` na pasta `outputs exemplos`, gere os resultados com `npm start` e execute:

```sh
npm run validate
```

Essa verificação compara participantes, tipos, horários, coordenadas e distâncias. As distâncias são comparadas por igualdade numérica exata com os gabaritos, sem tolerância ou arredondamento. A implementação utiliza Haversine com arco-seno e a ordem de conversão para radianos que reproduziu os dez valores oficiais no ambiente testado. Os arquivos de resposta de referência não estão incluídos no ZIP.

## Resultados do processamento

Os tempos abaixo correspondem à execução local registrada em `outputs/metrics.json`, com Node.js 24.21.0:

| Dataset | Posições | Encontros | Tempo |
| --- | ---: | ---: | ---: |
| 1 | 5.000 | 4 | 16 ms |
| 2 | 25.000 | 6 | 33 ms |
| 3 | 100.000 | 10 | 93 ms |
| 4 | 400.020 | 15 | 315 ms |
| 5 | 1.000.000 | 21 | 815 ms |
| 6 | 8.000.000 | 27 | 6.263 ms |
| 7 | 12.000.000 | 35 | 9.294 ms |

Os tempos incluem leitura, processamento e gravação. Representam uma única execução e variam conforme o computador e as condições do disco. Os datasets 3 a 7 foram processados com o mesmo algoritmo, mas não possuem respostas oficiais fornecidas para comparação.

## Mensagens durante a execução

Se o programa identificar um problema nos dados, apresenta o arquivo, a linha em leitura e o motivo da interrupção. Corrija o problema e execute novamente. Os motivos incluem cabeçalho diferente do esperado, campos inválidos, horários fora de ordem e ID repetido no mesmo horário.

Se o comando `node` ou `npm` não for reconhecido, confira a instalação do Node.js e abra novamente o terminal. Se nenhum dataset for encontrado, confira se o terminal está na pasta do projeto e se os arquivos estão dentro de `inputs`, com os nomes esperados.

## Organização do projeto

| Arquivo ou pasta | Finalidade |
| --- | --- |
| `src/encounters.js` | Cálculo de distância, classificação e busca de encontros. |
| `src/process-dataset.js` | Leitura, validação, agrupamento e gravação dos dados. |
| `src/cli.js` | Execução pelo terminal e registro das métricas. |
| `src/validate.js` | Comparação com as duas respostas oficiais. |
| `test/` | Testes automatizados. |
| `inputs/` | Arquivos de localização adicionados pelo usuário. |
| `outputs exemplos/` | Respostas oficiais usadas para conferência. |
| `outputs/` | Resultados e métricas gerados pelo programa. |
| `package.json` | Configuração do projeto e comandos de execução. |

## Ferramenta de apoio ao desenvolvimento

Foi utilizado o Codex como ferramenta de apoio à interpretação dos requisitos, à implementação do código, à elaboração de testes e documentação e à revisão da solução. Os resultados dos dois primeiros datasets foram comparados com as respostas oficiais fornecidas.

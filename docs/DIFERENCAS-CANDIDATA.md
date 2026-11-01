# Diferenças da candidata de desempenho

Comparação com a main de referência 7ddde61. Esta branch não incorpora alterações à main automaticamente.

## Mudanças no código

| Aspecto | Main de referência | Candidata |
| --- | --- | --- |
| Timestamp | Extrai texto em cada posição. | Confirma comprimento e conteúdo, reaproveitando a string anterior quando idêntica. Não reaproveita facção ou restrições por pessoa. |
| Coordenadas | Cria substrings e usa Number e expressão regular. | Valida caracteres e acumula mantissa/escala diretamente no texto, preservando o sinal de zero. Usa Number para campos com mais de 15 dígitos. |
| Leitura | Blocos de 1 MiB. | Blocos de 4 MiB, definidos pela constante READ_BLOCK_SIZE. |
| Testes | Dez testes. | Doze testes, com cobertura adicional para os dois caminhos novos do parser. O comando seleciona os arquivos de teste do projeto explicitamente, sem descobrir testes de pastas locais de experimentos. |

O parâmetro opcional previousTimestamp foi adicionado a parsePosition; chamadas com apenas a linha continuam funcionando. O reaproveitamento não elimina a validação do formato nem a validação de calendário por grupo.

## Regras preservadas

Mesmos tipos de encontro, comparação apenas no timestamp exato, raio de 6.371.000 metros, distância estritamente menor que 20 metros e unicidade por par e horário. A Haversine e sua ordem de operações não foram alteradas. Permanecem as validações de colunas, campos, calendário, duplicatas e ordenação temporal, além da escrita temporária.

A aplicação continua sequencial. Não foram incorporados trabalhadores, filtro adicional de longitude, pré-cálculo de cossenos ou reutilização do array de posições.

## Medição comparativa

Experimento local em Windows, Ryzen 5 5600G, Node.js 24.21.0. Referência e candidata executaram três rodadas completas dos sete datasets, em processos separados por arquivo e com ordem alternada. O tempo medido inclui leitura, processamento e escrita; não inclui inicialização do processo.

| Medida | Referência | Candidata |
| --- | ---: | ---: |
| Soma média dos tempos dos sete datasets | 19.575 ms | 15.101,33 ms |
| Média do dataset 7 | 11.046 ms | 8.275,67 ms |
| Média dos maiores picos residentes de cada rodada | 248,88 MiB | 329,08 MiB |

A redução observada da soma média foi 22,85%, com aumento de memória. As somas variaram de 17.233 a 22.228 ms na referência e de 14.817 a 15.603 ms na candidata. Cache, atividade do sistema e frequência da CPU não foram isolados. São resultados locais, sem garantia de ganho universal ou prova de ótimo global.

Os tempos da tabela do README vêm de uma execução separada desta branch, registrada em outputs/metrics.json. Não devem ser confundidos com as médias deste experimento.

## Verificação e limites

Os sete resultados da candidata foram comparados com a referência, incluindo distâncias, coordenadas e ordem dos encontros. Também foram executados testes unitários, comparação do parser com milhares de linhas e casos geométricos. Essa evidência cobre os dados e casos testados; não é uma garantia de equivalência para qualquer entrada possível. Os últimos cinco datasets não possuem gabaritos oficiais fornecidos.

A leitura numérica manual aumenta a complexidade de manutenção. Seu fallback para campos longos e os testes de gramática, valores extremos e zero negativo devem ser mantidos. O formato decimal aceito continua específico do desafio, sem notação científica.

## Executar

Os requisitos e comandos permanecem iguais aos da main:

```sh
npm test
npm start
npm run validate
```

Os datasets devem estar em inputs. O último comando exige os dois gabaritos em outputs exemplos. Não é necessário instalar dependências externas. Consultar o README para execução de um único arquivo e escolha da pasta de saída.

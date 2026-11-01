# Comparação da extração direta de campos

Experimento local em 01/11/2026 com Node.js v24.21.0. A referência já contém a otimização de restrições vazias; esta comparação mede a mudança de extração dos campos de split para indexOf e slice. A Haversine e o processamento temporal permanecem iguais.

## Método

Cada medição executou um novo processo Node.js, incluindo leitura do dataset, validação, detecção e gravação em arquivo temporário. Foram executadas três rodadas do dataset 7, alternando a ordem das versões na segunda rodada. Não houve limpeza do cache do sistema operacional. Os outputs e métricas existentes do projeto não foram substituídos.

## Dataset 7: 12 milhões de posições

| Parser | Rodada | Tempo (ms) | Pico de memória residente (KiB) |
| --- | ---: | ---: | ---: |
| split | 1 | 15921 | 261116 |
| indexOf | 1 | 11141 | 268152 |
| indexOf | 2 | 10320 | 269724 |
| split | 2 | 13997 | 255916 |
| split | 3 | 13543 | 256052 |
| indexOf | 3 | 10657 | 269552 |

Média com split: **14487.0 ms**. Média com indexOf: **10706.0 ms**. Redução observada de tempo: **26.1%**.

Embora o array intermediário por linha tenha sido removido, o pico de memória residente do processo foi maior com indexOf nestas três medições. Quantidade de alocações transitórias e pico de memória residente são medidas diferentes. O experimento mostra redução de tempo no maior arquivo, não redução garantida do pico de memória.

## Primeira rodada dos sete arquivos

| Dataset | split (ms) | indexOf (ms) |
| --- | ---: | ---: |
| 1 | 17 | 14 |
| 2 | 42 | 35 |
| 3 | 128 | 107 |
| 4 | 469 | 342 |
| 5 | 1088 | 860 |
| 6 | 8826 | 9773 |
| 7 | 15921 | 11141 |

O dataset 6 foi mais lento com indexOf nesta rodada. Portanto, o ganho não foi uniforme entre todos os arquivos. Uma rodada por arquivo não basta para generalizar desempenho; as três repetições do dataset 7 mostram um ganho consistente apenas para o maior arquivo neste ambiente.

## Correção

- Os sete resultados foram comparados entre versões e são idênticos byte a byte, inclusive a serialização de todas as distâncias.
- Os resultados também foram comparados com os JSONs existentes por igualdade numérica e estrutural, sem exigir a ordem dos encontros.
- Uma comparação de 13 mil linhas válidas e inválidas encontrou os mesmos valores ou as mesmas mensagens de erro nos dois parsers.
- O teste permanente adicional cobre colunas ausentes/extras, campos opcionais, valores vazios e extração de coordenadas e restrições.

A implementação preserva sete colunas obrigatórias e todas as validações. O helper findSeparator localiza cada divisão e rejeita divisões ausentes; os índices recebem nomes para manter legibilidade. O parser continua específico do formato do desafio, sem suportar CSV genérico com campos multilinha.

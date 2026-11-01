# Teste da validação de calendário

Comparação local em 01/11/2026, com Node.js v24.21.0, entre o parser otimizado sem e com validação de calendário. Cada execução usou um processo separado, incluindo leitura, processamento e escrita. A ordem das versões foi alternada na segunda rodada do dataset 7. O cache do sistema não foi limpo e não houve perfil para isolar o custo da função.

## Maior arquivo: dataset 7

| Versão | Rodada | Tempo (ms) |
| --- | ---: | ---: |
| semCalendario | 1 | 9409 |
| comCalendario | 1 | 9405 |
| comCalendario | 2 | 9755 |
| semCalendario | 2 | 10352 |
| semCalendario | 3 | 9832 |
| comCalendario | 3 | 9314 |

Média sem calendário: **9864.3 ms**. Média com calendário: **9491.3 ms**.

Não foi observada regressão de tempo neste experimento. A média menor com calendário não demonstra que a validação acelera o programa: as amostras têm variação e são apenas três execuções por versão. O teste não prova custo zero nem garante o mesmo comportamento em outro computador.

## Estratégia e escopo

O formato textual continua verificado em cada linha. A validação numérica de calendário roda na mudança de timestamp, apenas uma vez por grupo. No dataset 7 são 100 mil grupos para 12 milhões de posições. Não usa Date nem conversão de fuso. Aceita anos de 0001 a 9999, dias válidos conforme o mês e ano bissexto, horas de 00 a 23 e minutos/segundos de 00 a 59. Ano zero e segundos intercalares não são aceitos.

A função parsePosition, isoladamente, continua verificando o formato; a nova garantia de calendário faz parte de processDataset. Um timestamp inválido interrompe a leitura e preserva a saída anterior.

## Correção

Os sete datasets foram executados nas duas versões e os resultados correspondentes são idênticos byte a byte, incluindo todas as distâncias. As saídas existentes foram preservadas; os arquivos do experimento ficaram em uma pasta temporária separada.

Os dez grupos de testes passaram. Os testes novos cobrem os limites válidos, anos 1900/2000/2100, fevereiro, meses de 30 dias, componentes fora do intervalo, erro no primeiro e em um novo grupo, preservação da saída anterior e remoção dos temporários.

# Comparação da redução de alocações

Medição local realizada em 01/11/2026, com Node.js v24.21.0, na branch de otimização. Cada execução usou um processo Node.js separado, com leitura, detecção e gravação incluídas no tempo. Os arquivos foram processados sequencialmente; a ordem das versões foi alternada nas repetições do dataset 7. Não houve limpeza do cache do sistema operacional.

## Maior dataset: 12 milhões de posições

| Versão | Execução | Tempo (ms) | Pico de memória residente (KiB) |
| --- | ---: | ---: | ---: |
| Anterior | 1 | 19161 | 270836 |
| Otimizada | 1 | 16514 | 255000 |
| Otimizada | 2 | 15771 | 255096 |
| Anterior | 2 | 17042 | 271840 |
| Anterior | 3 | 16616 | 271640 |
| Otimizada | 3 | 14444 | 254748 |

Tempo médio anterior: **17606.3 ms**. Tempo médio otimizado: **15576.3 ms**. Redução observada: **11.5%**.

O pico de memória residente inclui o processo inteiro; não mede diretamente a quantidade de objetos alocados. Menos alocações não implica redução proporcional da memória residente, pois o gerenciamento de memória do Node.js também influencia essa medida.

## Integridade dos resultados

As duas versões processaram os sete datasets e seus resultados foram comparados por igualdade profunda após a leitura dos JSONs, incluindo todas as casas decimais das distâncias, os campos, a ordem dos encontros e as coordenadas. Todos corresponderam aos outputs da versão anterior. A fórmula de Haversine não foi alterada.

## Escopo e limites

A otimização evita coleções vazias para restrições ausentes, elimina o array intermediário de conversão de restrições preenchidas, reutiliza a expressão regular do timestamp e substitui o array temporário de booleanos por comparações diretas. Os tempos refletem o conjunto dessas mudanças, não uma medição isolada de cada uma.

Três repetições são uma comparação inicial local, não uma garantia de ganho em qualquer computador. Atividade do sistema e cache do disco influenciam os resultados. Os outputs e as métricas de entrega existentes foram preservados; os arquivos gerados pelo experimento ficaram em uma pasta temporária separada.

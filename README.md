# AutoRH

Painel web para importar, cruzar e analisar planilhas de RH e custos, com rastreabilidade e geração de justificativas.

**Contexto:** Ferramenta de apoio.  
**Tecnologias:** HTML, CSS e JavaScript.

## Visão do projeto

O fluxo parte da importação dos arquivos SIGA, relatório e planilha do Drive, apresenta análises e permite gerar justificativas. Os arquivos `teste_*` e `planilha_exemplo.xlsx` fazem parte do material versionado; confirme que os dados são fictícios antes de compartilhar exemplos.

## Executar localmente

Clone o repositório e sirva os arquivos localmente. Com Python instalado:

```bash
git clone https://github.com/GuiPaicheco/AutoRH.git
cd AutoRH
python -m http.server 8000 --bind 127.0.0.1
```

Abra [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html). Preserve as pastas de imagens, estilos e scripts. Recursos externos, quando usados pela página, podem exigir conexão com a internet.

## Estrutura

- `assets/`
- `css/`
- `index.html`
- `js/`
- `manifest.json`
- `planilha_exemplo.xlsx`
- `teste_funcionarios.csv`
- `teste_libre.ods`
- `teste_relatorio.tsv`
- `teste_siga.csv`
- `teste_siga.xlsx`
- `teste_siga_completo.csv`

## Desenvolvimento

O repositório reúne o código e os materiais do projeto. Para avaliar mudanças, consulte o histórico de commits e diferencie recursos implementados de evoluções previstas.

Esta revisão documenta os arquivos disponíveis; não executou testes funcionais nem certificou o funcionamento das integrações.

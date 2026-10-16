# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## 1. Baixar as leis e normas oficiais (Etapa 2.1)

- **O que é:** baixar os textos de planalto.gov.br e normativos.bcb.gov.br para `fontes/` e
  ingerir com `npm run bb -- fonte`.
- **Por que precisa de você:** pelas minhas regras de segurança, eu não baixo arquivos da
  internet sem uma confirmação sua no chat, arquivo por arquivo. Por isso deixei o download
  pronto em um comando, para você rodar.
- **Como fazer (1 passo):** `npm run bb -- baixar-fontes` (baixa só de sites oficiais, grava
  data de consulta e hash em `fontes/LEIAME.json`); depois `npm run bb -- ingerir-fontes`.
- **Recomendação:** rodar assim que voltar; Bancários, Atualidades e Vendas por norma só geram
  depois disso.

## 2. Revisar o glossário de Vendas (Etapa 2.4)

- **O que é:** `docs/fontes-vendas/glossario.md`, escrito a partir das 28 questões oficiais.
- **Por que precisa de você:** é fonte doutrinária escrita por IA (regra A6 e regra 3 do
  `CLAUDE.md`). Vendas por doutrina só gera depois do seu OK.
- **Como fazer:** ler o glossário; se estiver bom, `npm run bb -- liberar-fonte "Glossário de Vendas"`.

## 3. Conta de administrador (Etapa 4)

- **O que é:** criar a sua conta real de login.
- **Por que precisa de você:** o modo autônomo não cria conta com seus dados nem escolhe sua senha.
- **Como fazer:** `npm run bb -- criar-admin <seu-email>` (pede a senha no terminal e migra
  todo o seu progresso atual para essa conta).

# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## 1. Revisar o glossário de Vendas (Etapa 2.4)

- **O que é:** `docs/fontes-vendas/glossario.md`, escrito a partir das 28 questões oficiais.
- **Por que precisa de você:** é fonte doutrinária escrita por IA (regra A6 e regra 3 do
  `CLAUDE.md`). Vendas por doutrina só gera depois do seu OK.
- **Como fazer:** ler o glossário; se estiver bom, `npm run bb -- liberar-fonte "Glossário de Vendas"`.

## 2. Conta de administrador (Etapa 4)

- **O que é:** criar a sua conta real de login.
- **Por que precisa de você:** o modo autônomo não cria conta com seus dados nem escolhe sua senha.
- **Como fazer:** `npm run bb -- criar-admin <seu-email>` (pede a senha no terminal e migra
  todo o seu progresso atual para essa conta).

## 3. Duas questões com figura que repetem a tabela no texto (baixa)

- **O que é:** as 2 primeiras questões geradas com figura (`6ad2141444b319b9b25921e0`, planilha;
  `6ad2255834220f3eb6eea79e`, sistema linear) foram aprovadas com a tabela copiada no enunciado
  ("| Agência | Contas |…"), além da figura desenhada. Conteúdo e gabarito estão certos; só fica feio.
- **Por que precisa de você:** corrigir exige gravar no banco por script, e a checagem de
  permissões do modo autônomo bloqueou essa gravação. As novas já saem limpas (o pipeline tira a cópia).
- **Como fazer:** `npx tsx scripts/limpar-figura-no-texto.ts` mostra o antes/depois;
  `npx tsx scripts/limpar-figura-no-texto.ts --gravar` corrige.
- **Recomendação:** rodar com `--gravar` (só remove o trecho entre o primeiro e o último "|").

---

Resolvido: **baixar leis e normas** — autorizado por você em 17/10/2026, só de sites oficiais
(planalto.gov.br, bcb.gov.br, normativos do CMN/BCB, in.gov.br). Fica na Etapa 2.

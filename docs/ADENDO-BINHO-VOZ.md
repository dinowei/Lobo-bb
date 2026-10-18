# Adendo: Binho (imagens) + voz e chat

**Quando:** só DEPOIS que todo o PROMPT-VIAGEM / PROMPT-RETOMADA estiver concluído (inclusive Etapa 9).
Não muda a ordem do que está sendo feito agora.

## Parte 1: Binho espalhado pelo site

O dono vai gerar 5 poses novas do mascote (com "BINHO" no moletom laranja) e colocar em `web/src/assets/lobos/`. Quando elas existirem:

1. Ícone do app = cabeça do `web/src/assets/lobo.png` atual (que NÃO muda): favicon (16/32/48), apple-touch-icon 180, PWA 192/512 + maskable, theme-color #ff5b1f.
2. Nome visível do app: "Lobo Binho" (manifest short_name "Binho"). NÃO trocar as menções às provas ("BB 2023 — Escriturário") nem ao concurso.
3. Onde cada pose aparece (ajuste ao nome real dos arquivos):
   - lendo livro → painel / "hora de estudar"
   - escrevendo → redação e anotações
   - comemorando → conquistas e subir de nível
   - pensativo → estados vazios e "o Binho está pensando…"
   - acenando → login e boas-vindas
4. Imagens otimizadas (WebP + fallback PNG, tamanhos certos, lazy load), alt text, sem mudar o resto do visual (regra 8).

## Parte 2: "Pergunte ao Binho" + voz da NVIDIA

### Chat (texto e voz)
- Chat na questão (só depois de o aluno responder) e chat por tópico.
- Contexto: questão, gabarito oficial, explicações salvas, regra do banco (portugues.ts / construção) e trechos de fonte via RAG.
- Regras: nunca contradiz gabarito nem explicações conferidas; em lei/norma só responde com trecho da fonte e cita o artigo, senão diz que não sabe; não revela a resposta antes do aluno responder; recusa assunto fora do edital.
- Usa a corrente do TUTOR (regra de família vale). Limite diário por aluno no .env. Se a IA falhar: "O Binho está ocupado, tenta de novo em instantes".

### Voz do Binho (NVIDIA, não a do navegador)
- Falar (TTS): NVIDIA **Magpie TTS Multilingual** em português do Brasil (vozes Diego, Isabela, Louise; confirmar ids no catálogo). Antes de implementar, confirme no catálogo/conta: se o endpoint hospedado é GRATUITO, qual o protocolo (gRPC/Riva ou HTTP) e os limites. Só gratuito; se não houver endpoint grátis, registre em DECISOES-PENDENTES e use a voz do navegador como provisória.
- Integração CONFIRMADA pelo dono na página do modelo (não precisa de Docker nem GPU; a aba
  "Deploy/Linux with Docker" é para hospedar em servidor próprio e NÃO será usada):
  - API HTTP hospedada, mesma chave nvapi- do .env:
    `GET  https://<FUNCTION_ID>.invocation.api.nvcf.nvidia.com/v1/audio/list_voices`
    `POST https://<FUNCTION_ID>.invocation.api.nvcf.nvidia.com/v1/audio/synthesize`
    (multipart: text, language=pt-BR, voice, encoding=LINEAR_PCM, sample_rate_hz=22050)
    Header: `Authorization: Bearer $NVIDIA_API_KEY`.
  - FUNCTION_ID atual: 877104f7-e885-42b9-8de8-f6e4c6303969 → guardar no .env como
    NVIDIA_TTS_FUNCTION_ID (pode mudar; a verificação semanal confere).
  - Pegue os ids exatos das vozes pt-BR no list_voices (ex.: "Magpie-Multilingual.PT-BR.<Nome>").
  - Saída é WAV mono 16-bit: converter para Opus/MP3 (ffmpeg) antes de guardar e servir.
  - O próprio cartão do modelo diz "text normalization is required" → o normalizador de fala
    abaixo é obrigatório. pt-BR é o idioma com mais erro do modelo (CER 3,46%): frases curtas
    (quebrar textos longos em sentenças) melhoram o resultado.
  - Entra na corrente/telemetria como função "voz" (família nvidia), com fila e limite próprios.
- Escolha uma voz padrão do Binho (testar Diego e Isabela com 3 frases de exemplo; deixar o dono escolher em Ajustes).
- Pré-gerar no noturno (para não chamar a NVIDIA de dia): áudio das aulas curtas e das explicações das questões. Guardar o áudio comprimido (Opus/MP3) com cache, ligado ao hash do texto (texto mudou → regera).
- Na hora: só as respostas do chat geram áudio; se a NVIDIA falhar, cai na voz do navegador sem erro.
- Ouvir (STT, você falando): verificar no catálogo da NVIDIA um modelo de reconhecimento de fala grátis com português do Brasil (ex.: Whisper ou ASR do Riva). Se houver, usar; senão, SpeechRecognition do navegador; se nenhum, esconder o 🎤.
- Botão 🔊 em explicações, regras, aulas e respostas do chat; velocidade ajustável; pausar/continuar.
- Modo **"Estudar ouvindo"**: playlist (aulas do dia + explicações das questões erradas) tocando em sequência, funcionando com tela bloqueada quando possível (Media Session API).

### Normalizador de fala (OBRIGATÓRIO antes de qualquer áudio)
A voz da NVIDIA não lê números nem símbolos. NÃO reescreva as explicações salvas: na tela
continua "R$ 5.306,04". Crie uma camada de código que converte o texto SÓ para o áudio:
`shared/fala.ts`, função pura `paraFala(texto) → textoFalado`, sem IA, com testes.
- Dinheiro: "R$ 5.306,04" → "cinco mil, trezentos e seis reais e quatro centavos";
  "R$ 1,00" → "um real"; "R$ 0,50" → "cinquenta centavos".
- Números inteiros e decimais pt-BR: "1.200" → "mil e duzentos"; "1,02" → "um vírgula zero dois".
- Porcentagem: "2%" → "dois por cento"; "2,5% a.m." → "dois vírgula cinco por cento ao mês";
  "a.a." → "ao ano".
- Potência: "1,02³" ou "1,02^3" → "um vírgula zero dois elevado a três".
- Símbolos: "=" igual a; "×"/"*" vezes; "÷"/"/" dividido por (em conta); "+" mais;
  "−" menos; "≥" maior ou igual a; "≤" menor ou igual a.
- Planilha: "=SOMA(A1:A3)" → "soma de A1 até A3"; "C10" → "cê dez".
- Lei: "art. 10" → "artigo dez"; "inciso X" → "inciso dez" (romano → número);
  "§ 2º" → "parágrafo segundo"; "nº 4.595" → "número quatro mil quinhentos e noventa e cinco";
  "Lei 4.595/1964" → "Lei quatro mil quinhentos e noventa e cinco, de mil novecentos e sessenta e quatro".
- Ordinais: "1º" → "primeiro", "2ª" → "segunda".
- Datas e horas: "16/10/2026" → "dezesseis de outubro de dois mil e vinte e seis"; "10h" → "dez horas".
- Alternativas: "letra B", "(C)" → "letra cê".
- Siglas: dicionário editável (`data/siglas-fala.json`): CMN → "cê eme ene", BCB → "bê cê bê",
  CDC → "cê dê cê", LGPD → "éle gê pê dê", PLD/FT → "pê éle dê éfe tê", Pix → "pix",
  XP → "xis pê", SAC → "sac", IOF → "í ó éfe"…
- Use uma biblioteca de número por extenso em pt-BR (ex.: o pacote npm "extenso") ou implemente;
  testes com pelo menos 60 casos, incluindo os acima.
- Os áudios pré-gerados e o chat passam SEMPRE por `paraFala` antes da NVIDIA (e antes da voz do
  navegador também).

### Fechamento
- Telemetria de voz no Admin (chamadas, falhas, cache).
- Servidor e demo. Testes. Commit por parte. DIARIO + RETOMAR AQUI.

// ============================================================
// Questões de EXEMPLO do modo demo (inéditas, escritas para teste da interface).
// No modo servidor elas vêm do banco: provas oficiais + geradas e auditadas por IA.
// ============================================================
import type { Disciplina, Letra } from "../../../shared/tipos";

export interface QuestaoDemo {
  id: string;
  disciplina: Disciplina;
  assunto: string; // precisa bater com data/topicos.json
  dificuldade: number;
  textoBase?: string;
  enunciado: string;
  alternativas: { letra: Letra; texto: string; explicacao: string; pegadinha?: string }[];
  gabarito: Letra;
  explicacaoGeral: string;
  dicaDeProva?: string;
  fontes: { titulo: string; trecho?: string }[];
  traicoeira?: boolean;
}

type Alt = [texto: string, explicacao: string, pegadinha?: string];
let seq = 0;
function q(
  disciplina: Disciplina,
  assunto: string,
  dificuldade: number,
  enunciado: string,
  alts: [Alt, Alt, Alt, Alt, Alt],
  gabarito: Letra,
  explicacaoGeral: string,
  dicaDeProva: string,
  extra: { fontes?: string[]; textoBase?: string; traicoeira?: boolean } = {}
): QuestaoDemo {
  const letras: Letra[] = ["A", "B", "C", "D", "E"];
  const id = ++seq;
  // embaralha a ordem (semente fixa por questão) para o gabarito não viciar numa letra
  let semente = id * 7919 + 17;
  const aleat = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ordem = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) {
    const j = Math.floor(aleat() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  const idxGabarito = letras.indexOf(gabarito);
  return {
    id: `demo-${id}`,
    disciplina,
    assunto,
    dificuldade,
    enunciado,
    textoBase: extra.textoBase,
    alternativas: ordem.map((orig, i) => {
      const [texto, explicacao, pegadinha] = alts[orig];
      return { letra: letras[i], texto, explicacao, pegadinha };
    }),
    gabarito: letras[ordem.indexOf(idxGabarito)],
    explicacaoGeral,
    dicaDeProva,
    fontes: (extra.fontes ?? []).map((titulo) => ({ titulo })),
    traicoeira: extra.traicoeira,
  };
}

const CB = "conhecimentos_bancarios" as const;
const AT = "atualidades_mercado_financeiro" as const;
const MF = "matematica_financeira" as const;
const MT = "matematica" as const;
const PE = "probabilidade_estatistica" as const;
const LP = "lingua_portuguesa" as const;
const LI = "lingua_inglesa" as const;
const IN = "informatica" as const;
const VN = "vendas_negociacao" as const;

export const QUESTOES_DEMO: QuestaoDemo[] = [
  // ---------------- Conhecimentos Bancários ----------------
  q(CB, "Estrutura do Sistema Financeiro Nacional", 2,
    "Um cliente pergunta ao escriturário qual entidade do Sistema Financeiro Nacional formula a política da moeda e do crédito, fixando as diretrizes que depois são executadas pelo Banco Central. Trata-se do(a)",
    [
      ["Banco Central do Brasil", "Errada. O BCB executa e fiscaliza as políticas, mas não é quem as formula: ele cumpre as diretrizes do CMN.", "Confundir quem executa com quem normatiza."],
      ["Conselho Monetário Nacional", "Correta. O CMN é o órgão normativo máximo do SFN e formula a política da moeda e do crédito."],
      ["Comissão de Valores Mobiliários", "Errada. A CVM regula e fiscaliza o mercado de valores mobiliários (ações, debêntures, fundos), não a política monetária.", "Troca de órgão: CVM cuida do mercado de capitais."],
      ["Tesouro Nacional", "Errada. O Tesouro administra a dívida pública e o caixa do governo; não é órgão normativo do SFN.", "Associar política monetária a gasto do governo (isso é política fiscal)."],
      ["Conselho de Controle de Atividades Financeiras", "Errada. O COAF é a unidade de inteligência financeira contra lavagem de dinheiro.", "Nome parecido com 'conselho' induz ao erro."],
    ],
    "B",
    "O SFN tem três camadas: órgãos normativos (CMN, CNSP, CNPC), supervisores (Banco Central, CVM, Susep, Previc) e operadores (bancos, corretoras etc.). O CMN dita as regras e o Banco Central executa e fiscaliza. A banca adora trocar esses papéis.",
    "CMN manda, Bacen faz.",
    { fontes: ["Lei nº 4.595/1964"] }),

  q(CB, "Política monetária e Copom", 3,
    "Em reunião, o Banco Central decide elevar a alíquota do recolhimento compulsório sobre os depósitos à vista. Mantidas as demais condições, o efeito esperado dessa medida é",
    [
      ["aumentar a oferta de crédito, pois os bancos passam a ter mais recursos livres", "Errada. É o contrário: com mais recursos retidos no Banco Central, sobra menos para emprestar.", "Inversão do efeito da medida."],
      ["reduzir a liquidez da economia, diminuindo a capacidade dos bancos de conceder crédito", "Correta. Mais compulsório significa mais dinheiro parado no Banco Central e menos crédito: é uma medida contracionista."],
      ["reduzir automaticamente a meta da taxa Selic", "Errada. A meta da Selic é decidida pelo Copom em reunião própria; não muda automaticamente por causa do compulsório.", "Misturar dois instrumentos diferentes."],
      ["financiar diretamente os gastos do Tesouro Nacional", "Errada. O compulsório é instrumento de política monetária, não fonte de financiamento do governo.", "Confundir política monetária com fiscal."],
      ["estimular o consumo, por elevar a renda disponível das famílias", "Errada. A medida restringe crédito e tende a frear o consumo.", "Raciocínio de política expansionista."],
    ],
    "B",
    "Os instrumentos clássicos de política monetária são o recolhimento compulsório, o redesconto e as operações de mercado aberto. Aumentar compulsório ou redesconto, ou vender títulos, retira dinheiro da economia (política contracionista). O movimento inverso é expansionista.",
    "Compulsório sobe, crédito desce.",
    { fontes: ["Lei nº 4.595/1964"] }),

  q(CB, "Política monetária e Copom", 2,
    "Sobre o Comitê de Política Monetária (Copom), assinale a afirmativa correta.",
    [
      ["Define a meta de inflação que o país deve perseguir.", "Errada. A meta de inflação é fixada pelo CMN; o Copom persegue essa meta.", "Clássica troca de papéis entre CMN e Copom."],
      ["Reúne-se mensalmente para revisar a taxa de câmbio.", "Errada. O Brasil adota câmbio flutuante e o Copom não fixa câmbio.", "Mistura de periodicidade antiga com câmbio."],
      ["Define a meta da taxa Selic e se reúne, em regra, oito vezes por ano.", "Correta. O Copom fixa a meta da Selic em reuniões ordinárias, oito por ano (a cada cerca de 45 dias)."],
      ["É composto pelos ministros que integram o CMN.", "Errada. O Copom é formado pela diretoria colegiada do Banco Central.", "Confundir a composição do CMN com a do Copom."],
      ["Fixa o teto de juros do cheque especial de cada banco.", "Errada. Isso é regra do CMN, não decisão do Copom.", "Atribuir ao Copom qualquer decisão sobre juros."],
    ],
    "C",
    "O CMN define a meta de inflação e o Copom usa a Selic para alcançá-la. A Selic é a taxa básica e influencia todas as outras taxas da economia. Lembre a cadeia: CMN fixa a meta, Copom decide a Selic e o Banco Central opera o mercado para mantê-la.",
    "CMN dá o alvo, Copom mira com a Selic.",
    { fontes: ["Regimento do Copom (BCB)"] }),

  q(CB, "Garantias e Fundo Garantidor de Créditos", 3,
    "Uma cliente tem R$ 400 mil aplicados em CDB de um único banco, que sofre liquidação extrajudicial. Considerando as regras gerais do FGC, ela tem garantido",
    [
      ["o valor integral, pois CDB é aplicação de baixo risco", "Errada. A garantia tem limite por CPF e por instituição; acima dele, a cliente vira credora da massa liquidanda.", "Achar que renda fixa bancária não tem limite de cobertura."],
      ["até R$ 250 mil por CPF, naquela instituição ou conglomerado", "Correta. O FGC cobre até R$ 250 mil por CPF/CNPJ por instituição ou conglomerado, respeitado um teto global por período."],
      ["até R$ 250 mil por conta aberta, podendo multiplicar o limite abrindo várias contas no mesmo banco", "Errada. O limite é por pessoa e instituição, não por conta.", "Achar que várias contas multiplicam a garantia."],
      ["nada, pois CDB não é coberto pelo FGC", "Errada. CDB está entre os produtos cobertos pelo FGC.", "Confundir com debêntures e títulos públicos, que não têm FGC."],
      ["até R$ 1 milhão, por ser aplicação única", "Errada. R$ 1 milhão é o teto global por CPF a cada 4 anos, somando instituições diferentes, não o limite por instituição.", "Trocar o teto global pelo limite por instituição."],
    ],
    "B",
    "O FGC é uma entidade privada que protege depositantes e investidores de produtos como poupança, conta corrente, CDB, LCI e LCA. A cobertura é de até R$ 250 mil por CPF/CNPJ por instituição ou conglomerado, com teto global de R$ 1 milhão renovado a cada quatro anos. Títulos públicos, debêntures, ações e fundos não entram.",
    "250 por banco, 1 milhão em 4 anos.",
    { fontes: ["Estatuto e Regulamento do FGC"] }),

  q(CB, "Garantias e Fundo Garantidor de Créditos", 3,
    "Na alienação fiduciária em garantia, usada no financiamento de veículos,",
    [
      ["o credor recebe a posse do bem até a quitação da dívida", "Errada. Quem recebe a posse do bem é o credor no penhor (em regra), não na alienação fiduciária.", "Confundir com penhor."],
      ["o devedor transfere ao credor a propriedade resolúvel do bem, mantendo consigo a posse direta", "Correta. O credor fica com a propriedade resolúvel e o devedor continua usando o bem; quitada a dívida, a propriedade volta ao devedor."],
      ["a garantia é pessoal, baseada na assinatura de um terceiro", "Errada. Garantia pessoal é aval ou fiança; a alienação fiduciária é real, recai sobre o bem.", "Misturar garantia real com pessoal."],
      ["só pode recair sobre bens imóveis", "Errada. Recai sobre móveis (como veículos) e também sobre imóveis.", "Confundir com hipoteca."],
      ["o bem continua de propriedade plena do devedor, sem qualquer restrição", "Errada. A propriedade fica com o credor até a quitação; por isso o veículo financiado tem gravame.", "Ignorar o gravame."],
    ],
    "B",
    "Garantias reais recaem sobre bens (penhor, hipoteca, alienação fiduciária); garantias pessoais recaem sobre uma pessoa (aval, fiança). Na alienação fiduciária, a propriedade vai para o credor e a posse fica com o devedor. Por isso o banco retoma o bem mais rápido em caso de calote.",
    "Fiduciária: o banco é dono, você é usuário.",
    { fontes: ["Código Civil — propriedade fiduciária"] }),

  q(CB, "Pix e arranjos de pagamento", 2,
    "Um cliente ainda desconfiado pergunta como o Pix funciona. Está correto afirmar que o Pix",
    [
      ["funciona apenas em dias úteis, no horário bancário", "Errada. O Pix opera 24 horas, todos os dias, inclusive fins de semana e feriados.", "Confundir com transferências tradicionais, que seguem a grade de horário dos bancos."],
      ["foi criado e é administrado pela Febraban", "Errada. O Pix foi instituído e é gerido pelo Banco Central do Brasil.", "Atribuir à associação de bancos o papel do regulador."],
      ["exige que o recebedor tenha chave cadastrada para receber qualquer transferência", "Errada. É possível enviar um Pix usando os dados da conta (agência e conta) ou QR Code.", "Achar que a chave é obrigatória."],
      ["permite pagamentos e transferências instantâneos, 24 horas por dia, todos os dias do ano", "Correta. Essa é a essência do arranjo de pagamentos instantâneos criado pelo Banco Central."],
      ["sempre gera tarifa para a pessoa física que envia o dinheiro", "Errada. Em regra, pessoas físicas não pagam para enviar Pix.", "Generalizar a cobrança que pode existir para empresas."],
    ],
    "D",
    "O Pix é o arranjo de pagamentos instantâneos do Banco Central: liquidação em segundos, 24/7, por chave, QR Code ou dados da conta. Como as regras do Pix mudam com frequência (limites, MED, Pix Automático), na prova vale sempre a norma mais recente.",
    "Pix = Banco Central + instantâneo + 24/7.",
    { fontes: ["Regulamento do Pix (BCB)"] }),

  q(CB, "Prevenção à lavagem de dinheiro e ao financiamento do terrorismo", 2,
    "A doutrina divide o crime de lavagem de dinheiro em três etapas. A sequência correta é",
    [
      ["ocultação, colocação e integração", "Errada. A ocultação vem depois da colocação: primeiro o dinheiro entra no sistema.", "Inverter as duas primeiras etapas."],
      ["colocação, ocultação e integração", "Correta. Colocação: o dinheiro entra no sistema. Ocultação: é movimentado para apagar a origem. Integração: volta com aparência lícita."],
      ["integração, colocação e ocultação", "Errada. A integração é a última etapa, quando o dinheiro já parece limpo.", "Começar pela etapa final."],
      ["colocação, integração e ocultação", "Errada. Não se integra o dinheiro antes de ocultar sua origem.", "Trocar as duas últimas."],
      ["simulação, dissimulação e conversão", "Errada. São termos soltos; as etapas consagradas são colocação, ocultação e integração.", "Termos parecidos com o vocabulário do tema."],
    ],
    "B",
    "Na colocação, o dinheiro sujo entra na economia (depósitos fracionados, compra de bens). Na ocultação (ou estratificação), é movimentado em várias operações para dificultar o rastreio. Na integração, retorna formalmente limpo (empresas, imóveis). O banco atua sobretudo na prevenção da colocação, comunicando operações suspeitas ao COAF.",
    "C-O-I: coloca, oculta, integra.",
    { fontes: ["Lei nº 9.613/1998"] }),

  q(CB, "Títulos públicos e Tesouro Direto", 2,
    "Um investidor conservador quer um título público com menor oscilação caso precise vender antes do vencimento. O título mais adequado é o",
    [
      ["Tesouro Prefixado, porque a taxa já é conhecida na compra", "Errada. O prefixado oscila bastante na venda antecipada quando os juros de mercado mudam.", "Achar que taxa conhecida significa preço estável."],
      ["Tesouro IPCA+, porque protege contra a inflação", "Errada. Protege o poder de compra no vencimento, mas a parte prefixada oscila na marcação a mercado.", "Confundir proteção contra inflação com baixa volatilidade."],
      ["Tesouro Selic, porque sua rentabilidade acompanha a taxa básica de juros", "Correta. É pós-fixado à Selic e tem a menor volatilidade entre os títulos públicos, indicado para reserva de emergência."],
      ["CDB, porque é um título público garantido pelo Tesouro", "Errada. CDB é título privado emitido por bancos (com garantia do FGC), não título público.", "Confundir título público com título bancário."],
      ["Tesouro Prefixado com juros semestrais, porque paga cupons", "Errada. Os cupons não eliminam a oscilação de preço do título prefixado.", "Achar que cupom reduz risco de mercado."],
    ],
    "C",
    "Títulos públicos podem ser pós-fixados (Tesouro Selic), prefixados ou híbridos (IPCA+). Quanto mais longo e prefixado o título, mais seu preço oscila quando os juros mudam. Títulos públicos são garantidos pelo Tesouro Nacional, não pelo FGC.",
    "Reserva de emergência? Tesouro Selic.",
    { fontes: ["Tesouro Direto (Tesouro Nacional)"] }),

  q(CB, "Mercado de capitais e fundos de investimento", 3,
    "Sobre as debêntures, é correto afirmar que",
    [
      ["representam uma fração do capital social da empresa, tornando o investidor sócio", "Errada. Quem representa participação societária é a ação.", "Confundir dívida com participação."],
      ["são títulos de dívida emitidos por sociedades anônimas, que conferem ao investidor direito de crédito contra a emissora", "Correta. Ao comprar uma debênture você empresta dinheiro à empresa, que se compromete a devolver com juros."],
      ["contam com a garantia do FGC até R$ 250 mil", "Errada. Debêntures não têm cobertura do FGC; o risco é de crédito da empresa emissora.", "Estender o FGC a qualquer renda fixa."],
      ["só podem ser emitidas por bancos múltiplos", "Errada. São emitidas por sociedades anônimas não financeiras em geral.", "Confundir com títulos bancários."],
      ["são sempre isentas de imposto de renda para pessoa física", "Errada. A isenção vale para as debêntures incentivadas, não para todas.", "Generalizar a exceção."],
    ],
    "B",
    "Ações dão participação (o investidor vira sócio); debêntures são dívida (o investidor vira credor). Debêntures são reguladas pela CVM, negociadas no mercado de capitais e não têm FGC. As incentivadas, ligadas à infraestrutura, têm isenção de IR para pessoa física.",
    "Ação = sócio. Debênture = credor.",
    { fontes: ["Lei nº 6.404/1976 (S.A.)"] }),

  // ---------------- Atualidades ----------------
  q(AT, "Open Finance", 2,
    "No Open Finance brasileiro, o compartilhamento de dados de um cliente entre instituições",
    [
      ["ocorre automaticamente entre todas as instituições autorizadas", "Errada. Nada é compartilhado sem o pedido expresso do cliente.", "Achar que o sistema é automático."],
      ["depende do consentimento do cliente, que pode revogá-lo a qualquer momento", "Correta. O cliente decide o que compartilhar, com quem, por quanto tempo e pode cancelar quando quiser."],
      ["é restrito aos bancos públicos federais", "Errada. Participam bancos, fintechs e outras instituições autorizadas pelo Banco Central.", "Restringir indevidamente os participantes."],
      ["inclui o compartilhamento de senhas de acesso", "Errada. Senhas nunca são compartilhadas; a autenticação é feita na instituição de origem.", "Confundir compartilhamento de dados com de credenciais."],
      ["é obrigatório para todo correntista", "Errada. A adesão do cliente é voluntária.", "Confundir obrigação das instituições com obrigação do cliente."],
    ],
    "B",
    "Open Finance é o compartilhamento padronizado de dados e serviços financeiros entre instituições autorizadas, sempre com consentimento do cliente. O objetivo é aumentar a concorrência: com seu histórico, outro banco pode oferecer crédito mais barato. O cliente pode revogar o consentimento quando quiser.",
    "Sem consentimento, sem compartilhamento.",
    { fontes: ["Regulamentação do Open Finance (BCB/CMN)"] }),

  q(AT, "Fintechs, bancos digitais, big techs e shadow banking", 3,
    "A Sociedade de Crédito Direto (SCD), modalidade de fintech de crédito regulada pelo Banco Central, caracteriza-se por",
    [
      ["captar depósitos à vista do público para financiar seus empréstimos", "Errada. A SCD não pode captar recursos do público para emprestar.", "Confundir fintech de crédito com banco."],
      ["intermediar empréstimos entre pessoas (peer-to-peer)", "Errada. Isso é a Sociedade de Empréstimo entre Pessoas (SEP).", "Troca entre SCD e SEP."],
      ["realizar operações de crédito por plataforma eletrônica, com recursos próprios", "Correta. A SCD empresta com capital próprio, por meio de plataforma digital."],
      ["operar sem autorização do Banco Central", "Errada. SCD e SEP precisam de autorização do Banco Central.", "Achar que fintech é desregulada."],
      ["atuar exclusivamente com criptoativos", "Errada. A SCD é uma fintech de crédito, sem relação com criptoativos.", "Associar toda fintech a cripto."],
    ],
    "C",
    "As duas fintechs de crédito reguladas pelo Banco Central são a SCD, que empresta com recursos próprios, e a SEP, que conecta quem quer emprestar a quem quer tomar. Nenhuma das duas capta depósitos do público como um banco.",
    "SCD: dinheiro Dela. SEP: entre Pessoas.",
    { fontes: ["Regulamentação de fintechs de crédito (CMN)"] }),

  q(AT, "Criptoativos, blockchain e moeda digital", 2,
    "Uma característica central da tecnologia blockchain é",
    [
      ["ser um banco de dados centralizado, controlado por uma única instituição", "Errada. A blockchain é um registro distribuído entre vários participantes.", "Inverter a característica principal."],
      ["garantir anonimato absoluto de todas as transações", "Errada. Muitas blockchains são públicas e rastreáveis; há pseudonimato, não anonimato absoluto.", "Exagero comum sobre cripto."],
      ["ter sido criada pelo Banco Central do Brasil", "Errada. A tecnologia surgiu com o Bitcoin, em 2008-2009.", "Confundir a tecnologia com projetos de moeda digital."],
      ["manter um registro distribuído de blocos encadeados por criptografia, difícil de alterar retroativamente", "Correta. Cada bloco referencia o anterior, o que torna a adulteração do histórico muito difícil."],
      ["impedir seu uso por instituições financeiras", "Errada. Bancos e reguladores no mundo todo estudam e usam registros distribuídos.", "Achar que cripto e bancos são incompatíveis."],
    ],
    "D",
    "Blockchain é um tipo de tecnologia de registro distribuído (DLT): vários participantes guardam cópias do histórico e os blocos são encadeados por hash. Isso dá transparência e resistência à adulteração. É base de criptoativos, mas também de projetos institucionais.",
    "Blockchain = livro-razão distribuído e encadeado.",
  ),

  // ---------------- Matemática Financeira ----------------
  q(MF, "Juros compostos", 2,
    "Um cliente aplica R$ 10.000,00 a juros compostos de 2% ao mês. Após 3 meses, o montante será",
    [
      ["R$ 10.600,00", "Errada. Esse é o montante a juros simples: 10.000 × (1 + 0,02 × 3).", "Usar juros simples."],
      ["R$ 10.404,00", "Errada. Esse é o montante de 2 meses: 10.000 × 1,02².", "Errar o número de períodos."],
      ["R$ 10.612,08", "Correta. M = 10.000 × 1,02³ = 10.000 × 1,061208 = R$ 10.612,08."],
      ["R$ 10.824,32", "Errada. Esse é o montante de 4 meses: 10.000 × 1,02⁴.", "Somar um período a mais."],
      ["R$ 10.400,00", "Errada. Corresponde a 2 meses de juros simples.", "Juros simples e período errado."],
    ],
    "C",
    "Nos juros compostos, os juros de cada período entram no capital e passam a render também: M = C × (1 + i)ⁿ. Com 1,02³: 1,02 × 1,02 = 1,0404 e 1,0404 × 1,02 = 1,061208.",
    "Compostos: multiplica o fator n vezes.",
  ),

  q(MF, "Taxas de juros", 3,
    "Uma linha de crédito cobra 1% ao mês, capitalizado mensalmente. A taxa anual efetiva equivalente é, aproximadamente,",
    [
      ["12,00%", "Errada. 12% é a taxa proporcional (1% × 12), válida só em juros simples.", "Confundir taxa proporcional com equivalente."],
      ["11,68%", "Errada. Fica abaixo da proporcional, o que não acontece em capitalização composta.", "Chute por arredondamento."],
      ["12,36%", "Errada. Esse valor não corresponde à capitalização mensal de 1% em 12 meses.", "Cálculo incompleto."],
      ["12,68%", "Correta. (1,01)¹² − 1 ≈ 1,1268 − 1 = 12,68% ao ano."],
      ["13,00%", "Errada. Valor superestimado.", "Arredondamento exagerado."],
    ],
    "D",
    "Taxas equivalentes produzem o mesmo montante no mesmo prazo: (1 + i_anual) = (1 + i_mensal)¹². Em juros compostos, a taxa anual equivalente é sempre maior que a proporcional, porque há juros sobre juros.",
    "Equivalente composta > proporcional.",
  ),

  q(MF, "Descontos", 3,
    "Um título de R$ 5.000,00 é descontado 3 meses antes do vencimento, com desconto comercial (por fora) simples a 2% ao mês. O valor líquido recebido é",
    [
      ["R$ 4.700,00", "Correta. D = 5.000 × 0,02 × 3 = 300; valor líquido = 5.000 − 300 = R$ 4.700,00."],
      ["R$ 4.716,98", "Errada. Esse é o desconto racional (por dentro): 5.000 / 1,06.", "Usar desconto racional em vez do comercial."],
      ["R$ 300,00", "Errada. Esse é o valor do desconto, não o valor líquido.", "Responder o desconto."],
      ["R$ 4.711,61", "Errada. Corresponde ao desconto racional composto: 5.000 / 1,02³.", "Aplicar desconto composto."],
      ["R$ 4.900,00", "Errada. Considera apenas 1 mês de desconto.", "Esquecer o prazo."],
    ],
    "A",
    "O desconto comercial (por fora) incide sobre o valor nominal: D = N × i × n. O racional (por dentro) incide sobre o valor atual: A = N / (1 + i × n). O comercial dá desconto maior, por isso é o preferido pelos bancos.",
    "Comercial: juro sobre o valor de face.",
  ),

  q(MF, "Sistemas de amortização", 4,
    "Um financiamento de R$ 120.000,00 será pago em 12 prestações mensais pelo Sistema de Amortização Constante (SAC), com juros de 1% ao mês. O valor da 3ª prestação é",
    [
      ["R$ 11.200,00", "Errada. Essa é a 1ª prestação: 10.000 + 1% de 120.000.", "Calcular a prestação errada."],
      ["R$ 11.100,00", "Errada. Essa é a 2ª prestação: 10.000 + 1% de 110.000.", "Contar um período a menos."],
      ["R$ 11.000,00", "Correta. Amortização = 120.000 / 12 = 10.000. Antes da 3ª, o saldo é 100.000; juros = 1.000; prestação = 11.000."],
      ["R$ 10.661,85", "Errada. Essa é a prestação fixa do sistema Price para os mesmos dados.", "Confundir SAC com Price."],
      ["R$ 10.000,00", "Errada. É só a amortização, sem os juros.", "Esquecer os juros."],
    ],
    "C",
    "No SAC, a amortização é constante (valor ÷ número de parcelas) e os juros incidem sobre o saldo devedor, que cai a cada mês. Por isso as prestações são decrescentes. No Price, as prestações são iguais e a amortização cresce ao longo do tempo.",
    "SAC: amortização fixa, prestação cai.",
  ),

  // ---------------- Matemática ----------------
  q(MT, "Razão, proporção, regra de três e porcentagem", 2,
    "A tarifa de um serviço subiu 25% e, no mês seguinte, teve redução de 20%. Em relação ao valor inicial, o valor final é",
    [
      ["5% maior", "Errada. Não se somam porcentagens sucessivas: +25 − 20 = 5 está errado.", "Somar porcentagens sucessivas."],
      ["igual", "Correta. 1,25 × 0,80 = 1,00: o valor volta exatamente ao inicial."],
      ["5% menor", "Errada. O fator final é 1,00, não 0,95.", "Erro de sinal no fator."],
      ["2,5% maior", "Errada. Não corresponde a nenhum produto de fatores da questão.", "Chute intermediário."],
      ["45% maior", "Errada. Somou as duas taxas em valor absoluto.", "Somar sem considerar o sinal."],
    ],
    "B",
    "Variações percentuais sucessivas se combinam multiplicando os fatores: aumento de p% vira (1 + p) e redução de q% vira (1 − q). Aqui, 1,25 × 0,80 = 1. Na prova, sempre multiplique, nunca some.",
    "Porcentagens sucessivas: multiplica os fatores.",
  ),

  q(MT, "Progressões aritméticas e geométricas", 2,
    "Na progressão aritmética (3, 7, 11, ...), a soma dos 20 primeiros termos é",
    [
      ["79", "Errada. 79 é o 20º termo, não a soma.", "Responder o termo em vez da soma."],
      ["800", "Errada. Não corresponde à fórmula da soma.", "Erro de conta."],
      ["820", "Correta. a₂₀ = 3 + 19 × 4 = 79; S = (3 + 79) × 20 / 2 = 820."],
      ["840", "Errada. Usou a₂₀ = 81, contando 20 razões em vez de 19.", "Usar n em vez de n − 1."],
      ["1.640", "Errada. Esqueceu de dividir por 2.", "Esquecer o /2 da fórmula."],
    ],
    "C",
    "Na PA: aₙ = a₁ + (n − 1) × r e Sₙ = (a₁ + aₙ) × n / 2. O erro mais comum é usar n em vez de n − 1 no termo geral.",
    "Termo geral: n − 1 razões.",
  ),

  // ---------------- Probabilidade e Estatística ----------------
  q(PE, "Medidas de posição", 1,
    "Os tempos de atendimento, em minutos, de sete clientes foram: 2, 4, 4, 5, 7, 9, 10. A mediana desses tempos é",
    [
      ["4", "Errada. 4 é a moda, o valor mais frequente.", "Confundir mediana com moda."],
      ["5", "Correta. Com 7 valores ordenados, a mediana é o 4º: 5."],
      ["5,86", "Errada. É a média: 41 / 7 ≈ 5,86.", "Confundir mediana com média."],
      ["7", "Errada. É o 5º valor da lista ordenada.", "Contar a posição errada."],
      ["4,5", "Errada. Média entre o 3º e o 4º valores; isso só se faria com quantidade par de dados.", "Aplicar a regra de quantidade par."],
    ],
    "B",
    "Média é a soma dividida pela quantidade, mediana é o valor central dos dados ordenados e moda é o valor mais frequente. Com n ímpar, a mediana está na posição (n + 1) / 2; com n par, é a média dos dois centrais.",
    "Mediana: ordena e pega o meio.",
  ),

  q(PE, "Probabilidade", 3,
    "Uma urna tem 3 bolas vermelhas e 2 azuis. Retiram-se 2 bolas, sem reposição. A probabilidade de ambas serem vermelhas é",
    [
      ["3/10", "Correta. (3/5) × (2/4) = 6/20 = 3/10."],
      ["9/25", "Errada. Seria (3/5)², ou seja, com reposição.", "Ignorar o 'sem reposição'."],
      ["3/5", "Errada. É a probabilidade de só a primeira ser vermelha.", "Calcular apenas uma retirada."],
      ["2/5", "Errada. Corresponde a uma bola azul em uma retirada.", "Trocar o evento."],
      ["1/10", "Errada. É a probabilidade de ambas serem azuis: (2/5) × (1/4).", "Calcular o evento oposto."],
    ],
    "A",
    "Sem reposição, a segunda retirada depende da primeira: P(A e B) = P(A) × P(B | A). Depois de tirar uma vermelha, sobram 2 vermelhas em 4 bolas.",
    "Sem reposição: o denominador diminui.",
  ),

  q(PE, "Análise combinatória", 2,
    "Uma agência precisa formar uma comissão de 3 funcionários, escolhidos entre 6. O número de comissões diferentes é",
    [
      ["120", "Errada. É o arranjo A(6,3), que considera a ordem; numa comissão a ordem não importa.", "Usar arranjo em vez de combinação."],
      ["18", "Errada. 6 × 3 não tem significado combinatório aqui.", "Multiplicação ingênua."],
      ["20", "Correta. C(6,3) = 6! / (3! × 3!) = 20."],
      ["216", "Errada. 6³ permitiria repetir a mesma pessoa.", "Permitir repetição."],
      ["720", "Errada. É 6!, que ordena as 6 pessoas.", "Permutar todo o grupo."],
    ],
    "C",
    "Se a ordem importa (presidente, vice, secretário), use arranjo. Se não importa (comissão, grupo), use combinação: C(n,p) = n! / (p! × (n − p)!).",
    "Ordem importa? Arranjo. Não importa? Combinação.",
  ),

  q(PE, "Medidas de dispersão", 3,
    "Todos os saldos de uma carteira de clientes receberam um bônus fixo de R$ 50,00. Em relação aos dados originais,",
    [
      ["a média e o desvio padrão aumentam R$ 50,00", "Errada. O desvio padrão mede o espalhamento, que não muda ao deslocar todos os dados.", "Achar que toda medida muda igual."],
      ["a média aumenta R$ 50,00 e o desvio padrão não se altera", "Correta. Somar uma constante desloca a média e mantém a dispersão."],
      ["a média não se altera e o desvio padrão aumenta", "Errada. É justamente a média que muda.", "Inverter os efeitos."],
      ["a variância aumenta R$ 2.500,00", "Errada. A variância também não se altera ao somar uma constante.", "Elevar a constante ao quadrado."],
      ["o coeficiente de variação não se altera", "Errada. O CV = desvio / média; como a média mudou, o CV muda.", "Esquecer que o CV depende da média."],
    ],
    "B",
    "Somar uma constante k a todos os dados: média + k, desvio e variância iguais. Multiplicar por k: média × k, desvio × |k|, variância × k². Essas propriedades caem muito e poupam contas.",
    "Somou: só a média mexe. Multiplicou: mexe tudo.",
  ),

  // ---------------- Língua Portuguesa ----------------
  q(LP, "Regência verbal e nominal e crase", 2,
    "Assinale a frase em que o acento indicativo de crase está empregado de acordo com a norma-padrão.",
    [
      ["O gerente começou à revisar os contratos.", "Errada. Não há crase antes de verbo.", "Crase antes de verbo."],
      ["Entregamos o relatório à ela ontem.", "Errada. Não há crase antes de pronome pessoal.", "Crase antes de pronome pessoal."],
      ["O cliente referiu-se à proposta enviada pela agência.", "Correta. 'Referir-se a' + 'a proposta' = à."],
      ["Ficaram frente à frente na reunião.", "Errada. Não há crase entre palavras repetidas.", "Expressões com palavras repetidas."],
      ["O pagamento será feito à prazo.", "Errada. 'Prazo' é masculino; não há artigo 'a' para fundir.", "Crase antes de palavra masculina."],
    ],
    "C",
    "Crase é a fusão da preposição 'a' com o artigo feminino 'a'. Só existe quando o termo regente exige a preposição e a palavra seguinte admite o artigo feminino. Por isso nunca há crase antes de verbo, de pronome pessoal, de palavra masculina ou entre palavras repetidas.",
    "Troque por um masculino: se virar 'ao', tem crase.",
  ),

  q(LP, "Concordância verbal e nominal", 2,
    "Está de acordo com a norma-padrão a frase:",
    [
      ["Houveram muitas reclamações na agência.", "Errada. 'Haver' no sentido de existir é impessoal: 'Houve muitas reclamações'.", "Flexionar o haver impessoal."],
      ["Fazem três meses que solicitei o cartão.", "Errada. 'Fazer' indicando tempo é impessoal: 'Faz três meses'.", "Flexionar o fazer de tempo."],
      ["Devem haver soluções para o problema.", "Errada. O auxiliar acompanha o haver impessoal: 'Deve haver soluções'.", "Locução com verbo impessoal."],
      ["Faz dois anos que abri minha conta.", "Correta. 'Fazer' indicando tempo decorrido fica no singular."],
      ["Haviam clientes aguardando na fila.", "Errada. 'Havia clientes', pois o haver de existir é impessoal.", "Flexionar o haver impessoal."],
    ],
    "D",
    "Os verbos 'haver' (com sentido de existir ou de tempo) e 'fazer' (indicando tempo) são impessoais: ficam sempre na 3ª pessoa do singular. Em locução verbal, o auxiliar também fica no singular ('deve haver', 'vai fazer').",
    "Haver = existir? Fica no singular.",
  ),

  q(LP, "Colocação pronominal", 3,
    "Segundo a norma-padrão, a colocação do pronome átono está correta em:",
    [
      ["Me disseram que a agência abriria mais cedo.", "Errada. A norma-padrão não admite pronome átono no início da frase.", "Aceitar o uso coloquial."],
      ["Não informaram-me sobre a mudança.", "Errada. O advérbio de negação atrai o pronome: 'Não me informaram'.", "Ignorar a palavra atrativa."],
      ["Quem avisou-te do prazo?", "Errada. O pronome interrogativo atrai o pronome: 'Quem te avisou?'.", "Ignorar o interrogativo."],
      ["Disseram-me que a agência abriria mais cedo.", "Correta. Sem palavra atrativa e no início da oração, usa-se a ênclise."],
      ["O gerente tinha avisado-me do prazo.", "Errada. Não se usa ênclise ao particípio: 'tinha-me avisado' ou 'me tinha avisado'.", "Ênclise ao particípio."],
    ],
    "D",
    "Palavras negativas, pronomes relativos, interrogativos e indefinidos, advérbios e conjunções subordinativas atraem o pronome para antes do verbo (próclise). Sem atração, usa-se a ênclise, e o pronome nunca abre a frase. O particípio nunca recebe ênclise.",
    "Tem 'não', 'que', 'quem'? Pronome antes do verbo.",
    { traicoeira: true }),

  // ---------------- Língua Inglesa ----------------
  q(LI, "Vocabulário de finanças e tecnologia em inglês", 2,
    "In the sentence \"The bank will eventually replace its old payment system\", the word eventually means",
    [
      ["eventualmente, de vez em quando", "Errada. 'Eventually' é falso cognato; 'de vez em quando' seria 'occasionally'.", "Falso cognato."],
      ["finalmente, com o tempo", "Correta. 'Eventually' significa 'no fim das contas', 'mais cedo ou mais tarde'."],
      ["imediatamente", "Errada. Seria 'immediately'.", "Sentido oposto."],
      ["nunca", "Errada. Seria 'never'.", "Inverter o sentido."],
      ["provavelmente", "Errada. Seria 'probably'.", "Chute pelo contexto."],
    ],
    "B",
    "Falsos cognatos aparecem sempre em prova: 'eventually' (finalmente), 'actually' (na verdade), 'pretend' (fingir), 'push' (empurrar), 'library' (biblioteca). Na dúvida, releia a frase com o sentido que você escolheu e veja se faz sentido.",
    "Eventually = finalmente. Occasionally = eventualmente.",
  ),

  q(LI, "Compreensão de textos em inglês", 2,
    "According to the text, it is correct to say that",
    [
      ["banks share customers' data automatically.", "Errada. O texto diz que o compartilhamento só ocorre com consentimento explícito.", "Ignorar o 'only with'."],
      ["customers can withdraw their consent at any time.", "Correta. 'Consent ... may be withdrawn at any time'."],
      ["critics believe open banking reduces competition.", "Errada. Quem fala de competição são os apoiadores; os críticos falam de riscos cibernéticos.", "Trocar o argumento de cada grupo."],
      ["only banks can receive the shared data.", "Errada. O texto cita 'third-party providers'.", "Ignorar 'third-party'."],
      ["consent, once given, is permanent.", "Errada. O texto diz o contrário.", "Inverter a informação."],
    ],
    "B",
    "Em interpretação de texto em inglês, localize a palavra-chave da alternativa no texto e leia a frase inteira. Atenção a 'however', 'only', 'but': são eles que mudam o sentido.",
    "Ache o trecho exato antes de marcar.",
    { textoBase: "Open banking lets customers share their financial data with authorized third-party providers. However, data can only be shared with the customer's explicit consent, which may be withdrawn at any time. Supporters say it increases competition and leads to cheaper services; critics worry about cybersecurity risks." }),

  // ---------------- Informática ----------------
  q(IN, "Planilhas eletrônicas", 2,
    "Em uma planilha, a célula C1 contém a fórmula =A1*$B$1. Se essa célula for copiada para C3, a fórmula em C3 será",
    [
      ["=A1*$B$1", "Errada. A referência relativa A1 se ajusta ao ser copiada.", "Achar que nada muda na cópia."],
      ["=A3*$B$3", "Errada. $B$1 é absoluta e não muda.", "Ajustar a referência absoluta."],
      ["=A3*$B$1", "Correta. A1 desce duas linhas (vira A3) e $B$1 permanece fixa."],
      ["=A3*B3", "Errada. Os cifrões não somem na cópia.", "Ignorar o $."],
      ["=C3*$B$1", "Errada. A coluna não muda, pois a cópia foi na mesma coluna.", "Deslocar a coluna."],
    ],
    "C",
    "Referência relativa (A1) se ajusta ao copiar; absoluta ($A$1) fica fixa; mista ($A1 ou A$1) fixa só o que tem cifrão. A cópia desloca a referência na mesma distância entre a célula de origem e a de destino.",
    "Cifrão trava, sem cifrão anda.",
  ),

  q(IN, "Segurança da informação", 1,
    "Um cliente recebe um e-mail que imita a identidade visual do banco e pede que ele 'confirme' senha e token em um link. Essa prática é chamada de",
    [
      ["ransomware", "Errada. Ransomware sequestra (criptografa) dados e cobra resgate.", "Confundir tipos de ataque."],
      ["phishing", "Correta. É a 'pescaria' de dados por mensagens falsas que se passam por instituições confiáveis."],
      ["backup", "Errada. Backup é cópia de segurança, uma medida de proteção.", "Termo de segurança sem relação."],
      ["spyware", "Errada. Spyware é um programa que monitora o usuário às escondidas.", "Malware parecido."],
      ["firewall", "Errada. Firewall é um filtro de tráfego de rede, uma medida de proteção.", "Termo de proteção."],
    ],
    "B",
    "Phishing usa engenharia social: a mensagem imita uma fonte confiável para roubar credenciais. Bancos não pedem senha nem token por e-mail ou link. A defesa é desconfiar de urgência, conferir o remetente e acessar sempre pelo app ou site oficial.",
    "Pediu senha por link? É phishing.",
  ),

  q(IN, "Segurança da informação", 2,
    "A autenticação multifator (MFA) aumenta a segurança porque exige",
    [
      ["duas senhas diferentes", "Errada. Duas senhas são o mesmo fator (algo que você sabe).", "Achar que dois itens iguais são dois fatores."],
      ["fatores de categorias diferentes, como algo que você sabe, algo que você tem e algo que você é", "Correta. Ex.: senha + token no celular + biometria."],
      ["que a senha seja trocada todo dia", "Errada. Isso é política de senha, não multifator.", "Confundir conceitos."],
      ["login apenas em computadores da empresa", "Errada. Isso é restrição de dispositivo.", "Medida diferente."],
      ["criptografia do disco rígido", "Errada. Protege dados armazenados, não a autenticação.", "Medida diferente."],
    ],
    "B",
    "Os fatores de autenticação são algo que você sabe (senha, PIN), algo que você tem (token, celular) e algo que você é (biometria). MFA combina categorias diferentes; dois fatores da mesma categoria não contam como multifator.",
    "Multifator = categorias diferentes.",
  ),

  // ---------------- Vendas e Negociação ----------------
  q(VN, "Ética, conduta e direitos do consumidor", 2,
    "Um gerente informa a um cliente que o empréstimo só será liberado se ele também contratar um seguro de vida do banco. Essa conduta",
    [
      ["é legítima, pois o seguro reduz o risco da operação", "Errada. Condicionar um produto à compra de outro é vedado pelo CDC.", "Justificar pela gestão de risco."],
      ["configura venda casada, prática abusiva vedada pelo Código de Defesa do Consumidor", "Correta. Condicionar o fornecimento de um produto ou serviço à aquisição de outro é prática abusiva."],
      ["é permitida desde que o seguro seja barato", "Errada. O preço não torna a prática lícita.", "Relativizar pela vantagem."],
      ["só é proibida para pessoas jurídicas", "Errada. A proteção do CDC alcança o consumidor pessoa física.", "Inverter o alcance da norma."],
      ["é obrigatória em todo empréstimo pessoal", "Errada. Não existe essa obrigação.", "Inventar uma regra."],
    ],
    "B",
    "O CDC proíbe a venda casada: condicionar um produto à compra de outro. O banco pode oferecer o seguro, mas o cliente tem o direito de recusar ou contratar com outra seguradora. Questões de ética em vendas cobram exatamente essa fronteira entre oferecer e impor.",
    "Oferecer pode, condicionar não.",
    { fontes: ["Código de Defesa do Consumidor (Lei nº 8.078/1990)"] }),

  q(VN, "Segmentação de mercado e gestão de carteira", 2,
    "Antes de recomendar um investimento, o funcionário aplica o processo de suitability. O objetivo desse processo é",
    [
      ["oferecer ao cliente o produto mais rentável disponível", "Errada. O mais rentável costuma ser o mais arriscado, e pode não servir para aquele cliente.", "Confundir adequação com rentabilidade."],
      ["verificar se o produto é adequado ao perfil, aos objetivos e à situação financeira do cliente", "Correta. Suitability é a verificação da adequação do produto ao cliente."],
      ["cumprir a meta de vendas da agência", "Errada. É uma obrigação regulatória de proteção ao investidor, não ferramenta de meta.", "Visão comercial distorcida."],
      ["dispensar o cliente de ler os documentos do produto", "Errada. Não substitui a informação ao cliente.", "Achar que o processo dispensa transparência."],
      ["garantir que o cliente não terá prejuízo", "Errada. Nenhum processo garante ausência de perdas.", "Promessa de garantia."],
    ],
    "B",
    "Suitability (dever de verificação da adequação) é exigido pela regulação da CVM: o profissional avalia objetivos, situação financeira e conhecimento do cliente para definir o perfil e só então recomenda. Recomendar produto fora do perfil é infração.",
    "Suitability: o produto tem de servir no cliente.",
    { fontes: ["Regulação da CVM sobre adequação de produtos"] }),

  q(VN, "Técnicas de negociação", 3,
    "Em negociação, o conceito de MAANA (melhor alternativa à negociação de um acordo) refere-se a",
    [
      ["o preço máximo que o comprador aceita pagar", "Errada. Isso é o preço de reserva.", "Confundir com preço de reserva."],
      ["a melhor opção disponível caso o acordo não seja fechado", "Correta. A MAANA é o 'plano B'. Quanto melhor ela for, mais poder de negociação você tem."],
      ["o primeiro valor proposto na negociação", "Errada. Isso é a ancoragem.", "Confundir com ancoragem."],
      ["o acordo em que um lado ganha tudo", "Errada. Isso descreve uma negociação ganha-perde.", "Confundir com resultado da negociação."],
      ["a concessão final feita para fechar o negócio", "Errada. Concessão é um movimento dentro da negociação.", "Termo de processo."],
    ],
    "B",
    "MAANA (em inglês, BATNA) é o que você fará se não houver acordo. Conhecer a sua e estimar a do outro lado define até onde ceder: nunca aceite um acordo pior que sua MAANA.",
    "Sem plano B, sem poder de barganha.",
  ),
];

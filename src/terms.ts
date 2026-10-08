/*
 * TERMOS DE USO e POLÍTICA DE PRIVACIDADE da JM Finance.
 * ⚠️ RASCUNHO — PENDENTE DE REVISÃO JURÍDICA. Texto redigido para ser claro ao usuário;
 * deve ser revisado por advogado(a) antes de uso comercial / publicação nas lojas.
 * Responsável: Jolian Marco Costa de Araújo (pessoa física). Contato: jolian.araujo@icloud.com.
 * Ao mudar qualquer texto com efeito jurídico, aumente TERMS_VERSION: o app pedirá novo aceite.
 * TERMOS.md (raiz do repositório) é gerado a partir deste arquivo: `node scripts/terms-md.mjs`.
 */
export const TERMS_VERSION = '1.0';
export const TERMS_UPDATED = '7 de outubro de 2026';
export const TERMS_DRAFT = true;
export const CONTACT = 'jolian.araujo@icloud.com';
export const CONTROLLER = 'Jolian Marco Costa de Araújo (pessoa física)';

export type Block = { h: string; p?: string[]; ul?: string[] };

export const TERMS: Block[] = [
  { h: '1. O que é a JM Finance', p: ['A JM Finance é um aplicativo gratuito de organização financeira pessoal. Ele ajuda você a registrar renda, gastos, dívidas, bens e objetivos e mostra um diagnóstico, um plano de ação, simulações e relatórios em linguagem simples.', 'É uma ferramenta educativa: serve para você entender melhor a sua situação e enxergar caminhos possíveis.'] },
  { h: '2. Não é aconselhamento profissional', p: ['A JM Finance não presta consultoria financeira, de investimentos, jurídica, contábil ou tributária, e nada no app é recomendação para comprar, vender, contratar ou cancelar qualquer produto financeiro.', 'O app não substitui um profissional habilitado (por exemplo, planejador financeiro certificado, contador ou advogado). Para decisões importantes, procure um.'] },
  { h: '3. A JM Finance não decide por você', p: ['"A JM Finance não decide por você. Nós auxiliamos na sua gestão financeira!" O app mostra números, opções, prós, contras e riscos. A escolha final — e as consequências dela — são sempre suas.'] },
  { h: '4. Os cálculos são estimativas', ul: ['Usamos fórmulas simplificadas: juros compostos mensais com taxas constantes e projeções que supõem que sua renda e seus gastos se mantêm.', 'Os cálculos não incluem impostos (como IOF e Imposto de Renda), tarifas, seguros, multas, encargos de atraso nem o Custo Efetivo Total (CET).', 'Taxas, descontos e condições reais dependem do banco ou credor e podem ser diferentes.', 'Os cálculos podem conter erros. Confira os valores com seu banco ou credor antes de decidir.'] },
  { h: '5. O Consultor JM', p: ['Por enquanto, o Consultor JM é um assistente simulado: as respostas são automáticas, criadas por regras pré-definidas a partir dos números que você cadastrou. Ele não é uma pessoa nem uma inteligência artificial, e as respostas podem não se aplicar ao seu caso.', 'Se no futuro o Consultor passar a usar inteligência artificial ou um servidor externo, avisaremos no app e pediremos um novo aceite antes de enviar qualquer dado.'] },
  { h: '6. Seus dados e suas responsabilidades', ul: ['Você cadastra seus próprios dados e é responsável por eles estarem corretos e atualizados. A qualidade dos resultados depende disso.', 'Não cadastre dados de outras pessoas sem autorização delas.', 'Use o app de forma lícita e de acordo com estes termos.', 'O app é destinado a maiores de 18 anos ou a menores acompanhados pelos responsáveis.'] },
  { h: '7. Disponibilidade e limites', p: ['O app é oferecido gratuitamente, no estado em que se encontra, e pode ficar indisponível, mudar ou ganhar e perder recursos. Como seus dados ficam só no seu aparelho, faça backups com frequência.', 'Na medida permitida pela legislação brasileira, incluindo o Código de Defesa do Consumidor, não nos responsabilizamos por decisões tomadas com base no app nem por perdas de dados causadas pela limpeza do navegador, troca ou perda do aparelho.'] },
  { h: '8. Mudanças nestes termos', p: ['Podemos atualizar estes Termos de Uso e a Política de Privacidade. Quando isso acontecer, avisaremos dentro do app e pediremos que você leia e aceite a nova versão antes de continuar.'] },
  { h: '9. Contato', p: [`Dúvidas, sugestões ou pedidos: ${CONTACT}.`] },
  { h: '10. Lei aplicável e foro', p: ['Estes termos seguem as leis da República Federativa do Brasil. Fica eleito o foro do domicílio do usuário para resolver qualquer questão relacionada a eles, conforme o Código de Defesa do Consumidor.'] },
];

export const PRIVACY: Block[] = [
  { h: '1. Resumo', p: ['Seus dados financeiros ficam só neste aparelho. Não pedimos cadastro, não temos servidor com seus dados e não vemos nada do que você digita.'] },
  { h: '2. Quais dados o app guarda', ul: ['O que você digita: renda, gastos, dívidas, bens, reserva, objetivos, gasto real do mês e o histórico dos meses fechados.', 'Preferências, como o horário dos avisos, e a data em que você aceitou estes termos.', 'As conversas com o Consultor JM, se você usar.', 'Não pedimos nome, CPF, e-mail, telefone, senhas ou acesso à sua conta bancária.'] },
  { h: '3. Onde os dados ficam', p: ['Tudo fica no armazenamento local do navegador deste aparelho (localStorage e cache do app). Os cálculos, o Consultor simulado, os relatórios em PDF e os backups são gerados no próprio aparelho.', 'Nada disso é enviado para servidores nossos ou de terceiros. Não vendemos nem compartilhamos seus dados — nós simplesmente não temos acesso a eles.'] },
  { h: '4. Cookies e rastreamento', p: ['O app não usa cookies, ferramentas de análise (analytics), anúncios, pixels ou qualquer forma de rastreamento. As fontes e imagens vêm do próprio app, sem serviços externos.'] },
  { h: '5. Hospedagem (GitHub Pages)', p: ['O app é hospedado no GitHub Pages, serviço da GitHub, Inc. Como em qualquer site, ao abrir o app seu navegador se conecta aos servidores do GitHub, que podem registrar dados técnicos (como o endereço IP e o tipo de navegador) conforme a política de privacidade do próprio GitHub. Não usamos esses registros para identificar você.'] },
  { h: '6. Notificações', p: ['Se você ativar as notificações, os avisos são criados no próprio aparelho. Hoje não existe servidor de notificações. Se um dia existir, avisaremos e pediremos sua permissão antes de enviar qualquer informação a ele.'] },
  { h: '7. Backups e relatórios', p: ['Os backups (.json) e os relatórios (PDF) são arquivos que você gera e guarda onde quiser. Eles contêm seus dados financeiros sem senha nem criptografia: proteja-os como um documento pessoal. Se você os enviar por e-mail ou para uma nuvem, valem as regras desses serviços.'] },
  { h: '8. Como apagar seus dados', p: ['Você pode apagar tudo a qualquer momento em "Termos e privacidade" › "Apagar todos os dados deste aparelho", ou limpando os dados do site nas configurações do navegador, ou desinstalando o app. Como não guardamos cópia, o que for apagado só pode ser recuperado com um backup seu.'] },
  { h: '9. Seus direitos (LGPD)', p: ['A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você, entre outros, os direitos de confirmação e acesso aos dados, correção, eliminação, portabilidade, informação sobre compartilhamento e revogação do consentimento.', `Como os dados ficam só com você, a maior parte desses direitos pode ser exercida diretamente no app: ver e corrigir em "Meus dados", levar para outro aparelho com "Exportar backup" e apagar tudo quando quiser. Para qualquer pedido ou dúvida, fale com ${CONTACT}. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).`, `Responsável (controlador): ${CONTROLLER}.`] },
  { h: '10. Mudanças nesta política', p: ['Se esta política mudar, avisaremos dentro do app e pediremos um novo aceite.'] },
];

export const ACCEPT_LABEL = 'Li e aceito os Termos de Uso e a Política de Privacidade';
export type TermsAcceptance = { version: string; acceptedAt: string };
export const hasAccepted = (t?: TermsAcceptance) => !!t && t.version === TERMS_VERSION;

# Spec — Chatbot de Triagem Veterinária · ConectaVet

> **O que é este documento:** o plano de trabalho da **lógica do bot** depois que
> a cliente mandou o material novo (a árvore de triagem clínica). Aqui a gente
> **organiza o que fazer, em que ordem e por quê** — ainda **sem escrever código**.
>
> **Escopo (decidido em 2026-06-07):** **só WhatsApp Business** por enquanto. A
> cliente optou por fazer a triagem **no WhatsApp**. O *chat no site* foi cogitado,
> mas está **adiado** (ver §3 — fica como evolução futura, sem trabalho agora).
>
> **Onde a infra está:** a parte de servidor do WhatsApp (Evolution API, Docker,
> Nginx, HTTPS, número conectado) está documentada e em andamento no arquivo
> `../../WHATSAPP_CHATBOT.md` (raiz do projeto). Este spec **continua dali** — é o
> "miolo" do que o bot vai falar e decidir.

Status: 🟡 Planejamento
Última atualização: 2026-06-07

---

## 1. O que mudou (e por que isso é importante)

No começo o bot era um **menu estático de 6 opções** ("textinho que não faz nada"):

```
1 Agendar consulta · 2 Emergência (não assinante) · 3 Sou assinante
4 Especialistas · 5 Videoaulas · 6 Financeiro
```

A cliente agora mandou um material **muito mais ambicioso**: uma **árvore de
triagem clínica** que:

1. **Identifica** se a pessoa já é cliente/assinante (trilha rápida) ou é nova
   (cadastro completo);
2. Aplica um **filtro de emergência crítica** ("botão vermelho") — risco de vida
   **interrompe tudo** e manda pro atendimento presencial;
3. Faz uma **triagem por sistema do corpo** (gastrintestinal, urinário,
   respiratório, pele, locomoção, comportamento);
4. **Classifica a urgência** em 🔴 Vermelho / 🟠 Laranja / 🟡 Amarelo / 🟢 Verde;
5. **Encaminha** pro desfecho certo (presencial urgente, teleconsulta prioritária,
   agendamento, conteúdo educativo).

> 🧠 **Tradução pra gente:** deixou de ser "um menu" e virou um **assistente de
> triagem com regras clínicas**. Isso é ótimo (mais valor pra cliente), mas exige
> a gente construir **por partes** — não dá pra fazer tudo de uma vez.

---

## 2. ⚠️ Reality check: o material foi desenhado pro SITE, a gente faz no WhatsApp

O PDF da cliente descreve o chatbot **dentro do site** (widget), com coisas como:
"layout vermelho piscante", "botões de múltipla escolha", "widget de agenda",
"compartilhar localização". **O WhatsApp não tem essas telas** — a gente não controla
a interface. Então **traduz** cada ideia pro que o WhatsApp permite (mesma lógica,
"embalagem" diferente):

| O que a cliente desenhou (site) | Como vira no **WhatsApp** |
|---|---|
| Botões de múltipla escolha | **Texto numerado** ("Digite 1, 2 ou 3") — ver nota |
| Layout vermelho piscante | 🚨 + **negrito** + emojis de alerta |
| "Compartilhar localização" | Mensagem de **localização** (a Evolution envia) |
| Widget de agenda | **Link** pra página de agendamento |
| Prontuário em JSON pro vet | Salvar no **Postgres** → painel do vet (já existe `medical_records`) |
| Máscara de CPF | Pessoa digita, **valida no código** (a gente checa os dígitos) |

> ⚠️ **Sobre "botões" no WhatsApp (pra não tomar susto):** o WhatsApp *tem* botões e
> listas interativas, mas pela conexão **Baileys/QR (a gratuita que usamos)** eles
> **costumam não aparecer** de forma confiável (a Meta restringe). Por isso o padrão
> seguro é **menu numerado em texto** ("Responda com o número"). A gente pode *tentar*
> os botões depois como melhoria, mas **não dependemos deles**. Decisão registrada:
> **MVP usa texto numerado.**

---

## 3. 🧠 Boa prática: separe a "lógica" do "envio"

Mesmo sendo **só WhatsApp** agora, vale organizar o código separando **o que o bot
decide** de **como ele fala**:

```
        ┌──────────────────────────────────────────┐
        │   CÉREBRO (core da triagem) — 1 lugar só  │
        │   regras clínicas, perguntas, classificação│
        │   de cor, desfechos  →  src/chat/flow.ts   │
        └───────────────────┬──────────────────────┘
                            │ (resposta "neutra": texto + opções + alerta)
                            ▼
                ┌────────────────────────┐
                │  Adaptador WhatsApp     │
                │  recebe via Evolution   │
                │  responde em texto      │
                └───────────┬─────────────┘
                            ▼
                     WhatsApp do cliente
```

- O **cérebro** é uma função tipo `processarMensagem(sessao, resposta)` que recebe o
  estado + o que a pessoa respondeu e devolve a próxima pergunta de forma **neutra**
  (texto + opções + nível de alerta), **sem se preocupar com o canal**.
- O **adaptador WhatsApp** pega essa resposta e envia como **texto numerado** pela
  Evolution.

> 💡 **Por que separar se é só WhatsApp?** Porque deixa o código **limpo e testável**
> (dá pra testar a lógica sem precisar do WhatsApp) e **barato de reaproveitar** se um
> dia voltar o chat do site — bastaria escrever um segundo adaptador, sem mexer na
> triagem. **Mas isso é futuro:** hoje não codamos nada de site.

### 3.1 (Futuro / fora do escopo) Chat no site
A cliente cogitou um chat na **plataforma (site)**, mas **adiou** — fica como
evolução. Se voltar: seria um adaptador novo (rota `POST /chat/message` → devolve
JSON → frontend Nuxt desenha botões/banners), reaproveitando o mesmo cérebro. **Sem
trabalho agora.**

---

## 4. Visão geral do fluxo (o "funil de gravidade")

```
 ETAPA 0  Saudação + disclaimer (não substitui veterinário)
            │
 ETAPA 1  Identificação:  "Você já é cliente/assinante?"
            ├── SIM → trilha rápida (localiza cadastro)
            └── NÃO → onboarding (coleta dados do tutor + pet)
            │
 ETAPA 2  🚨 FILTRO CRÍTICO ("botão vermelho")
            ├── marcou sinal crítico → 🔴 VERMELHO → PARA TUDO → presencial urgente
            └── nenhum sinal crítico → segue
            │
 ETAPA 3  Triagem por sistema do corpo (perguntas objetivas)
            │   (gastrintestinal, urinário, respiratório, pele, locomoção, comportamento)
            ▼
 ETAPA 4  Classificação + desfecho
            🔴 Vermelho · 🟠 Laranja · 🟡 Amarelo · 🟢 Verde
```

A regra de ouro: **segurança primeiro**. O filtro crítico (Etapa 2) roda **antes**
de qualquer pergunta de sintoma, pra um caso grave nunca ficar preso num
questionário.

---

## 5. Como isso encaixa no menu de 6 opções (proposta)

A triagem **não substitui** tudo — opções como Especialistas, Videoaulas e
Financeiro continuam úteis. Proposta de integração (a **confirmar com a cliente**):

```
Menu principal
 1 Agendar consulta ........→ inicia TRIAGEM (Etapa 1 em diante)
 2 Emergência .............→ pula direto pro FILTRO CRÍTICO (Etapa 2)
 3 Sou assinante ..........→ identificação rápida (Etapa 1 trilha SIM) → triagem
 4 Especialistas ..........→ lista do banco (fluxo simples, sem triagem)
 5 Videoaulas/conteúdos ...→ link (fluxo simples)
 6 Financeiro .............→ submenu (fluxo simples)
```

> 💡 Ou seja: a **triagem é o "cérebro clínico"** que vive por trás das opções
> 1, 2 e 3. As opções 4, 5 e 6 são informativas e bem mais simples.

---

## 6. Tabela-fonte das regras de triagem (a "fonte da verdade")

Tudo abaixo é o que a cliente definiu. **Quando formos codar o `flow.ts`, é daqui
que saem as regras.** Mantém este bloco fiel ao material dela.

### 6.1 Etapa 2 — Filtro crítico ("botão vermelho")
Se a pessoa marcar **qualquer um** destes → 🔴 **VERMELHO** e a triagem **para**:

- Dificuldade grave pra respirar / língua roxa (cianótica)
- Convulsão ativa ou desmaio recente
- Sangramento severo / hemorragia ativa
- Trauma grave (atropelamento, briga, queda de altura)
- Ingestão de veneno, produto químico ou objeto estranho

**Ação:** mensagem de emergência + opções → *ver hospital parceiro mais próximo*,
*ver contato/telefone de emergência da ConectaVet*, *enviar localização*.

> ℹ️ Atendimento humano **ao vivo** (alguém da equipe assumir a conversa) está
> **fora do escopo** por ora. Em emergência o bot **direciona** pro presencial e
> mostra um **contato oficial** (telefone/plantão) — mas não transfere pra um
> operador dentro do chat.

### 6.2 Etapa 3 — Triagem por sistema do corpo

| Sistema | Pergunta(s) | Opções | Regra → Alerta |
|---|---|---|---|
| **Gastrintestinal** | Quantas vezes vomitou hoje? | Não vomitou · 1x · 2–3x · +3x | +3x → 🟠 Laranja |
| | Tem sangue no vômito/fezes? | Sim · Não · Não sei | Sim → 🟠 Laranja |
| | Está conseguindo beber água? | Sim · Pouco · Não | Não → 🟠 Laranja |
| | *(regra extra)* | — | Filhote + **qualquer** vômito → 🟠 Laranja |
| **Urinário** | Está urinando normalmente? | Sim · Menos · Não consegue · Não sei | — |
| | *(só gato)* Entra na caixa várias vezes sem urinar? | Sim · Não | **Gato** + "não consegue" **ou** "sim" → 🔴 **Vermelho** (obstrução uretral) |
| **Respiratório** | Tem tosse ou dificuldade pra respirar? | Apenas tosse · Respiração acelerada · Respiração difícil | Difícil → 🔴 Vermelho · Acelerada → 🟠 Laranja |
| **Pele** | Algum sinal na pele? | Coceira · Ferida · Queda de pelo · Nódulo · Nenhum | Em geral → 🟢 Verde |
| **Locomoção** | Consegue andar normalmente? | Sim · Mancando · Com dificuldade · Não levanta | Não levanta → 🟠 Laranja · Mancando/dificuldade → 🟡 Amarelo |
| **Comportamento** | Como está hoje? | Normal · Mais quieto · Muito prostrado · Desorientado | Muito prostrado → 🟠 Laranja · Desorientado → 🟠 Laranja |

> ℹ️ A urina alterada (cor/cheiro) e a hiporexia (falta de apetite) aparecem no
> material como 🟡 Amarelo; prurido/alopecia como 🟢 Verde.

### 6.3 ✅ Decisões sobre as cores (definido em 2026-06-07)
Os 3 documentos tinham pequenas divergências. Resolvidas assim (critério: **na
dúvida, errar pro lado mais seguro / mais urgente**):

- **Prostração / letargia:** "muito prostrado" → 🟠 **Laranja** (prostração profunda
  é sinal de alerta; melhor tratar como urgência). "Mais quieto" segue sem alerta.
- **Locomoção:** "mancando / com dificuldade" → 🟡 **Amarelo**; "não consegue
  levantar" → 🟠 **Laranja**. (Não é divergência real — são gravidades diferentes.)
- **Cor combinada (regra de ouro):** quando o pet tem **vários sintomas de cores
  diferentes**, vale **sempre a cor mais grave** (pior caso). Ex.: um sinal Verde +
  um Laranja → resultado **Laranja**. A tabela §6.2 já reflete essas decisões.

---

## 7. Desfechos (Etapa 4) — o que o bot faz em cada cor

| Cor | Significado | Ação do bot | Botão/Opção oferecida |
|---|---|---|---|
| 🔴 **Vermelho** | Risco imediato de vida | **Bloqueia** teleconsulta. Manda procurar atendimento presencial JÁ | Ver hospital parceiro · Contato de emergência · Enviar localização |
| 🟠 **Laranja** | Urgência clínica | Teleconsulta **prioritária** (espera máx. ~30 min) | Falar com veterinário agora |
| 🟡 **Amarelo** | Precisa avaliação | Agendamento em até 24h | Agendar consulta · Receber orientações |
| 🟢 **Verde** | Baixa urgência | Teleconsulta eletiva **ou** conteúdo | Agendar consulta · Ver conteúdos |

E os **3 desfechos automáticos** que a cliente pediu (como vão funcionar aqui):

1. **Prontuário prévio** — as respostas da triagem viram um resumo estruturado e
   ficam **disponíveis pro veterinário** (salvar no Postgres; mostrar no painel do
   vet). Aproveita a ideia da tabela `medical_records` que já existe.
2. **Gateway de agendamento** — pros casos verde/amarelo, o bot manda o **link da
   agenda** do site (não dá pra embutir widget no WhatsApp).
3. ~~**Transbordo humano**~~ — **FORA DO ESCOPO por ora** (decidido em 2026-06-07).
   O bot **não** transfere a conversa pra um operador ao vivo. Onde a cliente previa
   isso (emergência, pessoa travada), o bot **mostra um contato oficial** da
   ConectaVet (telefone/plantão) pra pessoa procurar por fora. Fica anotado como
   evolução futura, se entrar no escopo depois.

---

## 8. Modelo de dados (reaproveitando o que já existe)

Boa notícia: **quase tudo que a triagem coleta já tem coluna no seu banco.** 🎉

### 8.1 Mapeamento dos dados da triagem → tabelas atuais

| Dado coletado | Tabela.coluna existente |
|---|---|
| Nome do tutor | `users.name` |
| CPF | `users.cpf` |
| Nome do pet | `pets.name` |
| Espécie (cão/gato) | `pets.species` |
| Raça | `pets.breed` |
| Idade | `pets.birth_date` (a gente calcula a idade) |
| Porte | `pets.size` |
| Sexo | `pets.sex` |
| Castrado | `pets.neutered` |
| Microchip | `pets.microchipped` |
| Alergias / doenças prévias | `pets.conditions` |
| Assinante? | `subscriptions` (status `active`) + `plans` |
| Agendamento | `consultations` (status `agendada`) |

> ⚠️ **Atenção (cadastro completo):** criar um usuário "de verdade" exige `email` e
> `password` (que são `notNullable` em `users`). Coletar tudo isso **digitando no
> WhatsApp é cansativo e arriscado** (LGPD com CPF). **Recomendação:** no MVP, em vez
> de cadastrar pelo chat, o bot **manda o link de cadastro do site** e segue a triagem
> só com os dados clínicos essenciais. Decisão a confirmar.

### 8.2 Tabela de estado da conversa (`whatsapp_sessions`)
Já prevista no `WHATSAPP_CHATBOT.md` (seção 5.1). Serve de "memória" de em que passo
cada número está:

```
phone (PK) · step (ponto da árvore) · context (jsonb: respostas + cor acumulada)
· updated_at
```

A árvore de triagem é grande, então o **`context` (jsonb)** vai guardar as respostas
(ex.: `{ "especie": "gato", "vomitos": "+3x", "alerta": "laranja" }`) e o **`step`**
diz qual pergunta vem agora.

> 💡 (Futuro) Se um dia entrar o chat do site, dá pra generalizar pra `chat_sessions`
> com colunas `channel` + `external_id`. Hoje **não precisa** — `phone` como chave
> basta pro WhatsApp.

### 8.3 Tabela nova (provável): registro de triagem (`triages`)
Pra guardar o **resultado** de cada triagem (o "prontuário prévio") de forma
permanente, separado da sessão (que é temporária):

```
id · phone · user_id (nullable) · pet_id (nullable) · answers (jsonb)
· alert_level (vermelho|laranja|amarelo|verde) · outcome · created_at
```

> Ainda **não vamos criar** — só registrar a intenção. Definimos os campos exatos
> na hora de implementar a Fase 3/4.

---

## 9. Plano de implementação — por fases (do mais simples ao mais completo)

A ideia é **sempre ter algo funcionando** e ir somando. Cada fase é entregável.
Escopo: **só WhatsApp** (a infra já está de pé). A lógica nasce **separada do envio**
(§3), o que mantém o código limpo.

### Fase 0 — Encanamento (fazer o loop funcionar) ⬅️ **estamos aqui**
- [ ] Configurar webhook Evolution → backend (`WHATSAPP_CHATBOT.md` §4.6).
- [ ] `src/whatsapp/` com `evolution.ts` (enviar) e `webhook.ts` (receber/adaptador).
- [ ] `src/chat/` com `flow.ts` (cérebro) e `sessions.ts` (estado) — ver §3.
- [ ] Migration `whatsapp_sessions` (§8.2).
- [ ] **Teste:** mandar "oi" e o bot responder qualquer coisa (eco). Prova que o
      ciclo recebe→processa→responde funciona ponta a ponta.

### Fase 1 — Menu principal (texto numerado)
- [ ] Mensagem de boas-vindas + **disclaimer** ("não substitui veterinário").
- [ ] Roteamento das opções 1–6 (texto).
- [ ] Atalhos globais: "menu"/"0" volta ao início.

### Fase 2 — Identificação + Filtro crítico (maior valor clínico, baixo esforço) 🚨
- [ ] Etapa 1: "Já é cliente/assinante?" (Sim/Não).
- [ ] Trilha SIM: localizar cadastro (ver decisão sobre COMO identificar).
- [ ] Trilha NÃO: por ora, **link de cadastro** + seguir com dados mínimos.
- [ ] **Etapa 2 — filtro crítico** (os 5 sinais vermelhos) → mensagem de
      emergência + localização/hospital/contato de emergência.

> Esta fase já entrega o item mais valioso: **não deixar uma emergência esperando.**

### Fase 3 — Triagem por sistema do corpo
- [ ] Perguntas por sistema (tabela §6.2), uma de cada vez, guardando no `context`.
- [ ] Motor de **classificação de cor** (pega sempre a mais grave).
- [ ] Regras especiais (gato + obstrução urinária = vermelho; filhote + vômito = laranja).

### Fase 4 — Desfechos + integração com o backend
- [ ] Mensagens e ações por cor (§7).
- [ ] Verificar **assinante** no banco (`subscriptions`).
- [ ] Link de **agendamento** (verde/amarelo) e/ou criar `consultations`.
- [ ] Salvar **prontuário prévio** (`triages`) pro vet ver.

### Fase 5 — Melhorias (WhatsApp)
- [ ] Contato de emergência oficial nas mensagens 🔴 Vermelho (telefone/plantão).
- [ ] (Opcional) tentar botões/listas interativas do WhatsApp.
- [ ] Métricas simples (quantas triagens, por cor).
> ❌ Atendimento humano ao vivo **fora do escopo** (ver §7).

> 🔮 **Futuro (fora do escopo agora): chat no site.** Se a cliente retomar, seria um
> adaptador novo (rota HTTP + frontend Nuxt) reusando o mesmo cérebro de `src/chat/`.
> Sem trabalho nesta etapa — ver §3.1.

---

## 10. Mapa de estados (rascunho do `step`)

Pra orientar quando formos codar a máquina de estados (`src/chat/flow.ts`). Não é final.

```
MENU                      → menu principal (1–6)
ID_CLIENTE                → "já é cliente/assinante?"
ID_RAPIDA_*               → coleta nome/pet pra localizar cadastro
ONBOARDING_*              → (ou link de cadastro)
CRITICO                   → filtro do botão vermelho
TRIAGEM_GASTRO_*          → perguntas gastrintestinais
TRIAGEM_URINARIO_*        → perguntas urinárias (+ extra do gato)
TRIAGEM_RESPIRATORIO      → respiratório
TRIAGEM_PELE              → pele
TRIAGEM_LOCOMOCAO         → locomoção
TRIAGEM_COMPORTAMENTO     → comportamento
DESFECHO                  → mostra a cor + ações
EMERGENCIA                → fluxo vermelho (presencial)
FINANCEIRO_*, ESPECIALISTAS, etc. → opções simples
```

---

## 11. Segurança clínica e LGPD (não esquecer)

- [ ] **Disclaimer sempre visível no início:** "A triagem digital da ConectaVet não
      estabelece diagnóstico, não substitui consulta presencial; serve só pra indicar
      o nível de urgência e direcionar." (texto da própria cliente).
- [ ] 🔴 Vermelho **bloqueia** teleconsulta e manda pro presencial — regra dura.
- [ ] **LGPD:** o bot coleta CPF e dados de saúde do pet → aviso de privacidade,
      guardar com cuidado, não expor. Coletar só o necessário.
- [ ] **Backup do Postgres** (agora guarda conversas e triagens).

---

## 12. Dependências de conteúdo/dados da cliente (precisamos pedir)

Sem isso, alguns desfechos ficam "no ar":

- [ ] **Hospitais/plantões parceiros presenciais** — existe lista? Com endereço pra
      indicar "o mais próximo"? (necessário pro desfecho 🔴 Vermelho)
- [ ] **Link da agenda/agendamento** no site (pros desfechos amarelo/verde).
- [ ] **Link das videoaulas/conteúdos** (opção 5).
- [ ] **Teleconsulta prioritária (30 min):** existe equipe de plantão? Como o bot
      "chama" um vet? (criar consulta? avisar alguém?)
- [ ] **Contato de emergência oficial** (telefone/plantão) pra mostrar no desfecho
      🔴 Vermelho — já que não há atendimento humano dentro do chat.

---

## 13. Decisões (✅ fechadas) e o que ainda precisa definir

1. ✅ **Escopo:** **só WhatsApp Business** por ora. Chat no site **adiado** (futuro).
2. ⬜ **Como identificar cliente existente** com segurança no WhatsApp? Por **número**
   (mais confiável) ou por nome+pet (frágil)? Recomendo número/CPF.
3. ⬜ **Cadastro novo pelo chat** ou **link do site**? (recomendo link no MVP.)
4. ✅ **Botões vs texto:** WhatsApp usa **texto numerado** (Baileys não garante botões).
5. ✅ **Cores:** decidido (ver §6.3) — divergências resolvidas pro lado mais seguro.
6. ✅ **Cor combinada:** decidido — vale sempre a mais grave (pior caso).
7. ✅ **Atendimento humano:** **fora do escopo** (bot só direciona e mostra um contato
   oficial; não há operador ao vivo no chat).

---

## 14. Próximos passos imediatos

1. ✅ Spec organizado (este arquivo) — escopo **WhatsApp Business**.
2. ⬜ **Validar com a cliente** as pendências da §13 (itens 2 e 3) e as dependências
   de conteúdo da §12.
3. ⬜ Executar a **Fase 0** (encanamento) — seguir `WHATSAPP_CHATBOT.md` §4.6 e §5,
   já separando a lógica (`src/chat/`) do envio (`src/whatsapp/`) — ver §3.
4. ⬜ Seguir Fase 1 → 5, uma de cada vez, testando a cada passo.

> 📌 Lembrete de fluxo de trabalho: codar no local → `git push` → na VPS `git pull`
> + build + migrate + restart do backend. A Evolution (Docker) você quase não mexe.

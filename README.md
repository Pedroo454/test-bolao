# ⚽ Bolão da Copa do Mundo FIFA 2026 - Sala 3A (Escola Américo Franco)

Um site/app completo de apostas e ranking esportivo sob medida para os alunos da sala 3A, com visual moderno, rápido e responsivo inspirado no **Cartola FC**. 

Desenvolvido com **React**, **TypeScript**, **Tailwind CSS** e **Firebase Database** em tempo real.

---

## 🚀 Funcionalidades Principais

### Para Alunos (Jogadores):
- **Dashboard de Palpites**: Interface compacta para simular e salvar os placares dos jogos.
- **Bloqueio Automático**: Encerramento automático de apostas exatamente **5 minutos** antes do primeiro jogo de cada rodada iniciar.
- **Criador de Brasão (Cartola FC)**: Personalização do escudo esportivo (formato, estilo de faixas, cores primária/secundária e emblema central).
- **Ranking Geral**: Classificação ordenada em tempo real com destaque do Líder (Badge de Top 3).
- **Efeitos de Som**: Sons sintetizados nativos de clique, apito do juiz e grito de gol.

### Para o Administrador:
- **Login Protegido**: Credenciais exclusivas (`admin` / `3aamerico!`).
- **Gestão de Alunos**: Cadastrar novos alunos e visualizar senhas.
- **PIN Automático**: Geração inteligente de PINs numéricos de 4 dígitos sem números repetidos (criptografia de acesso facilitado).
- **Lançamento de Resultados**: Entrar com placares oficiais que disparam a recalculadora de pontos geral instantaneamente.
- **Auditoria de Apostas**: Relatório completo exibindo exatamente quem já apostou ou quem está pendente em cada rodada.

---

## 🎯 Regras de Pontuação
- **Placar Exato** = `3 pontos` (2 pontos pelo placar exato + 1 ponto por acertar o vencedor ou empate).
- **Apenas Vencedor ou Empate** = `1 ponto` (errou o placar exato, mas acertou quem ganhou ou se foi empate).
- **Errou Ambos** = `0 pontos`.

---

## 🛠️ Instalação Local

1. **Baixe as dependências**:
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse no navegador: `http://localhost:3000`

3. **Gerenciar Firebase**:
   O aplicativo já vem provisionado com banco Firestore dedicado pronto para a classe 3A. Caso queira carregar os jogos oficiais na primeira inicialização, basta acessar como Admin e clicar em **"Resetar e Importar Jogos FIFA 2026"**.

---

## 🌍 Como Publicar (Deploy via Vercel)

1. **Hospedar no GitHub**:
   - Crie um repositório privado ou público no GitHub.
   - Suba o código do projeto para o repositório.

2. **Publicar no Vercel**:
   - Acesse o painel do [Vercel](https://vercel.com) e faça login com seu GitHub.
   - Clique em **"Add New > Project"**.
   - Selecione o repositório enviado.
   - Mantenha as configurações padrão (Vite é detectado automaticamente) e clique em **"Deploy"**.

3. **Configurar o Domínio Desejado**:
   - Nas configurações do projeto no Vercel, acesse a aba **"Domains"**.
   - Digite seu domínio personalizado desejado (ex: `nossobolao.vercel.app`) para vinculá-lo!

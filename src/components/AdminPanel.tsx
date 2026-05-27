import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { MatchData, ROUND_NAMES, INITIAL_MATCHES, TEAM_FLAGS, getFlagUrl, BRACKET_PROGRESSION } from "../data/worldCupMatches";
import { TournamentBracket } from "./TournamentBracket";
import { CartolaShield, serializeShield } from "./CartolaShield";
import { 
  Users, 
  Calendar, 
  Trophy, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  RotateCcw,
  Sparkles,
  Award,
  Play,
  AlertTriangle
} from "lucide-react";
import sounds from "./SoundEffects";

interface StudentUser {
  id: string;
  name: string;
  pin: string;
  avatar: string;
  score: number;
  exactMatches: number;
  outcomeMatches: number;
  role: "admin" | "user";
}

interface AdminPanelProps {
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<"users" | "matches" | "rodadas" | "bracket">("users");
  const [users, setUsers] = useState<StudentUser[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  
  // Create User state
  const [newUserName, setNewUserName] = useState("");
  const [generatedPin, setGeneratedPin] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // Edit User state
  const [editingUser, setEditingUser] = useState<StudentUser | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserPin, setEditUserPin] = useState("");

  // Edit Match state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editHomeScore, setEditHomeScore] = useState<string>("");
  const [editAwayScore, setEditAwayScore] = useState<string>("");
  const [matchFilterRound, setMatchFilterRound] = useState<number>(1);

  // Edit Full Match info state (for advancing team names between stages manually or automatically)
  const [editingFullMatchId, setEditingFullMatchId] = useState<string | null>(null);
  const [editHomeTeam, setEditHomeTeam] = useState("");
  const [editAwayTeam, setEditAwayTeam] = useState("");
  const [editHomeFlag, setEditHomeFlag] = useState("");
  const [editAwayFlag, setEditAwayFlag] = useState("");
  const [editMatchGroup, setEditMatchGroup] = useState("");
  const [editMatchStadium, setEditMatchStadium] = useState("");
  const [editMatchCity, setEditMatchCity] = useState("");
  const [editMatchDate, setEditMatchDate] = useState("");

  // Stats filter round
  const [statsRound, setStatsRound] = useState<number>(1);

  // Status and logs
  const [operationMsg, setOperationMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Listen to Users, Matches, and Bets databases in real-time
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const uList: StudentUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role !== "admin") {
          uList.push({ id: doc.id, ...data } as StudentUser);
        }
      });
      // Sort users by score descending
      uList.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      setUsers(uList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snapshot) => {
      const mList: MatchData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        mList.push({ id: doc.id, ...data } as MatchData);
      });
      // Sort matches by date ascending
      mList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMatches(mList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "matches");
    });

    const unsubBets = onSnapshot(collection(db, "bets"), (snapshot) => {
      const bList: any[] = [];
      snapshot.forEach((doc) => {
        bList.push({ id: doc.id, ...doc.data() });
      });
      setBets(bList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bets");
    });

    return () => {
      unsubUsers();
      unsubMatches();
      unsubBets();
    };
  }, []);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setOperationMsg({ type, text });
    setTimeout(() => setOperationMsg(null), 4000);
  };

  // Helper pin generator (4 distinct digits)
  const generateDistinctPin = (): string => {
    const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    // Fisher-Yates Shuffle
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = digits[i];
      digits[i] = digits[j];
      digits[j] = temp;
    }
    return digits.slice(0, 4).join("");
  };

  const handleGeneratePinClick = () => {
    sounds.playClick();
    const pin = generateDistinctPin();
    setGeneratedPin(pin);
  };

  // 1. CREATE USER
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    if (!newUserName.trim() || !generatedPin) {
      showFeedback("Por favor, preencha o nome e gere uma senha de 4 dígitos", "error");
      return;
    }

    // Verify name duplication
    const nameExists = users.some(u => u.name.toLowerCase() === newUserName.trim().toLowerCase());
    if (nameExists) {
      showFeedback("Já existe um aluno com esse nome na sala 3A!", "error");
      return;
    }

    setIsCreatingUser(true);
    try {
      // Use clean ID from lowercase name string
      const userId = "user_" + newUserName.trim().toLowerCase().replace(/\s+/g, "_");
      
      // Default Cartola FC dynamic shield setup
      const initialShield = "classic|solid|#00E75C|#0B0F19|🏆";

      await setDoc(doc(db, "users", userId), {
        name: newUserName.trim(),
        pin: generatedPin,
        avatar: initialShield,
        score: 0,
        exactMatches: 0,
        outcomeMatches: 0,
        role: "user",
        createdAt: new Date().toISOString()
      });

      setNewUserName("");
      setGeneratedPin("");
      sounds.playWhistle();
      showFeedback("Aluno cadastrado com sucesso!");
    } catch (err: any) {
      showFeedback("Erro ao criar aluno: " + err.message, "error");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // 2. EDIT USER INLINE
  const handleStartEditUser = (user: StudentUser) => {
    sounds.playClick();
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserPin(user.pin);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    sounds.playClick();

    if (!editUserName.trim() || editUserPin.length !== 4) {
      showFeedback("Nome não deve ser vazio e a senha deve conter 4 dígitos", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        name: editUserName.trim(),
        pin: editUserPin
      });
      setEditingUser(null);
      showFeedback("Dados do aluno atualizados!");
    } catch (err: any) {
      showFeedback("Erro ao atualizar o aluno: " + err.message, "error");
    }
  };

  // 3. REMOVE USER (and their cascade bets)
  const handleRemoveUser = async (user: StudentUser) => {
    if (!window.confirm(`Tem certeza que deseja banir ${user.name} do Bolão 3A?`)) return;
    sounds.playWhistle();

    try {
      // Cascade delete user bets
      const userBetsQuery = query(collection(db, "bets"), where("userId", "==", user.id));
      const qSnapshot = await getDocs(userBetsQuery);
      
      const batch = writeBatch(db);
      qSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      batch.delete(doc(db, "users", user.id));
      
      await batch.commit();
      showFeedback(`Aluno ${user.name} foi removido do Bolão.`);
    } catch (err: any) {
      showFeedback("Erro ao remover o aluno: " + err.message, "error");
    }
  };

  // 4. RESET USER POINTS & BET DETAILS EXCEPT FOR SECRETS
  const handleResetUserBets = async (user: StudentUser) => {
    if (!window.confirm(`Deseja zerar as apostas e pontos de ${user.name}?`)) return;
    sounds.playClick();

    try {
      const userBetsQuery = query(collection(db, "bets"), where("userId", "==", user.id));
      const qSnapshot = await getDocs(userBetsQuery);
      
      const batch = writeBatch(db);
      qSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Reset user scores back to 0
      batch.update(doc(db, "users", user.id), {
        score: 0,
        exactMatches: 0,
        outcomeMatches: 0
      });

      await batch.commit();
      showFeedback(`Apostas de ${user.name} foram completamente apagadas.`);
    } catch (err: any) {
      showFeedback("Erro ao resetar: " + err.message, "error");
    }
  };

  // 5. BOOTSTRAP OFFICIALLY PREDEFINED WORLD CUP MATCHES
  const handleBootstrapMatches = async () => {
    sounds.playWhistle();
    if (!window.confirm("Essa ação irá pré-carregar os jogos oficiais da Copa do Mundo FIFA 2026. Deseja continuar?")) return;

    try {
      const batch = writeBatch(db);
      INITIAL_MATCHES.forEach((match) => {
        batch.set(doc(db, "matches", match.id), {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeFlag: match.homeFlag,
          awayFlag: match.awayFlag,
          group: match.group,
          stadium: match.stadium,
          city: match.city,
          date: match.date,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          status: match.status,
          roundNumber: match.roundNumber
        });
      });

      await batch.commit();
      showFeedback("Jogos da Copa do Mundo 2026 importados com Sucesso!");
    } catch (e: any) {
      showFeedback("Erro ao importar jogos: " + e.message, "error");
    }
  };

  // 6. RECALCULATE LEAGUE TAB AND SCORES DYNAMICALLY
  const recalculateAllUsersScores = async (updatedMatchId?: string, actualHome?: number | null, actualAway?: number | null) => {
    try {
      // 1. Fetch all users
      const uSnapshot = await getDocs(collection(db, "users"));
      // 2. Fetch all matches to compute completely fresh metrics
      const mSnapshot = await getDocs(collection(db, "matches"));
      const matchesMap: Record<string, MatchData> = {};
      mSnapshot.forEach(doc => {
        matchesMap[doc.id] = { id: doc.id, ...doc.data() } as MatchData;
      });

      // Override with current score if modified on UI
      if (updatedMatchId && actualHome !== undefined) {
        if (matchesMap[updatedMatchId]) {
          matchesMap[updatedMatchId].homeScore = actualHome;
          matchesMap[updatedMatchId].awayScore = actualAway ?? null;
          matchesMap[updatedMatchId].status = actualHome !== null ? "finished" : "scheduled";
        }
      }

      // 3. Fetch all bets
      const bSnapshot = await getDocs(collection(db, "bets"));
      const userBetsMap: Record<string, any[]> = {};
      bSnapshot.forEach(doc => {
        const bet = doc.data();
        const uId = bet.userId;
        if (!userBetsMap[uId]) userBetsMap[uId] = [];
        userBetsMap[uId].push({ id: doc.id, ...bet });
      });

      const batch = writeBatch(db);

      uSnapshot.forEach((userDoc) => {
        const uId = userDoc.id;
        const userData = userDoc.data();
        if (userData.role === "admin") return;

        const betsForUser = userBetsMap[uId] || [];
        let totalScore = 0;
        let exactCount = 0;
        let outcomeCount = 0;

        betsForUser.forEach((bet) => {
          const match = matchesMap[bet.matchId];
          if (!match || match.homeScore === null || match.awayScore === null) {
            // Match not played, skip or 0 points
            return;
          }

          const hBet = bet.homeTeamBet;
          const aBet = bet.awayTeamBet;
          const hReal = match.homeScore;
          const aReal = match.awayScore;

          let pts = 0;
          // exact score
          if (hBet === hReal && aBet === aReal) {
            pts = 3; // EXACT SCORE (Combination of 1 Outcome + 2 Exact)
            exactCount++;
          } else {
            // Correct outcome (win/draw/loss)
            const outcomeBet = Math.sign(hBet - aBet);
            const outcomeReal = Math.sign(hReal - aReal);
            if (outcomeBet === outcomeReal) {
              pts = 1;
              outcomeCount++;
            } else {
              pts = 0;
            }
          }

          // Update point for this particular bet in the batch
          batch.update(doc(db, "bets", bet.id), { pointsEarned: pts });
          totalScore += pts;
        });

        // Update overall stats for student
        batch.update(doc(db, "users", uId), {
          score: totalScore,
          exactMatches: exactCount,
          outcomeMatches: outcomeCount
        });
      });

      await batch.commit();
      sounds.playGoalCheer();
    } catch (e: any) {
      console.error("Score recalculator failed:", e);
      showFeedback("Erro na recalculação dos pontos: " + e.message, "error");
    }
  };

  // Helper to resolve which group stage round (Rodada 1, 2, or 3) a group match belongs to based on chronological ordering
  const getGroupStageMatchRodada = (match: MatchData, allMatches: MatchData[]) => {
    const isGroupStage = match.roundNumber !== 4 && 
      !match.id.startsWith("copa_r32") && 
      !match.id.startsWith("copa_r16") && 
      !match.id.startsWith("copa_q8") && 
      !match.id.startsWith("copa_s4") && 
      !match.id.startsWith("copa_f2");
    if (!isGroupStage) return 4;

    const groupMatches = allMatches
      .filter(m => m.group === match.group && m.roundNumber !== 4 && !m.id.startsWith("copa_r32") && !m.id.startsWith("copa_r16") && !m.id.startsWith("copa_q8") && !m.id.startsWith("copa_s4") && !m.id.startsWith("copa_f2"))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const idx = groupMatches.findIndex(m => m.id === match.id);
    if (idx === -1) return 1;
    if (idx < 2) return 1;
    if (idx < 4) return 2;
    return 3;
  };

  // Dynamic winner promotion and bracket progressor for knockout phases
  const handleSetKnockoutWinner = async (matchId: string, winningTeam: string) => {
    sounds.playWhistle();
    const matchInstance = matches.find((m) => m.id === matchId);
    if (!matchInstance) return;

    try {
      const isHomeWinner = matchInstance.homeTeam === winningTeam;
      // Set Finished, set a default representative score if empty/null
      const homeVal = matchInstance.homeScore !== null ? matchInstance.homeScore : (isHomeWinner ? 1 : 0);
      const awayVal = matchInstance.awayScore !== null ? matchInstance.awayScore : (isHomeWinner ? 0 : 1);

      await updateDoc(doc(db, "matches", matchId), {
        status: "finished",
        homeScore: homeVal,
        awayScore: awayVal,
      });

      // Recalculate scores for students
      await recalculateAllUsersScores(matchId, homeVal, awayVal);

      // Compute dynamic bracket progression flow
      const progression = BRACKET_PROGRESSION[matchId];
      if (progression) {
        const nextMatchRef = doc(db, "matches", progression.nextMatchId);
        const winningTeamFlag = isHomeWinner ? matchInstance.homeFlag : matchInstance.awayFlag;

        if (progression.slot === "home") {
          await updateDoc(nextMatchRef, {
            homeTeam: winningTeam,
            homeFlag: winningTeamFlag,
          });
        } else {
          await updateDoc(nextMatchRef, {
            awayTeam: winningTeam,
            awayFlag: winningTeamFlag,
          });
        }
        showFeedback(`Sucesso! ${winningTeam} avançou para a próxima fase.`);
      } else {
        showFeedback(`Sucesso! ${winningTeam} venceu!`);
      }
    } catch (e: any) {
      console.error("Erro ao definir vencedor do mata-mata:", e);
      showFeedback("Erro ao definir vencedor: " + e.message, "error");
    }
  };

  // 7. SAVE OR REMOVE A MATCH SCORE
  const handleSaveMatchScore = async (matchId: string) => {
    sounds.playClick();
    if (editHomeScore === "" || editAwayScore === "") {
      showFeedback("Preencha ambos os placares para salvar o resultado", "error");
      return;
    }

    const homeVal = parseInt(editHomeScore);
    const awayVal = parseInt(editAwayScore);

    if (isNaN(homeVal) || isNaN(awayVal)) {
      showFeedback("Placares informados devem ser numéricos", "error");
      return;
    }

    try {
      // 1. Update Match score and status to finished
      await updateDoc(doc(db, "matches", matchId), {
        homeScore: homeVal,
        awayScore: awayVal,
        status: "finished"
      } as any);

      // 1.5. Automatic advancement / stage propagation
      const currentMatch = matches.find((m) => m.id === matchId);
      let propagatedMsg = "";
      if (currentMatch && homeVal !== awayVal) {
        const winnerName = homeVal > awayVal ? currentMatch.homeTeam : currentMatch.awayTeam;
        const winnerFlag = homeVal > awayVal ? currentMatch.homeFlag : currentMatch.awayFlag;

        const progression = BRACKET_PROGRESSION[matchId];
        if (progression) {
          const nextMatchRef = doc(db, "matches", progression.nextMatchId);
          if (progression.slot === "home") {
            await updateDoc(nextMatchRef, {
              homeTeam: winnerName,
              homeFlag: winnerFlag
            });
          } else {
            await updateDoc(nextMatchRef, {
              awayTeam: winnerName,
              awayFlag: winnerFlag
            });
          }
          propagatedMsg = ` Vencedor (${winnerName}) avançou na chave do Mata-Mata!`;
        }
      }

      // 2. Perform global score recalculation
      await recalculateAllUsersScores(matchId, homeVal, awayVal);

      setEditingMatchId(null);
      setEditHomeScore("");
      setEditAwayScore("");
      showFeedback(`Resultado salvo e pontuações do 3A atualizadas!${propagatedMsg}`);
    } catch (err: any) {
      showFeedback("Erro ao atualizar placar do jogo: " + err.message, "error");
    }
  };

  const handleClearMatchScore = async (match: MatchData) => {
    if (!window.confirm(`Deseja anular o placar de ${match.homeTeam} x ${match.awayTeam}?`)) return;
    sounds.playClick();

    try {
      await updateDoc(doc(db, "matches", match.id), {
        homeScore: null,
        awayScore: null,
        status: "scheduled"
      } as any);

      // Clear automatic propagation
      if (match.id === "copa_13") {
        await updateDoc(doc(db, "matches", "copa_16"), {
          homeTeam: "Brasil",
          homeFlag: "🇧🇷"
        });
      } else if (match.id === "copa_14") {
        await updateDoc(doc(db, "matches", "copa_15"), {
          awayTeam: "Espanha",
          awayFlag: "🇪🇸"
        });
      } else if (match.id === "copa_15") {
        await updateDoc(doc(db, "matches", "copa_16"), {
          awayTeam: "França",
          awayFlag: "🇫🇷"
        });
      }

      await recalculateAllUsersScores(match.id, null, null);
      showFeedback("Placar cancelado com sucesso e avanços desfeitos.");
    } catch (err: any) {
      showFeedback("Erro ao limpar placar: " + err.message, "error");
    }
  };

  // 7.5. UPDATE FULL MATCH DATA DETAILS (ADMIN)
  const handleUpdateMatchInfo = async (matchId: string) => {
    sounds.playClick();
    if (!editHomeTeam.trim() || !editAwayTeam.trim()) {
      showFeedback("Os nomes dos times não podem estar em branco!", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "matches", matchId), {
        homeTeam: editHomeTeam.trim(),
        awayTeam: editAwayTeam.trim(),
        homeFlag: editHomeFlag.trim() || "🏳️",
        awayFlag: editAwayFlag.trim() || "🏳️",
        group: editMatchGroup.trim() || "Grupo",
        stadium: editMatchStadium.trim() || "Estádio",
        city: editMatchCity.trim() || "Cidade",
        date: editMatchDate.trim() || new Date().toISOString()
      });

      setEditingFullMatchId(null);
      showFeedback("Detalhes do jogo atualizados com sucesso!");
    } catch (err: any) {
      showFeedback("Erro ao modificar detalhes do jogo: " + err.message, "error");
    }
  };

  // Edit points manually
  const handleDirectPointEdit = async (student: StudentUser, amount: number) => {
    sounds.playClick();
    const newScore = student.score + amount;
    if (newScore < 0) return;
    try {
      await updateDoc(doc(db, "users", student.id), {
        score: newScore
      });
      showFeedback(`Alterado pontuação de ${student.name} para ${newScore}!`);
    } catch (e: any) {
      showFeedback("Erro: " + e.message, "error");
    }
  };

  // Get participation info
  const getParticipationForRound = (roundNum: number) => {
    // Collect active matches in that round
    const roundMatches = matches.filter(m => m.roundNumber === roundNum);
    if (roundMatches.length === 0) return { participantsWhoBet: [], participantsNoBet: [] };

    const usersWhoBet: typeof users = [];
    const usersNoBet: typeof users = [];

    users.forEach((u) => {
      // Check if user has bet on at least 1 match of this round
      const userBetsCount = bets.filter(b => b.userId === u.id && roundMatches.some(m => m.id === b.matchId)).length;
      if (userBetsCount > 0) {
        usersWhoBet.push(u);
      } else {
        usersNoBet.push(u);
      }
    });

    return { usersWhoBet, usersNoBet, roundMatchesCount: roundMatches.length };
  };

  const currentRoundStats = getParticipationForRound(statsRound);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-0 py-6" id="dashboard_admin">
      
      {/* Admin Title Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 mb-8">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
            Painel Administrador 3A (Sala Secreta)
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-300">
            CONTROLE DO BOLÃO COPA 2026
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={handleBootstrapMatches}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-yellow-500 font-mono text-xs font-semibold cursor-pointer border border-zinc-700"
          >
            <Sparkles size={14} />
            Resetar e Importar Jogos FIFA 2026
          </button>
          
          <button
            onClick={() => { sounds.playClick(); onLogout(); }}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 font-sans text-sm font-bold text-white transition-all shadow-md cursor-pointer"
          >
            Sair do Painel
          </button>
        </div>
      </div>

      {/* Floating banner status response feedback */}
      {operationMsg && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 border text-sm font-sans animate-bounce shadow-xl ${
            operationMsg.type === "success"
              ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
              : "bg-red-950/80 border-red-500 text-red-300"
          }`}
          id="toast_message"
        >
          {operationMsg.type === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>{operationMsg.text}</span>
        </div>
      )}

      {/* Primary Tab Toggle Deck */}
      <div className="flex bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl mb-6">
        <button
          onClick={() => { sounds.playClick(); setActiveTab("users"); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-sans text-sm font-bold transition-all cursor-pointer ${
            activeTab === "users"
              ? "bg-orange-500 text-white shadow-md shadow-orange-950/50"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Users size={16} />
          Gerenciar Alunos ({users.length})
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab("matches"); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-sans text-sm font-bold transition-all cursor-pointer ${
            activeTab === "matches"
              ? "bg-orange-500 text-white shadow-md shadow-orange-950/50"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Trophy size={16} />
          Placares da Copa
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab("rodadas"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-sans text-sm font-bold transition-all cursor-pointer ${
            activeTab === "rodadas"
              ? "bg-orange-500 text-white shadow-md shadow-orange-950/50"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Calendar size={16} />
          Participação por Rodada
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab("bracket"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-sans text-sm font-bold transition-all cursor-pointer ${
            activeTab === "bracket"
              ? "bg-orange-500 text-white shadow-md shadow-orange-950/50"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Trophy size={16} />
          Definir Mata-Mata
        </button>
      </div>

      {/* CONTENT DECK */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Register Student Account */}
          <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl h-fit">
            <h2 className="text-xl font-bold font-sans text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-orange-500" />
              Cadastrar Novo Aluno 3A
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Nome do Estudante
                </label>
                <input
                  type="text"
                  placeholder="Nome completo do aluno"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-zinc-950/80 text-white border border-zinc-800 rounded-lg px-3 py-2.5 font-sans text-sm outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Senha de Acesso (Auto-Gerada)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Clique no gerador ➔"
                    value={generatedPin}
                    readOnly
                    className="flex-1 bg-zinc-950/80 text-orange-400 border border-zinc-800 rounded-lg px-3 py-2.5 font-mono text-center font-bold tracking-widest outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePinClick}
                    className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={14} className="text-green-500" />
                    Gerar PIN
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                  A senha gerada contém 4 números totalmente distintos, garantido por algoritmo.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 font-sans text-sm font-bold text-neutral-950 shadow-md cursor-pointer disabled:opacity-40"
              >
                {isCreatingUser ? "Salvando Aluno..." : "Registrar Aluno no Ranking"}
              </button>
            </form>
          </div>

          {/* Right Column: Students Ledger & Operations */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* List Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
                <h2 className="text-lg font-bold font-sans text-white flex items-center gap-2">
                  <Users size={18} className="text-orange-500" />
                  Lista de Estudantes Cadastrados
                </h2>
                <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800">
                  Total: {users.length} alunos
                </div>
              </div>

              {/* Editing Form Floating (If Active) */}
              {editingUser && (
                <div className="mb-6 p-4 bg-orange-950/20 border border-orange-500/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-orange-400 font-bold uppercase tracking-wider">
                      Editando Aluno: {editingUser.name}
                    </span>
                    <button 
                      onClick={() => setEditingUser(null)}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="bg-zinc-950 text-white rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800"
                    />
                    <input
                      type="text"
                      maxLength={4}
                      value={editUserPin}
                      onChange={(e) => setEditUserPin(e.target.value)}
                      className="bg-zinc-950 text-orange-400 text-center font-mono font-bold tracking-widest rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingUser(null)}
                      className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-750 font-sans rounded-md cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleUpdateUser}
                      className="px-3 py-1.5 text-xs text-black bg-orange-500 hover:bg-orange-600 font-sans font-bold rounded-md cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              )}

              {users.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-sans">
                  Nenhum aluno cadastrado. Use o formulário lateral para preencher a sala 3A!
                </div>
              ) : (
                <div className="divide-y divide-zinc-850">
                  {users.map((student, idx) => (
                    <div key={student.id} className="py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      
                      {/* Left: Info */}
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="font-mono text-xs text-zinc-500 font-bold bg-zinc-950 border border-zinc-850 h-6 w-6 flex items-center justify-center rounded-full">
                          {idx + 1}
                        </span>
                        <CartolaShield avatarString={student.avatar} size={42} />
                        <div>
                          <div className="font-sans font-bold text-white text-base flex items-center gap-2">
                            {student.name}
                            {idx === 0 && (
                              <span className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] text-zinc-950 font-sans font-extrabold bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full">
                                <Award size={10} /> Líder
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 font-mono text-xs text-zinc-400 mt-0.5">
                            <span className="text-orange-400 font-bold">PIN: {student.pin}</span>
                            <span className="text-zinc-650">•</span>
                            <span className="text-zinc-400">Total: {student.score} pts</span>
                            <span className="text-zinc-650">•</span>
                            <span className="text-green-500" title="Placares Exatos acertados">🎯 {student.exactMatches}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                        
                        {/* Point Editor Tweak Toggles */}
                        <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded-lg p-0.5" title="Ajuste fino de pontos">
                          <button
                            onClick={() => handleDirectPointEdit(student, -1)}
                            className="px-2 py-1 text-xs font-mono font-bold text-red-400 hover:bg-zinc-900 rounded cursor-pointer"
                          >
                            -1
                          </button>
                          <span className="px-2 text-xs font-mono font-bold text-white bg-zinc-900 border-x border-zinc-850">
                            {student.score} pts
                          </span>
                          <button
                            onClick={() => handleDirectPointEdit(student, 1)}
                            className="px-2 py-1 text-xs font-mono font-bold text-green-400 hover:bg-zinc-900 rounded cursor-pointer"
                          >
                            +1
                          </button>
                        </div>

                        {/* Edit Student Account Name/PIN */}
                        <button
                          onClick={() => handleStartEditUser(student)}
                          className="p-2 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/80 rounded-md cursor-pointer transition-colors"
                          title="Editar Nome/Senha"
                        >
                          <Edit size={14} />
                        </button>

                        {/* Reset individual Bets and points */}
                        <button
                          onClick={() => handleResetUserBets(student)}
                          className="p-2 text-zinc-400 hover:text-amber-500 bg-zinc-800/60 hover:bg-zinc-700/80 rounded-md cursor-pointer transition-colors"
                          title="Zerar Apostas e Pontos"
                        >
                          <RotateCcw size={14} />
                        </button>

                        {/* Ban / Delete Student profile */}
                        <button
                          onClick={() => handleRemoveUser(student)}
                          className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-800/60 hover:bg-zinc-700/80 rounded-md cursor-pointer transition-colors"
                          title="Excluir Aluno"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === "matches" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          
          {/* Matches Header Block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-850 pb-4 mb-6 gap-4">
            <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
              <Trophy size={18} className="text-orange-500" />
              Lançamento Oficial de Resultados
            </h2>
            <div className="flex bg-zinc-950 p-1 border border-zinc-850 rounded-lg text-xs font-sans">
              {[1, 2, 3, 4].map((round) => (
                <button
                  key={round}
                  onClick={() => { sounds.playClick(); setMatchFilterRound(round); }}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    matchFilterRound === round
                      ? "bg-orange-500 text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {round === 4 ? "Mata-Mata" : `Rodada ${round}`}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm font-sans text-zinc-400 mb-6 font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-850">
            Filtro Ativo: <span className="text-orange-400 font-bold uppercase">{matchFilterRound === 4 ? "Fase Final - Mata-Mata" : `Fase de Grupos - Rodada ${matchFilterRound}`}</span>
          </div>

          {/* Matches List Grid */}
          {(() => {
            const isPlaceholderTeamName = (name: string) => {
              return !name || name.startsWith("1º") || name.startsWith("2º") || name.startsWith("3º") || name.startsWith("Vence") || name.startsWith("Vencedor") || name.startsWith("Melhor 2º");
            };

            const GROUPS_LIST = [
              "Grupo A", "Grupo B", "Grupo C", "Grupo D",
              "Grupo E", "Grupo F", "Grupo G", "Grupo H",
              "Grupo I", "Grupo J", "Grupo K", "Grupo L"
            ];

            const STAGES = [
              { id: "r32", title: "Fase de 32 (16-avos de Final)", prefix: "copa_r32_" },
              { id: "r16", title: "Oitavas de Final", prefix: "copa_r16_" },
              { id: "q8", title: "Quartas de Final", prefix: "copa_q8_" },
              { id: "s4", title: "Semifinais", prefix: "copa_s4_" },
              { id: "f2", title: "Grande Final", prefix: "copa_f2_" },
            ];

            // Render single Match Card
            const renderMatchAdminCard = (match: MatchData) => {
              const isEditing = editingMatchId === match.id;
              const isEditingFull = editingFullMatchId === match.id;

              if (isEditingFull) {
                return (
                  <div
                    key={match.id}
                    className="p-5 rounded-xl border bg-zinc-950 border-orange-500/40 space-y-4 shadow-xl text-left"
                  >
                    <div className="text-xs font-mono text-orange-400 font-bold uppercase pb-1 border-b border-zinc-850 flex justify-between">
                      <span>Editar Jogo ({match.id})</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Configuração</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Time Mandante</label>
                        <select
                          value={editHomeTeam}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditHomeTeam(val);
                            if (val === "México") setEditHomeFlag("🇲🇽");
                            else if (val === "África do Sul") setEditHomeFlag("🇿🇦");
                            else if (val === "Coreia do Sul") setEditHomeFlag("🇰🇷");
                            else if (val === "Rep. Tcheca") setEditHomeFlag("🇨🇿");
                            else if (val === "Canadá") setEditHomeFlag("🇨🇦");
                            else if (val === "Bósnia-Herzegovina") setEditHomeFlag("🇧🇦");
                            else if (val === "Catar") setEditHomeFlag("🇶🇦");
                            else if (val === "Suíça") setEditHomeFlag("🇨🇭");
                            else if (val === "Brasil") setEditHomeFlag("🇧🇷");
                            else if (val === "Marrocos") setEditHomeFlag("🇲🇦");
                            else if (val === "Colômbia") setEditHomeFlag("🇨🇴");
                            else if (val === "Suécia") setEditHomeFlag("🇸🇪");
                            else if (val === "Espanha") setEditHomeFlag("🇪🇸");
                            else if (val === "Japão") setEditHomeFlag("🇯🇵");
                            else if (val === "Nigéria") setEditHomeFlag("🇳🇬");
                            else if (val === "Irlanda") setEditHomeFlag("🇮🇪");
                            else if (val === "Itália") setEditHomeFlag("🇮🇹");
                            else if (val === "Equador") setEditHomeFlag("🇪🇨");
                            else if (val === "Arábia Saudita") setEditHomeFlag("🇸🇦");
                            else if (val === "Costa Rica") setEditHomeFlag("🇨🇷");
                            else if (val === "França") setEditHomeFlag("🇫🇷");
                            else if (val === "Senegal") setEditHomeFlag("🇸🇳");
                            else if (val === "Austrália") setEditHomeFlag("🇦🇺");
                            else if (val === "Gales") setEditHomeFlag("🏴󠁧󠁢󠁷󠁬󠁳󠁿");
                            else if (val === "Bélgica") setEditHomeFlag("🇧🇪");
                            else if (val === "Uruguai") setEditHomeFlag("🇺🇾");
                            else if (val === "Argélia") setEditHomeFlag("🇩🇿");
                            else if (val === "Nova Zelândia") setEditHomeFlag("🇳🇿");
                            else if (val === "Inglaterra") setEditHomeFlag("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
                            else if (val === "Etiópia") setEditHomeFlag("🇪🇹");
                            else if (val === "Honduras") setEditHomeFlag("🇭🇳");
                            else if (val === "Romênia") setEditHomeFlag("🇷🇴");
                            else if (val === "Argentina") setEditHomeFlag("🇦🇷");
                            else if (val === "Dinamarca") setEditHomeFlag("🇩🇰");
                            else if (val === "Ucrânia") setEditHomeFlag("🇺🇦");
                            else if (val === "Jamaica") setEditHomeFlag("🇯🇲");
                            else if (val === "Croácia") setEditHomeFlag("🇭🇷");
                            else if (val === "Camarões") setEditHomeFlag("🇨🇲");
                            else if (val === "Panamá") setEditHomeFlag("🇵🇦");
                            else if (val === "Luxemburgo") setEditHomeFlag("🇱🇺");
                            else if (val === "Holanda") setEditHomeFlag("🇳🇱");
                            else if (val === "Chile") setEditHomeFlag("🇨🇱");
                            else if (val === "Polônia") setEditHomeFlag("🇵🇱");
                            else if (val === "Gana") setEditHomeFlag("🇬🇭");
                            else if (val === "Portugal") setEditHomeFlag("🇵🇹");
                            else if (val === "Paraguai") setEditHomeFlag("🇵🇾");
                            else if (val === "Estados Unidos") setEditHomeFlag("🇺🇸");
                            else if (val === "Áustria") setEditHomeFlag("🇦🇹");
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="">-- Escolha um país oficial --</option>
                          {editHomeTeam && !Object.keys(TEAM_FLAGS).includes(editHomeTeam) && (
                            <option value={editHomeTeam}>{editHomeTeam}</option>
                          )}
                          {Object.keys(TEAM_FLAGS).sort().map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editHomeTeam}
                          placeholder="Ou defina nome manual..."
                          onChange={(e) => setEditHomeTeam(e.target.value)}
                          className="w-full bg-zinc-950/80 border border-zinc-850 rounded px-3 py-1 mt-1 text-[11px] text-zinc-300 outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Emoji Mandante</label>
                        <input
                          type="text"
                          value={editHomeFlag}
                          onChange={(e) => setEditHomeFlag(e.target.value)}
                          placeholder="🇧🇷"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-center text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Time Visitante</label>
                        <select
                          value={editAwayTeam}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditAwayTeam(val);
                            if (val === "México") setEditAwayFlag("🇲🇽");
                            else if (val === "África do Sul") setEditAwayFlag("🇿🇦");
                            else if (val === "Coreia do Sul") setEditAwayFlag("🇰🇷");
                            else if (val === "Rep. Tcheca") setEditAwayFlag("🇨🇿");
                            else if (val === "Canadá") setEditAwayFlag("🇨🇦");
                            else if (val === "Bósnia-Herzegovina") setEditAwayFlag("🇧🇦");
                            else if (val === "Catar") setEditAwayFlag("🇶🇦");
                            else if (val === "Suíça") setEditAwayFlag("🇨🇭");
                            else if (val === "Brasil") setEditAwayFlag("🇧🇷");
                            else if (val === "Marrocos") setEditAwayFlag("🇲🇦");
                            else if (val === "Colômbia") setEditAwayFlag("🇨🇴");
                            else if (val === "Suécia") setEditAwayFlag("🇸🇪");
                            else if (val === "Espanha") setEditAwayFlag("🇪🇸");
                            else if (val === "Japão") setEditAwayFlag("🇯🇵");
                            else if (val === "Nigéria") setEditAwayFlag("🇳🇬");
                            else if (val === "Irlanda") setEditAwayFlag("🇮🇪");
                            else if (val === "Itália") setEditAwayFlag("🇮🇹");
                            else if (val === "Equador") setEditAwayFlag("🇪🇨");
                            else if (val === "Arábia Saudita") setEditAwayFlag("🇸🇦");
                            else if (val === "Costa Rica") setEditAwayFlag("🇨🇷");
                            else if (val === "França") setEditAwayFlag("🇫🇷");
                            else if (val === "Senegal") setEditAwayFlag("🇸🇳");
                            else if (val === "Austrália") setEditAwayFlag("🇦🇺");
                            else if (val === "Gales") setEditAwayFlag("🏴󠁧󠁢󠁷󠁬󠁳󠁿");
                            else if (val === "Bélgica") setEditAwayFlag("🇧🇪");
                            else if (val === "Uruguai") setEditAwayFlag("🇺🇾");
                            else if (val === "Argélia") setEditAwayFlag("🇩🇿");
                            else if (val === "Nova Zelândia") setEditAwayFlag("🇳🇿");
                            else if (val === "Inglaterra") setEditAwayFlag("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
                            else if (val === "Etiópia") setEditAwayFlag("🇪🇹");
                            else if (val === "Honduras") setEditAwayFlag("🇭🇳");
                            else if (val === "Romênia") setEditAwayFlag("🇷🇴");
                            else if (val === "Argentina") setEditAwayFlag("🇦🇷");
                            else if (val === "Dinamarca") setEditAwayFlag("🇩🇰");
                            else if (val === "Ucrânia") setEditAwayFlag("🇺🇦");
                            else if (val === "Jamaica") setEditAwayFlag("🇯🇲");
                            else if (val === "Croácia") setEditAwayFlag("🇭🇷");
                            else if (val === "Camarões") setEditAwayFlag("🇨🇲");
                            else if (val === "Panamá") setEditAwayFlag("🇵🇦");
                            else if (val === "Luxemburgo") setEditAwayFlag("🇱🇺");
                            else if (val === "Holanda") setEditAwayFlag("🇳🇱");
                            else if (val === "Chile") setEditAwayFlag("🇨🇱");
                            else if (val === "Polônia") setEditAwayFlag("🇵🇱");
                            else if (val === "Gana") setEditAwayFlag("🇬🇭");
                            else if (val === "Portugal") setEditAwayFlag("🇵🇹");
                            else if (val === "Paraguai") setEditAwayFlag("🇵🇾");
                            else if (val === "Estados Unidos") setEditAwayFlag("🇺🇸");
                            else if (val === "Áustria") setEditAwayFlag("🇦🇹");
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="">-- Escolha um país oficial --</option>
                          {editAwayTeam && !Object.keys(TEAM_FLAGS).includes(editAwayTeam) && (
                            <option value={editAwayTeam}>{editAwayTeam}</option>
                          )}
                          {Object.keys(TEAM_FLAGS).sort().map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editAwayTeam}
                          placeholder="Ou defina nome manual..."
                          onChange={(e) => setEditAwayTeam(e.target.value)}
                          className="w-full bg-zinc-950/80 border border-zinc-850 rounded px-3 py-1 mt-1 text-[11px] text-zinc-300 outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Emoji Visitante</label>
                        <input
                          type="text"
                          value={editAwayFlag}
                          onChange={(e) => setEditAwayFlag(e.target.value)}
                          placeholder="🇦🇷"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-center text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Estádio</label>
                        <input
                          type="text"
                          value={editMatchStadium}
                          onChange={(e) => setEditMatchStadium(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Cidade</label>
                        <input
                          type="text"
                          value={editMatchCity}
                          onChange={(e) => setEditMatchCity(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Fase / Grupo</label>
                        <input
                          type="text"
                          value={editMatchGroup}
                          onChange={(e) => setEditMatchGroup(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-zinc-500 uppercase font-black mb-1">Data ISO / UTC</label>
                        <input
                          type="text"
                          value={editMatchDate}
                          onChange={(e) => setEditMatchDate(e.target.value)}
                          placeholder="2026-06-30T19:00:00Z"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
                      <button
                        onClick={() => setEditingFullMatchId(null)}
                        className="px-3 py-1.5 rounded text-xs bg-zinc-900 font-sans cursor-pointer hover:bg-zinc-800 text-zinc-400"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleUpdateMatchInfo(match.id)}
                        className="px-3 py-1.5 rounded text-xs bg-orange-500 font-sans font-bold text-white cursor-pointer hover:bg-orange-600"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={match.id}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    match.status === "finished"
                      ? "bg-zinc-950/30 border-zinc-850/80"
                      : "bg-zinc-950/80 border-orange-500/20"
                  }`}
                >
                  {/* Meta context info */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mb-2.5">
                    <span className="uppercase">{match.group} {match.roundNumber !== 4 && `• Rd ${getGroupStageMatchRodada(match, matches)}`}</span>
                    <span>{match.stadium} • {match.city}</span>
                  </div>

                  {/* Main Center Stage */}
                  <div className="flex items-center justify-between py-2">
                    
                    {/* Team Home */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="font-sans font-extrabold text-sm text-white hidden sm:inline text-right">
                        {match.homeTeam}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 sm:hidden block text-right">
                        {match.homeTeam.substring(0,3)}
                      </span>
                      <img 
                        src={getFlagUrl(match.homeTeam)} 
                        alt="" 
                        className="w-7 h-4.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Mid score board */}
                    <div className="flex items-center gap-1.5 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            maxLength={2}
                            value={editHomeScore}
                            onChange={(e) => setEditHomeScore(e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-10 h-10 bg-zinc-900 border border-orange-500 text-center font-mono font-bold text-white text-lg rounded-lg outline-none"
                          />
                          <span className="text-zinc-500 text-sm font-bold">x</span>
                          <input
                            type="text"
                            maxLength={2}
                            value={editAwayScore}
                            onChange={(e) => setEditAwayScore(e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-10 h-10 bg-zinc-900 border border-orange-500 text-center font-mono font-bold text-white text-lg rounded-lg outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {match.homeScore !== null ? (
                            <span className="px-3 py-1 bg-zinc-910 border border-zinc-800 rounded font-mono font-bold text-lg text-yellow-550">
                              {match.homeScore}
                            </span>
                          ) : (
                            <span className="text-zinc-650 font-bold">-</span>
                          )}
                          <span className="text-zinc-600 text-xs">x</span>
                          {match.awayScore !== null ? (
                            <span className="px-3 py-1 bg-zinc-910 border border-zinc-800 rounded font-mono font-bold text-lg text-yellow-550">
                              {match.awayScore}
                            </span>
                          ) : (
                            <span className="text-zinc-650 font-bold">-</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Team Away */}
                    <div className="flex items-center gap-2 flex-1">
                      <img 
                        src={getFlagUrl(match.awayTeam)} 
                        alt="" 
                        className="w-7 h-4.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-sans font-extrabold text-sm text-white hidden sm:inline flex-grow">
                        {match.awayTeam}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 sm:hidden block">
                        {match.awayTeam.substring(0,3)}
                      </span>
                    </div>

                  </div>

                  {/* Launch Deck Options */}
                  <div className="mt-4 flex justify-between items-center border-t border-zinc-900 pt-3">
                    <div className="text-[10px] font-mono text-zinc-500">
                      {new Date(match.date).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingMatchId(null)}
                            className="px-2.5 py-1 text-xs text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded font-sans cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveMatchScore(match.id)}
                            className="px-3 py-1 text-xs text-neutral-950 bg-emerald-400 hover:bg-emerald-500 rounded font-sans font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} /> Salvar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingMatchId(match.id);
                              setEditHomeScore(match.homeScore !== null ? String(match.homeScore) : "");
                              setEditAwayScore(match.awayScore !== null ? String(match.awayScore) : "");
                            }}
                            className="px-2.5 py-1 text-xs text-white bg-zinc-800 hover:bg-zinc-700 rounded font-sans flex items-center gap-1 cursor-pointer transition-all border border-zinc-750"
                          >
                            <Play size={10} className="text-emerald-400" /> Lançar Placar
                          </button>
                          <button
                            onClick={() => {
                              setEditingFullMatchId(match.id);
                              setEditHomeTeam(match.homeTeam);
                              setEditAwayTeam(match.awayTeam);
                              setEditHomeFlag(match.homeFlag);
                              setEditAwayFlag(match.awayFlag);
                              setEditMatchGroup(match.group);
                              setEditMatchStadium(match.stadium);
                              setEditMatchCity(match.city);
                              setEditMatchDate(match.date);
                            }}
                            className="px-2.5 py-1 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded font-sans flex items-center gap-1 cursor-pointer transition-all border border-zinc-750"
                          >
                            <Edit size={10} className="text-amber-400" /> Configurar
                          </button>
                          {match.status === "finished" && (
                            <button
                              onClick={() => handleClearMatchScore(match)}
                              className="p-1 px-1.5 text-[10px] text-red-400 hover:bg-red-950/20 rounded font-sans flex items-center gap-0.5 cursor-pointer"
                              title="Anular Resultado"
                            >
                              Anular
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Manual Knockout advancing trigger tool */}
                  {match.roundNumber === 4 && !isPlaceholderTeamName(match.homeTeam) && !isPlaceholderTeamName(match.awayTeam) && (
                    <div className="mt-3.5 pt-3 border-t border-zinc-900/80 flex flex-col gap-1.5">
                      <div className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1 text-left">
                        <Trophy size={11} className="text-yellow-400" />
                        Avançar time para a próxima fase:
                      </div>
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => handleSetKnockoutWinner(match.id, match.homeTeam)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-emerald-950/30 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/20 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-transform hover:-translate-y-0.5 shadow-sm"
                        >
                          🏆 {match.homeTeam}
                        </button>
                        <button
                          onClick={() => handleSetKnockoutWinner(match.id, match.awayTeam)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-emerald-950/30 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/20 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-transform hover:-translate-y-0.5 shadow-sm"
                        >
                          🏆 {match.awayTeam}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            };

            // Group division layout
            if (matchFilterRound <= 3) {
              return (
                <div className="space-y-8">
                  {GROUPS_LIST.map((groupName) => {
                    const groupMatches = matches.filter(
                      (m) => m.group === groupName && getGroupStageMatchRodada(m, matches) === matchFilterRound
                    );
                    if (groupMatches.length === 0) return null;

                    return (
                      <div key={groupName} className="bg-zinc-950/30 border border-zinc-850/60 rounded-2xl p-4 md:p-5 relative overflow-hidden shadow-inner">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                        <div className="text-sm font-black font-sans text-orange-400 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-zinc-900 pb-2 pl-2">
                          {groupName}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {groupMatches.map(renderMatchAdminCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            } else {
              // Knockout (Mata-Mata) Layout grouped by stages
              const koMatches = matches.filter(
                (m) =>
                  m.roundNumber === 4 ||
                  m.id.startsWith("copa_r32") ||
                  m.id.startsWith("copa_r16") ||
                  m.id.startsWith("copa_q8") ||
                  m.id.startsWith("copa_s4") ||
                  m.id.startsWith("copa_f2")
              );

              return (
                <div className="space-y-8">
                  {STAGES.map((stage) => {
                    const stageMatches = koMatches.filter((m) => m.id.startsWith(stage.prefix))
                      .sort((a, b) => {
                        const idxA = parseInt(a.id.replace(stage.prefix, ""), 10);
                        const idxB = parseInt(b.id.replace(stage.prefix, ""), 10);
                        return idxA - idxB;
                      });

                    if (stageMatches.length === 0) return null;

                    return (
                      <div key={stage.id} className="bg-zinc-950/30 border border-zinc-850/60 rounded-2xl p-4 md:p-5 relative overflow-hidden shadow-inner">
                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
                        <div className="text-sm font-black font-sans text-yellow-400 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-zinc-900 pb-2 pl-2">
                          {stage.title}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {stageMatches.map(renderMatchAdminCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }
          })()}

        </div>
      )}

      {activeTab === "rodadas" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-850 pb-4 mb-6 gap-4">
            <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
              <Calendar size={18} className="text-orange-500" />
              Auditoria de Apostas por Aluno
            </h2>
            
            {/* Filter */}
            <div className="flex bg-zinc-950 p-1 border border-zinc-500/20 rounded-lg text-xs font-mono">
              {[1, 2, 3, 4].map((r) => (
                <button
                  key={r}
                  onClick={() => { sounds.playClick(); setStatsRound(r); }}
                  className={`px-3 py-1.5 rounded font-sans transition-all cursor-pointer ${
                    statsRound === r
                      ? "bg-orange-500 text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Rodada {r}
                </button>
              ))}
            </div>
          </div>

          {/* Statistical layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Box 1: Completou as Apostas */}
            <div className="bg-zinc-950/60 border border-emerald-950 p-5 rounded-xl">
              <div className="text-sm font-sans font-bold text-emerald-400 flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Já Apostaram nesta Rodada ({currentRoundStats.usersWhoBet.length})
              </div>
              
              {currentRoundStats.usersWhoBet.length === 0 ? (
                <div className="text-sm text-zinc-500 font-sans py-4 text-center">
                  Ninguém apostou nesta rodada ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {currentRoundStats.usersWhoBet.map((u) => {
                    const studentBets = bets.filter(b => b.userId === u.id && matches.filter(m => m.roundNumber === statsRound).some(m => m.id === b.matchId));
                    return (
                      <div key={u.id} className="flex items-center justify-between gap-2 p-2 bg-zinc-900/40 rounded border border-zinc-900 text-xs">
                        <div className="flex items-center gap-2">
                          <CartolaShield avatarString={u.avatar} size={24} />
                          <span className="font-sans font-bold text-zinc-300">{u.name}</span>
                        </div>
                        <span className="font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded">
                          {studentBets.length} de {currentRoundStats.roundMatchesCount} jogos
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Box 2: Pendentes de Aposta */}
            <div className="bg-zinc-950/60 border border-rose-950 p-5 rounded-xl">
              <div className="text-sm font-sans font-bold text-rose-400 flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                Não apostaram nada na Rodada ({currentRoundStats.usersNoBet.length})
              </div>

              {currentRoundStats.usersNoBet.length === 0 ? (
                <div className="text-sm text-zinc-500 font-sans py-4 text-center">
                  100% da sala 3A já está em dia com esta rodada! 🎉
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {currentRoundStats.usersNoBet.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 p-2 bg-zinc-900/40 rounded border border-zinc-900 text-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <CartolaShield avatarString={u.avatar} size={24} />
                        <span className="font-sans font-bold text-zinc-300">{u.name}</span>
                      </div>
                      <span className="font-mono text-rose-400 font-bold bg-rose-950/20 px-2.5 py-0.5 rounded border border-rose-500/20">
                        Pendente
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Quick Notice */}
          <div className="mt-8 p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center gap-3 text-xs font-mono text-zinc-400">
            <AlertTriangle size={16} className="text-yellow-500 flex-shrink-0" />
            <span>
              <strong>Dica do Painel:</strong> Lembre que as apostas travam automaticamente exatamente 5 minutos antes da partida que abre cada rodada começar. Estimule a sala 3A Américo a apostar o mais cedo possível!
            </span>
          </div>

        </div>
      )}

      {activeTab === "bracket" && (
        <div className="animate-fade-in">
          <TournamentBracket matches={matches} currentUser={{ id: "admin", name: "Professor Admin", role: "admin" }} />
        </div>
      )}

    </div>
  );
};
export default AdminPanel;

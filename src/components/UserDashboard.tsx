import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { MatchData, ROUND_NAMES, getFlagUrl, calculateGroupStandings } from "../data/worldCupMatches";
import { TournamentBracket } from "./TournamentBracket";
import {
  CartolaShield,
  serializeShield,
  parseShieldString,
  SHAPE_OPTIONS,
  PATTERN_OPTIONS,
  SYMBOL_OPTIONS,
  PRESET_COLORS,
  ShieldConfig
} from "./CartolaShield";
import {
  Trophy,
  Calendar,
  Lock,
  Unlock,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Compass,
  Smile,
  CheckCircle,
  TrendingUp,
  Award,
  ChevronRight,
  RefreshCw,
  LogOut,
  Info
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

interface UserDashboardProps {
  currentUser: StudentUser;
  onLogout: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, onLogout }) => {
  const [activeSubTab, setActiveSubTab] = useState<"bets" | "customizer" | "ranking" | "groups" | "bracket">("bets");
  const [selectedGroupDashboard, setSelectedGroupDashboard] = useState<string>("Grupo A");
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [users, setUsers] = useState<StudentUser[]>([]);
  
  // Shield customizer state initialized from current user values
  const initConfig = parseShieldString(currentUser.avatar);
  const [shieldShape, setShieldShape] = useState(initConfig.shape);
  const [shieldPattern, setShieldPattern] = useState(initConfig.pattern);
  const [shieldColor1, setShieldColor1] = useState(initConfig.color1);
  const [shieldColor2, setShieldColor2] = useState(initConfig.color2);
  const [shieldSymbol, setShieldSymbol] = useState(initConfig.symbol);
  
  // Sound board toggle
  const [soundEnabled, setSoundEnabled] = useState(sounds.isEnabled());

  // Input state for user predictions
  // Structure: { [matchId]: { homeBet: string, awayBet: string } }
  const [predictionInputs, setPredictionInputs] = useState<Record<string, { home: string, away: string }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const [activeBetRound, setActiveBetRound] = useState<number>(1);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string, type: "success" | "error" } | null>(null);

  // Countdown clock state
  const [timeLeftString, setTimeLeftString] = useState<string>("");
  const [isRoundLocked, setIsRoundLocked] = useState<boolean>(false);

  // Listen to Firestore real-time collections
  useEffect(() => {
    // 1. Fetch matches
    const unsubMatches = onSnapshot(collection(db, "matches"), (snapshot) => {
      const mList: MatchData[] = [];
      snapshot.forEach((doc) => {
        mList.push({ id: doc.id, ...doc.data() } as MatchData);
      });
      mList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMatches(mList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "matches");
    });

    // 2. Fetch ranking list
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const uList: StudentUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role !== "admin") {
          uList.push({ id: doc.id, ...data } as StudentUser);
        }
      });
      uList.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      setUsers(uList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    // 3. Fetch user bets
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
      unsubMatches();
      unsubUsers();
      unsubBets();
    };
  }, []);

  // Update local prediction inputs when matches and bets are downloaded
  useEffect(() => {
    const freshInputs: Record<string, { home: string, away: string }> = {};
    matches.forEach((m) => {
      // Find wager associated with match
      const wager = bets.find((b) => b.userId === currentUser.id && b.matchId === m.id);
      if (wager) {
        freshInputs[m.id] = {
          home: String(wager.homeTeamBet),
          away: String(wager.awayTeamBet)
        };
      } else {
        // Empty placeholder values
        freshInputs[m.id] = { home: "", away: "" };
      }
    });
    setPredictionInputs(freshInputs);
  }, [matches, bets, currentUser.id]);

  // Locked-Out / Countdown Timer Calculations
  useEffect(() => {
    const calculateCountdown = () => {
      const activeMatchRoster = matches.filter(m => m.roundNumber === activeBetRound);
      if (activeMatchRoster.length === 0) {
        setTimeLeftString("Sem jogos");
        setIsRoundLocked(false);
        return;
      }

      // Earliest match start time of active round
      const startDates = activeMatchRoster.map(m => new Date(m.date).getTime());
      const firstGameStart = Math.min(...startDates);

      // Lock time is exactly 5 minutes before kickoff
      const lockTimestamp = firstGameStart - 5 * 60 * 1000;
      const currentSimulatedTime = Date.now(); // 2026-05-27 simulated timezone

      const diffMs = lockTimestamp - currentSimulatedTime;

      if (diffMs <= 0) {
        setTimeLeftString("FECHADO PARA APOSTAS 🔒");
        setIsRoundLocked(true);
      } else {
        setIsRoundLocked(false);
        // Calculate days, hours, minutes, seconds remaining
        const secs = Math.floor(diffMs / 1000);
        const mins = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        const d = Math.floor(hours / 24);

        const sLeft = secs % 60;
        const mLeft = mins % 60;
        const hLeft = hours % 24;

        if (d > 0) {
          setTimeLeftString(`${d}d ${hLeft}h ${mLeft}m ${sLeft}s`);
        } else {
          setTimeLeftString(`${hLeft}h ${mLeft}m ${sLeft}s`);
        }
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [matches, activeBetRound]);

  // Toggle Sounds Wrapper
  const handleToggleSound = () => {
    sounds.playClick();
    const nextState = sounds.toggle();
    setSoundEnabled(nextState);
  };

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Profile Shield Saver
  const handleSaveCrestCrest = async () => {
    sounds.playClick();
    const config: ShieldConfig = {
      shape: shieldShape,
      pattern: shieldPattern,
      color1: shieldColor1,
      color2: shieldColor2,
      symbol: shieldSymbol
    };
    const avatarStr = serializeShield(config);
    try {
      await setDoc(doc(db, "users", currentUser.id), {
        avatar: avatarStr
      }, { merge: true });
      sounds.playWhistle();
      showNotification("Escudo do time atualizado com sucesso!");
    } catch (e: any) {
      showNotification("Erro ao atualizar escudo: " + e.message, "error");
    }
  };

  // Individual Wager Save
  const handleSaveIndividualBet = async (matchId: string) => {
    sounds.playClick();
    if (isRoundLocked) {
      showNotification("Esta rodada já se encontra travada!", "error");
      return;
    }

    const matchInput = predictionInputs[matchId];
    if (!matchInput || matchInput.home === "" || matchInput.away === "") {
      showNotification("Preencha ambos os placares para salvar!", "error");
      return;
    }

    const homeGuess = parseInt(matchInput.home);
    const awayGuess = parseInt(matchInput.away);

    if (isNaN(homeGuess) || isNaN(awayGuess) || homeGuess < 0 || awayGuess < 0) {
      showNotification("Placar deve ser um número maior ou igual a 0", "error");
      return;
    }

    setSaveStatus(prev => ({ ...prev, [matchId]: "saving" }));

    try {
      const compositeKey = `${currentUser.id}_${matchId}`;
      await setDoc(doc(db, "bets", compositeKey), {
        userId: currentUser.id,
        matchId: matchId,
        homeTeamBet: homeGuess,
        awayTeamBet: awayGuess,
        pointsEarned: null, // calculated when admin adds results
        updatedAt: new Date().toISOString()
      });

      setSaveStatus(prev => ({ ...prev, [matchId]: "saved" }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [matchId]: "idle" }));
      }, 2000);
      showNotification("Palpite salvo no servidor!");
    } catch (e: any) {
      setSaveStatus(prev => ({ ...prev, [matchId]: "idle" }));
      showNotification("Erro ao salvar palpite: " + e.message, "error");
    }
  };

  const handleScoreInputChange = (matchId: string, side: "home" | "away", val: string) => {
    const formatted = val.replace(/[^0-9]/g, ""); // strip anything but numbers
    setPredictionInputs(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: formatted
      }
    }));
  };

  // Find users standing ranks
  const myStandingIndex = users.findIndex(u => u.id === currentUser.id);
  const myRank = myStandingIndex !== -1 ? myStandingIndex + 1 : "-";
  const myActualRecord = users[myStandingIndex] || currentUser;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-0 py-4" id="student_dashboard">
      
      {/* Dynamic Player Banner Widget */}
      <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Pitch line graphics decoration */}
        <div className="absolute inset-y-0 right-1/4 w-0.5 bg-zinc-800/20" />
        <div className="absolute top-1/2 right-1/4 w-12 h-12 rounded-full border border-zinc-800/20 translate-x-1/2 -translate-y-1/2" />

        {/* Left: Player Profile with shield and score highlights */}
        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <CartolaShield avatarString={myActualRecord.avatar} size={72} />
          <div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Estudante Conectado - Aluno 3A
            </div>
            <h1 className="text-2xl font-black text-white font-sans tracking-tight">
              {currentUser.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 mt-1">
              <span className="font-bold text-yellow-500">🏆 Posição: {myRank}º</span>
              <span className="opacity-40">•</span>
              <span className="text-emerald-400">🔥 Pontos: {myActualRecord.score}</span>
              <span className="opacity-40">•</span>
              <span className="text-zinc-500" title="Acertos exatos do placar">🎯 {myActualRecord.exactMatches}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Settings panel Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end relative z-10">
          
          {/* Sound control Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Sons de torcida"
          >
            {soundEnabled ? <Volume2 size={18} className="text-green-400" /> : <VolumeX size={18} />}
          </button>

          {/* Sair */}
          <button
            onClick={() => { sounds.playClick(); onLogout(); }}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-800 rounded-xl font-sans text-xs font-bold text-zinc-400 hover:text-white bg-zinc-950/60 hover:bg-zinc-900 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap sm:flex-nowrap bg-zinc-900 border border-zinc-800 p-1 rounded-2xl mb-8 gap-1">
        <button
          onClick={() => { sounds.playClick(); setActiveSubTab("bets"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "bets"
              ? "bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-950/60"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Calendar size={15} />
          <span>Meus Palpites</span>
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveSubTab("customizer"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "customizer"
              ? "bg-emerald-500 text-neutral-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Smile size={15} />
          <span>Escudo do Time</span>
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveSubTab("ranking"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "ranking"
              ? "bg-emerald-500 text-neutral-950 shadow-md"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Trophy size={15} />
          <span>Ranking 3A</span>
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveSubTab("groups"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "groups"
              ? "bg-emerald-500 text-neutral-950 shadow-md focus:outline-none"
              : "text-zinc-400 hover:text-white font-medium"
          }`}
        >
          <Compass size={15} />
          <span>Tabela de Grupos</span>
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveSubTab("bracket"); }}
          className={`flex-grow md:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "bracket"
              ? "bg-emerald-500 text-neutral-950 shadow-md focus:outline-none"
              : "text-zinc-400 hover:text-white font-medium"
          }`}
        >
          <Trophy size={15} />
          <span>Mata-Mata</span>
        </button>
      </div>

      {/* Toast notifications */}
      {feedbackMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl flex items-center gap-3 border shadow-xl text-sm font-sans animate-fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-950 border-emerald-500 text-emerald-300"
              : "bg-red-950 border-red-500 text-red-300"
          }`}
          id="toast_toast"
        >
          <CheckCircle size={18} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* SUB-PAGES DECK */}
      {activeSubTab === "bets" && (
        <div className="space-y-6">
          
          {/* Round Filtering panel with Locker Status Clock */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
            
            {/* L1: Filter rodadas */}
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Escolher Rodada
              </label>
              <div className="flex bg-zinc-950 p-1 border border-zinc-850 rounded-lg text-xs font-mono">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    onClick={() => { sounds.playClick(); setActiveBetRound(r); }}
                    className={`flex-1 px-3 py-2 rounded font-sans transition-all cursor-pointer ${
                      activeBetRound === r
                        ? "bg-zinc-800 text-white font-extrabold"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    R{r}
                  </button>
                ))}
              </div>
            </div>

            {/* L2: Countdown Indicator */}
            <div className="lg:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl">
              <div>
                <div className="text-[10px] uppercase font-mono font-black tracking-wider text-zinc-500 flex items-center gap-1.5 mb-1">
                  <Clock size={12} className="text-orange-500 animate-spin" />
                  Prazo Limite da Rodada
                </div>
                <div className="text-sm font-sans text-zinc-300">
                  Bloqueio acontece 5 min antes da rodada começar
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isRoundLocked ? (
                  <div className="px-4 py-2 bg-rose-950/50 border border-rose-500 text-rose-300 font-mono text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <Lock size={14} />
                    RODADA BLOQUEADA
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-emerald-950/50 border border-emerald-500 text-emerald-300 font-mono text-sm font-extrabold rounded-lg flex items-center gap-1.5 animate-pulse">
                    <Unlock size={14} />
                    FECHAMENTO: {timeLeftString}
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="text-zinc-400 font-mono text-sm bg-zinc-950/40 p-3 rounded-lg border border-zinc-850">
            Filtrando Ativo: <span className="text-emerald-400 uppercase font-black">{ROUND_NAMES[activeBetRound]}</span>
          </div>

          {/* Match betting tiles */}
          {matches.filter(m => m.roundNumber === activeBetRound).length === 0 ? (
            <div className="text-center py-20 text-zinc-500 font-sans border border-dashed border-zinc-800 rounded-3xl">
              Nenhum jogo nesta rodada foi liberado pelo Administrador da sala 3A ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {matches
                .filter((m) => m.roundNumber === activeBetRound)
                .map((match) => {
                  const betVal = predictionInputs[match.id] || { home: "", away: "" };
                  const userSavedBet = bets.find(b => b.userId === currentUser.id && b.matchId === match.id);
                  const isMatchFinished = match.status === "finished";
                  const myCurrentPoints = userSavedBet?.pointsEarned;

                  return (
                    <div
                      key={match.id}
                      className={`relative p-5 rounded-2xl border transition-all ${
                        isRoundLocked || isMatchFinished
                          ? "bg-zinc-950/35 border-zinc-850/80"
                          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      
                      {/* Top metadata info row */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-3.5 pb-2.5 border-b border-zinc-800/50">
                        <span className="uppercase text-zinc-400 font-bold">{match.group}</span>
                        <span>{match.stadium} • {match.city}</span>
                      </div>

                      {/* Main grid team scoreboard layout */}
                      <div className="flex items-center justify-between py-3">
                        
                        {/* Team Home */}
                        <div className="flex items-center gap-2.5 flex-1 justify-end">
                          <span className="font-sans font-bold text-sm text-zinc-100 hidden sm:inline text-right flex-grow">
                            {match.homeTeam}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-zinc-300 sm:hidden">
                            {match.homeTeam.substring(0,3)}
                          </span>
                          <img 
                            src={getFlagUrl(match.homeTeam)} 
                            alt="" 
                            className="w-8 h-5.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Middle: User Bet Input Boxes */}
                        <div className="flex items-center gap-1 px-4">
                          {isRoundLocked || isMatchFinished ? (
                            // Rendered static bets when lock is on
                            <div className="flex items-center gap-1">
                              <span className="w-10 h-10 bg-zinc-950/80 border border-zinc-850 text-white rounded-lg flex items-center justify-center font-mono font-bold text-base">
                                {userSavedBet ? userSavedBet.homeTeamBet : "-"}
                              </span>
                              <span className="text-zinc-650 font-bold font-mono text-xs">x</span>
                              <span className="w-10 h-10 bg-zinc-950/80 border border-zinc-850 text-white rounded-lg flex items-center justify-center font-mono font-bold text-base">
                                {userSavedBet ? userSavedBet.awayTeamBet : "-"}
                              </span>
                            </div>
                          ) : (
                            // Input mode
                            <div className="flex items-center gap-1.5 animate-pulse-once">
                              <input
                                type="text"
                                maxLength={2}
                                value={betVal.home}
                                placeholder="0"
                                onChange={(e) => handleScoreInputChange(match.id, "home", e.target.value)}
                                className="w-10 h-10 bg-zinc-950 border border-zinc-800 text-center font-mono text-base font-bold text-emerald-400 focus:border-emerald-500 focus:shadow-sm focus:shadow-emerald-900/50 outline-none rounded-lg transition-all"
                              />
                              <span className="text-zinc-600 font-bold text-[10px] font-mono">x</span>
                              <input
                                type="text"
                                maxLength={2}
                                value={betVal.away}
                                placeholder="0"
                                onChange={(e) => handleScoreInputChange(match.id, "away", e.target.value)}
                                className="w-10 h-10 bg-zinc-950 border border-zinc-800 text-center font-mono text-base font-bold text-emerald-400 focus:border-emerald-500 focus:shadow-sm focus:shadow-emerald-900/50 outline-none rounded-lg transition-all"
                              />
                            </div>
                          )}
                        </div>

                        {/* Team Away */}
                        <div className="flex items-center gap-2.5 flex-1 select-none">
                          <img 
                            src={getFlagUrl(match.awayTeam)} 
                            alt="" 
                            className="w-8 h-5.5 object-cover rounded shadow border border-zinc-805 flex-shrink-0"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-sans font-bold text-sm text-zinc-100 hidden sm:inline flex-grow">
                            {match.awayTeam}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-zinc-300 sm:hidden">
                            {match.awayTeam.substring(0,3)}
                          </span>
                        </div>

                      </div>

                      {/* Footer Info: Show user saves or calculated scores */}
                      <div className="flex items-center justify-between border-t border-zinc-850/50 pt-3.5 mt-2 text-[10px] font-mono text-zinc-500">
                        
                        {/* Time of kickoff */}
                        <div>
                          {new Date(match.date).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>

                        {/* Score Result Status check & Bet saving */}
                        <div>
                          {isMatchFinished ? (
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850 text-[10px]">
                                Placar Oficial: {match.homeScore} x {match.awayScore}
                              </span>
                              {myCurrentPoints !== null && myCurrentPoints !== undefined ? (
                                <span className={`px-2 py-0.5 font-sans font-black rounded-full ${
                                  myCurrentPoints === 3
                                    ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-950 shadow-md animate-bounce"
                                    : myCurrentPoints === 1
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-zinc-850 text-zinc-500"
                                }`}>
                                  {myCurrentPoints === 3 ? "🎯 CRAVOU! +3pts" : myCurrentPoints === 1 ? "👍 ACERTOU! +1pt" : "❌ 0 pts"}
                                </span>
                              ) : (
                                <span className="text-zinc-500">Recalculando...</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Status indicators */}
                              {isRoundLocked ? (
                                <span className="text-rose-400 flex items-center gap-1">
                                  <Lock size={12} /> Aposta Travada
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {userSavedBet && (
                                    <span className="text-emerald-400 font-sans font-semibold text-[10px]">
                                      ✓ Salvo no Servidor
                                    </span>
                                  )}
                                  
                                  <button
                                    onClick={() => handleSaveIndividualBet(match.id)}
                                    disabled={saveStatus[match.id] === "saving"}
                                    className={`px-3 py-1.5 font-sans text-xs font-bold rounded-lg cursor-pointer ${
                                      saveStatus[match.id] === "saved"
                                        ? "bg-green-500 text-neutral-950"
                                        : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                                    }`}
                                  >
                                    {saveStatus[match.id] === "saving" ? "Salvando..." : saveStatus[match.id] === "saved" ? "✓ Salvo" : "Salvar Palpite"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })}
            </div>
          )}

        </div>
      )}

      {activeSubTab === "customizer" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl">
          
          {/* Left Block: Design Selection */}
          <div className="space-y-6">
            
            <div className="pb-3 border-b border-zinc-800">
              <h2 className="text-xl font-bold font-sans text-white">Criador de Brasão Cartola FC</h2>
              <p className="text-sm text-zinc-400 mt-1">Configure o brasão representativo de seu time para o topo do ranking da sala 3A.</p>
            </div>

            {/* Shape Choices */}
            <div>
              <label className="block text-xs font-mono font-extrabold text-zinc-400 uppercase tracking-widest mb-2">
                1. Formato do Escudo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SHAPE_OPTIONS.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => { sounds.playClick(); setShieldShape(shape.id); }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      shieldShape === shape.id
                        ? "bg-zinc-800 border-emerald-500"
                        : "bg-zinc-950 border-zinc-850 hover:border-zinc-800"
                    }`}
                  >
                    <div className="font-sans font-bold text-xs text-white capitalize">{shape.label}</div>
                    <div className="text-[10px] text-zinc-500 tracking-tight mt-0.5">{shape.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern options */}
            <div>
              <label className="block text-xs font-mono font-extrabold text-zinc-400 uppercase tracking-widest mb-2">
                2. Estampa de Preenchimento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PATTERN_OPTIONS.map((pat) => (
                  <button
                    key={pat.id}
                    onClick={() => { sounds.playClick(); setShieldPattern(pat.id); }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      shieldPattern === pat.id
                        ? "bg-zinc-800 border-emerald-500"
                        : "bg-zinc-950 border-zinc-850 hover:border-zinc-800"
                    }`}
                  >
                    <div className="font-sans font-bold text-xs text-white capitalize">{pat.label}</div>
                    <div className="text-[10px] text-zinc-500 tracking-tight mt-0.5">{pat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dual color selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Color 1 */}
              <div>
                <label className="block text-xs font-mono font-extrabold text-zinc-400 uppercase tracking-widest mb-2">
                  3. Cor Primária
                </label>
                <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => { sounds.playClick(); setShieldColor1(hex); }}
                      className={`h-6 w-6 rounded-full border cursor-pointer transition-transform hover:scale-110 ${
                        shieldColor1 === hex ? "border-white scale-105" : "border-transparent"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Color 2 */}
              <div>
                <label className="block text-xs font-mono font-extrabold text-zinc-400 uppercase tracking-widest mb-2">
                  4. Cor Secundária
                </label>
                <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => { sounds.playClick(); setShieldColor2(hex); }}
                      className={`h-6 w-6 rounded-full border cursor-pointer transition-transform hover:scale-110 ${
                        shieldColor2 === hex ? "border-white scale-105" : "border-transparent"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Central Symbol element */}
            <div>
              <label className="block text-xs font-mono font-extrabold text-zinc-400 uppercase tracking-widest mb-2">
                5. Emblema do Centro
              </label>
              <div className="flex flex-wrap gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                {SYMBOL_OPTIONS.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => { sounds.playClick(); setShieldSymbol(sym); }}
                    className={`h-10 w-10 flex items-center justify-center text-xl rounded-lg border cursor-pointer transition-all ${
                      shieldSymbol === sym
                        ? "bg-zinc-800 border-emerald-500 scale-105 shadow-md shadow-emerald-900/50"
                        : "bg-zinc-900 border-transparent hover:bg-zinc-850"
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Block: Shield Canvas Render Previews */}
          <div className="flex flex-col items-center justify-center bg-zinc-950 rounded-2xl p-8 border border-zinc-850 relative">
            <div className="absolute top-4 left-4 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Live Mockup Preview
            </div>

            {/* Shield item preview */}
            <div className="animate-pulse-slow p-6 rounded-full border border-zinc-800 bg-zinc-900/40 relative">
              <CartolaShield
                avatarString={`${shieldShape}|${shieldPattern}|${shieldColor1}|${shieldColor2}|${shieldSymbol}`}
                size={160}
              />
            </div>

            <div className="text-center mt-6">
              <div className="font-sans font-black text-white text-lg">
                Esporte Clube {currentUser.name}
              </div>
              <div className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                Tema: {shieldShape} | {shieldPattern}
              </div>
            </div>

            <button
              onClick={handleSaveCrestCrest}
              className="mt-8 px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 font-sans text-sm font-bold text-neutral-950 rounded-xl shadow-lg cursor-pointer transition-all"
            >
              Confirmar e Salvar Brasão
            </button>
          </div>

        </div>
      )}

      {activeSubTab === "ranking" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-850 pb-5 mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
                <Trophy size={20} className="text-yellow-500" />
                Tabela Geral da Sala 3A
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Ranking em tempo real calculado instantaneamente a cada placar lançado.</p>
            </div>
            
            <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1.5 border border-zinc-850 rounded-lg">
              Em disputa rápida por posições
            </div>
          </div>

          {/* Ranking Board List */}
          {users.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 font-sans">
              Nenhum participante rascunhado para exibir o ranking geral. O administrador precisa cadastrar alunos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                    <th className="py-3 px-4">Pos</th>
                    <th className="py-3 px-2">Escudo</th>
                    <th className="py-3 px-4">Aluno</th>
                    <th className="py-3 px-4 text-center">Pontos</th>
                    <th className="py-3 px-4 text-center">🎯 Cravadas (3p)</th>
                    <th className="py-3 px-4 text-center">👍 Vencedor (1p)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60">
                  {users.map((stdInRank, index) => {
                    const isTopThree = index < 3;
                    const badgeStyles = [
                      "bg-gradient-to-r from-yellow-400 to-amber-500 text-neutral-950 font-sans shadow-md",
                      "bg-slate-300 text-slate-900 font-sans",
                      "bg-amber-700 text-amber-100 font-sans"
                    ];

                    return (
                      <tr
                        key={stdInRank.id}
                        className={`transition-colors font-sans py-4 ${
                          stdInRank.id === currentUser.id
                            ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                            : "hover:bg-zinc-950/20"
                        }`}
                      >
                        {/* 1. Standing Pos */}
                        <td className="py-4 px-4 w-12">
                          <div className="flex items-center justify-center">
                            {isTopThree ? (
                              <span className={`h-6 w-6 rounded-full font-black text-xs flex items-center justify-center ${badgeStyles[index]}`}>
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-mono font-bold text-sm">
                                {index + 1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Shield badge icon */}
                        <td className="py-4 px-2 w-14">
                          <CartolaShield avatarString={stdInRank.avatar} size={36} />
                        </td>

                        {/* 3. Name */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-white text-base flex items-center gap-2">
                            {stdInRank.name}
                            {stdInRank.id === currentUser.id && (
                              <span className="px-1.5 py-0.5 text-[9px] text-emerald-400 font-sans bg-emerald-950/60 border border-emerald-500/30 rounded">
                                Você
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Score */}
                        <td className="py-4 px-4 text-center w-28">
                          <span className="font-mono text-lg font-black text-emerald-400">
                            {stdInRank.score} <span className="text-xs text-zinc-500 font-medium">pts</span>
                          </span>
                        </td>

                        {/* 5. Exact guesses matches count */}
                        <td className="py-4 px-4 text-center text-sm font-mono text-yellow-500 font-bold">
                          {stdInRank.exactMatches || 0}
                        </td>

                        {/* 6. Outcome count */}
                        <td className="py-4 px-4 text-center text-sm font-mono text-zinc-400">
                          {stdInRank.outcomeMatches || 0}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {activeSubTab === "groups" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-850 pb-5 mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
                <Compass size={20} className="text-blue-500" />
                Classificação dos Grupos da Copa do Mundo
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Cálculo de pontos em tempo real da FIFA (Vitória = 3 pts, Empate = 1 pt).</p>
            </div>
            
            <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1.5 border border-zinc-855 rounded-lg">
              Atualizado em tempo real
            </div>
          </div>

          {/* Group selection quick pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent select-none">
            {["Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H", "Grupo I", "Grupo J", "Grupo K", "Grupo L"].map((groupName) => {
              const letter = groupName.replace("Grupo ", "");
              const isSelected = selectedGroupDashboard === groupName;
              return (
                <button
                  key={groupName}
                  onClick={() => { sounds.playClick(); setSelectedGroupDashboard(groupName); }}
                  className={`px-4 py-2 rounded-xl text-xs font-sans font-extrabold cursor-pointer transition-all flex-shrink-0 ${
                    isSelected
                      ? "bg-emerald-500 text-zinc-950 font-black scale-102 shadow-md shadow-emerald-990/30"
                      : "bg-zinc-950/80 text-zinc-405 hover:text-white border border-zinc-850"
                  }`}
                >
                  Grupo {letter}
                </button>
              );
            })}
          </div>

          {/* Standings Table container */}
          {(() => {
            const standings = calculateGroupStandings(matches);
            const currentGroupStandings = standings[selectedGroupDashboard] || [];

            return (
              <div className="bg-zinc-950/60 border border-zinc-850 rounded-2xl overflow-hidden shadow-inner">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-1 bg-zinc-900/60 p-4 text-[10px] font-mono uppercase font-extrabold text-zinc-400 border-b border-zinc-850/80">
                  <span className="col-span-6 flex items-center">Seleção</span>
                  <span className="col-span-1 text-center font-black text-white">P</span>
                  <span className="col-span-1 text-center">J</span>
                  <span className="col-span-1 text-center">V</span>
                  <span className="col-span-1 text-center">E</span>
                  <span className="col-span-1 text-center font-medium">D</span>
                  <span className="col-span-1 text-center">SG</span>
                </div>

                {currentGroupStandings.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 font-mono text-xs">
                    Nenhuma seleção disputando jogos neste grupo ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-900/40">
                    {currentGroupStandings.map((team, idx) => {
                      const isZone = idx < 2; // top 2 advance
                      return (
                        <div 
                          key={team.name} 
                          className="grid grid-cols-12 gap-1 p-4 items-center text-xs hover:bg-zinc-900/20 transition-all font-sans"
                        >
                          {/* Team Name and flag */}
                          <div className="col-span-6 flex items-center gap-3 min-w-0">
                            <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isZone ? "bg-emerald-500" : "bg-zinc-800"}`} />
                            <span className="font-mono text-xs text-zinc-500 w-4 text-center">
                              {idx + 1}º
                            </span>
                            <img 
                              src={getFlagUrl(team.name)} 
                              alt="" 
                              className="w-7 h-4.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              referrerPolicy="no-referrer"
                            />
                            <span className="font-extrabold text-white truncate text-ellipsis overflow-hidden text-sm">
                              {team.name}
                            </span>
                          </div>

                          {/* Points and stats */}
                          <span className="col-span-1 text-center font-black text-emerald-400 text-sm">
                            {team.points}
                          </span>
                          <span className="col-span-1 text-center font-mono text-zinc-200">
                            {team.played}
                          </span>
                          <span className="col-span-1 text-center font-mono text-zinc-400">
                            {team.wins}
                          </span>
                          <span className="col-span-1 text-center font-mono text-zinc-450">
                            {team.draws}
                          </span>
                          <span className="col-span-1 text-center font-mono text-zinc-500">
                            {team.losses}
                          </span>
                          <span className={`col-span-1 text-center font-mono font-bold ${
                            team.goalDifference > 0 ? "text-emerald-500" : 
                            team.goalDifference < 0 ? "text-red-400" : "text-zinc-500"
                          }`}>
                            {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Legend footer */}
                <div className="p-4 bg-zinc-950/80 border-t border-zinc-900/60 text-[10px] font-mono text-zinc-405 flex flex-wrap gap-x-6 gap-y-2">
                  <span className="flex items-center gap-1.5 text-zinc-350">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Classifica para Segunda Fase
                  </span>
                  <span>•</span>
                  <span>P: Pontos, J: Jogos, V: Vitórias, SG: Saldo de Gols</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeSubTab === "bracket" && (
        <div className="animate-fade-in">
          <TournamentBracket matches={matches} currentUser={currentUser} />
        </div>
      )}

    </div>
  );
};
export default UserDashboard;

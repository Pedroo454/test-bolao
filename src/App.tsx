import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { AdminPanel } from "./components/AdminPanel";
import { UserDashboard } from "./components/UserDashboard";
import { TournamentBracket } from "./components/TournamentBracket";
import { CartolaShield } from "./components/CartolaShield";
import { MatchData, ROUND_NAMES, getFlagUrl, calculateGroupStandings } from "./data/worldCupMatches";
import { 
  Trophy, 
  User, 
  Lock, 
  School, 
  Gamepad2, 
  Activity, 
  Music, 
  Volume2, 
  Compass, 
  Clock, 
  ShieldAlert,
  Info,
  Calendar,
  Users
} from "lucide-react";
import sounds from "./components/SoundEffects";

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<StudentUser | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentUser[]>([]);
  
  // Real-time world cup matches for the home screen
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [activeTabHomepage, setActiveTabHomepage] = useState<"leaderboard" | "fixtures" | "groups" | "bracket">("leaderboard");
  const [fixturesRound, setFixturesRound] = useState<number>(1);
  const [selectedGroupStatic, setSelectedGroupStatic] = useState<string>("Grupo A");

  // Login selections and inputs
  const [loginMode, setLoginMode] = useState<"player" | "admin">("player");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [playerPin, setPlayerPin] = useState<string>("");
  const [adminUser, setAdminUser] = useState<string>("");
  const [adminPass, setAdminPass] = useState<string>("");

  // Error messages
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  // General World Cup countdown ticker
  const [copaCountdown, setCopaCountdown] = useState<string>("");

  // Listen to the users list in real-time for login roster
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: StudentUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role !== "admin") {
          list.push({ id: doc.id, ...data } as StudentUser);
        }
      });
      // Sort alphabetically for easy dropdown navigation
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // Restore session from localStorage if present
      const persistedUser = localStorage.getItem("bolao3A_currentUser");
      const persistedAdminState = localStorage.getItem("bolao3A_adminActive") === "true";

      if (persistedAdminState) {
        setIsAdminLoggedIn(true);
      } else if (persistedUser) {
        const userData = list.find(u => u.id === persistedUser);
        if (userData) {
          setCurrentUser(userData);
        }
      }
    });

    return () => unsub();
  }, []);

  // Listen to matches database in real-time for homepage fixtures view
  useEffect(() => {
    const unsubMatches = onSnapshot(collection(db, "matches"), async (snapshot) => {
      const list: MatchData[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MatchData);
      });

      // AUTOMATIC BOOTSTRAP / UPGRADE: If matches collection is empty or has old 84-match schema, load INITIAL_MATCHES automatically!
      if (snapshot.empty || snapshot.size < 100) {
        console.log("Matches collection is empty or outdated. Bootstrapping matches automatically...");
        const { writeBatch, doc: firestoreDoc } = await import("firebase/firestore");
        const { INITIAL_MATCHES } = await import("./data/worldCupMatches");
        try {
          const batch = writeBatch(db);
          
          // Clear standard old matches
          snapshot.forEach((oldDoc) => {
            batch.delete(firestoreDoc(db, "matches", oldDoc.id));
          });

          INITIAL_MATCHES.forEach((match) => {
            batch.set(firestoreDoc(db, "matches", match.id), {
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
          console.log("Successfully auto-bootstrapped and upgraded world cup matches!");
        } catch (err) {
          console.error("Failed to auto-bootstrap matches:", err);
        }
        return;
      }

      // Sort matches by date ascending
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMatches(list);
    }, (error) => {
      console.error("Erro ao escutar jogos:", error);
    });

    return () => unsubMatches();
  }, []);

  // Update dynamic World Cup Countdown
  useEffect(() => {
    const updateCopaCountdown = () => {
      // Opening kickoff: June 11, 2026, 19:00 UTC
      const targetTime = new Date("2026-06-11T19:00:00Z").getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setCopaCountdown("A COPA DO MUNDO JÁ COMEÇOU! ⚽🔥");
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setCopaCountdown(`${d}d ${h}h ${m}m ${s}s`);
      }
    };

    updateCopaCountdown();
    const interval = setInterval(updateCopaCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle student login PIN matching
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setCredentialsError(null);

    if (!selectedStudentId) {
      setCredentialsError("Por favor, selecione seu nome na lista da sala 3A!");
      return;
    }

    if (playerPin.length !== 4) {
      setCredentialsError("Insira sua senha numérica de exactly 4 dígitos!");
      return;
    }

    const matchedStudent = students.find(s => s.id === selectedStudentId);

    if (matchedStudent && matchedStudent.pin === playerPin) {
      // Success
      setCurrentUser(matchedStudent);
      localStorage.setItem("bolao3A_currentUser", matchedStudent.id);
      sounds.playWhistle();
      setSelectedStudentId("");
      setPlayerPin("");
    } else {
      setCredentialsError("Senha incorreta! Peça para o Admin conferir seu PIN.");
    }
  };

  // Handle admin login matching
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    setCredentialsError(null);

    if (adminUser.toLowerCase() === "admin" && adminPass === "3aamerico!") {
      // Success
      setIsAdminLoggedIn(true);
      localStorage.setItem("bolao3A_adminActive", "true");
      sounds.playWhistle();
      setAdminUser("");
      setAdminPass("");
    } else {
      setCredentialsError("Credenciais de Administrador inválidas!");
    }
  };

  // Handle manual session tear down
  const handleUserLogout = () => {
    sounds.playWhistle();
    setCurrentUser(null);
    localStorage.removeItem("bolao3A_currentUser");
  };

  const handleAdminLogout = () => {
    sounds.playWhistle();
    setIsAdminLoggedIn(false);
    localStorage.removeItem("bolao3A_adminActive");
  };

  // Derived state: students sorted by score and exact hits
  const rankedStudents = [...students].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.exactMatches !== a.exactMatches) {
      return b.exactMatches - a.exactMatches;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col selection:bg-emerald-500 selection:text-neutral-950 font-sans antialiased text-sm">
      
      {/* Decorative soccer pitch header grid */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-green-950/20 to-transparent pointer-events-none" />

      {/* Dynamic top ticker info line */}
      <div className="bg-zinc-900 border-b border-zinc-850 py-2.5 px-4 text-center font-mono text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 font-bold text-yellow-500">
          <Activity size={12} className="animate-pulse" />
          CONTAGEM REGRESSIVA FIFA 2026:
        </span>
        <span className="font-sans font-black tracking-widest text-emerald-400 text-sm">
          {copaCountdown}
        </span>
      </div>

      <main className="flex-1 flex flex-col py-6">
        
        {/* If Admin is Logged on */}
        {isAdminLoggedIn ? (
          <AdminPanel onLogout={handleAdminLogout} />
        ) : currentUser ? (
          /* If Student Player is Logged on */
          <UserDashboard currentUser={currentUser} onLogout={handleUserLogout} />
        ) : (
          /* If Locked/Logged Out - Splash & Dual Layout Panels */
          <div className="w-full max-w-6xl mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
            
            {/* Welcoming Banner/Header Card */}
            <div className="text-center md:mb-4">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-yellow-400 p-2.5 shadow-lg shadow-emerald-900/30 mb-4 animate-bounce">
                <Trophy size={32} className="text-zinc-950" />
              </div>
              
              <div className="text-xs font-mono font-extrabold uppercase tracking-widest text-zinc-500 flex items-center justify-center gap-2">
                <School size={14} className="text-emerald-500" />
                Américo Franco • Sala 3A
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight font-sans text-white mt-1 border-b border-zinc-800 pb-2">
                BOLÃO COPA 2026
              </h1>
              <p className="text-xs tracking-wider text-zinc-400 font-mono mt-2 uppercase">
                O seu Cartola FC da Copa do Mundo
              </p>
            </div>

            {/* Responsive 2-Column Pitch Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Real-time Info (Leaderboard or Upcoming Fixtures Calendar) */}
              <div className="lg:col-span-7 bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative">
                
                {/* Embedded Tab Controls */}
                <div className="flex bg-zinc-950 p-1 border border-zinc-850 rounded-xl mb-6 text-xs gap-1">
                  <button
                    onClick={() => { sounds.playClick(); setActiveTabHomepage("leaderboard"); }}
                    className={`flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTabHomepage === "leaderboard"
                        ? "bg-zinc-800 text-white border border-zinc-750 shadow-md"
                        : "text-zinc-500 hover:text-zinc-350"
                    }`}
                  >
                    <Trophy size={13} className="text-yellow-500" />
                    <span>Ranking 3A</span>
                  </button>
                  <button
                    onClick={() => { sounds.playClick(); setActiveTabHomepage("fixtures"); }}
                    className={`flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTabHomepage === "fixtures"
                        ? "bg-zinc-800 text-white border border-zinc-750 shadow-md"
                        : "text-zinc-500 hover:text-zinc-350"
                    }`}
                  >
                    <Calendar size={13} className="text-emerald-400" />
                    <span>Calendário</span>
                  </button>
                  <button
                    onClick={() => { sounds.playClick(); setActiveTabHomepage("groups"); }}
                    className={`flex-grow md:flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTabHomepage === "groups"
                        ? "bg-zinc-800 text-white border border-zinc-750 shadow-md"
                        : "text-zinc-500 hover:text-zinc-350"
                    }`}
                  >
                    <Compass size={13} className="text-blue-400" />
                    <span>Grupos da Copa</span>
                  </button>
                  <button
                    onClick={() => { sounds.playClick(); setActiveTabHomepage("bracket"); }}
                    className={`flex-grow md:flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTabHomepage === "bracket"
                        ? "bg-zinc-800 text-white border border-zinc-750 shadow-md"
                        : "text-zinc-500 hover:text-zinc-350"
                    }`}
                  >
                    <Trophy size={13} className="text-amber-500" />
                    <span>Mata-Mata</span>
                  </button>
                </div>

                {/* TAB CONTENT A: RANKING LEADERBOARD */}
                {activeTabHomepage === "leaderboard" && (
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                        🏆 TABELA DO RANKING
                      </h2>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-full uppercase">
                        Sala 3A
                      </span>
                    </div>

                    {rankedStudents.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-2xl">
                        Nenhum aluno cadastrado no ranking pelo Admin ainda.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                        {rankedStudents.map((student, idx) => {
                          const isLead = idx === 0;
                          const rankColor = 
                            idx === 0 ? "bg-yellow-400 text-zinc-950" : 
                            idx === 1 ? "bg-zinc-300 text-zinc-950" : 
                            idx === 2 ? "bg-amber-600 text-white" : 
                            "bg-zinc-850 text-zinc-400";

                          return (
                            <div 
                              key={student.id} 
                              className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${
                                isLead 
                                  ? "bg-gradient-to-r from-yellow-950/20 to-yellow-950/5 border-yellow-500/40 font-semibold shadow-md shadow-yellow-950/20 animate-pulse-slow" 
                                  : "bg-zinc-950/40 hover:bg-zinc-950/70 border-zinc-850/60"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Position badge */}
                                <span className={`h-6 w-6 rounded-full font-mono text-[10px] uppercase font-black flex items-center justify-center ${rankColor} shadow-inner`}>
                                  {idx + 1}
                                </span>
                                
                                {/* Custom Cartola shield */}
                                <CartolaShield avatarString={student.avatar} size={32} />

                                <div>
                                  <div className="font-sans font-extrabold text-zinc-100 flex items-center gap-1.5 text-sm">
                                    {student.name}
                                    {idx === 0 && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] text-zinc-950 font-sans font-black bg-yellow-400 rounded-md uppercase">
                                        Líder 👑
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-zinc-450 uppercase mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="text-zinc-400">🎯 {student.exactMatches} Placar{student.exactMatches === 1 ? "" : "es"} exato{student.exactMatches === 1 ? "" : "s"}</span>
                                    <span className="text-zinc-650">•</span>
                                    <span className="text-zinc-500">👟 {student.outcomeMatches} Acertos de vencedor</span>
                                  </div>
                                </div>
                              </div>

                              {/* Points */}
                              <div className="text-right flex flex-col items-end justify-center min-w-[50px]">
                                <span className="font-display font-black text-xl text-emerald-400 block tracking-tight leading-none">
                                  {student.score}
                                </span>
                                <span className="text-[8px] font-mono text-zinc-500 uppercase mt-1">
                                  {student.score === 1 ? "Ponto" : "Pontos"}
                                </span>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT B: UPCOMING MATCH SYSTEM */}
                {activeTabHomepage === "fixtures" && (
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-850 pb-3 mb-4 gap-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                        📅 JOGOS DE CADA RODADA
                      </h2>
                      
                      {/* Round filters */}
                      <div className="flex bg-zinc-950 p-0.5 border border-zinc-850 rounded-lg text-[10px] font-mono">
                        {[1, 2, 3, 4].map((r) => (
                          <button
                            key={r}
                            onClick={() => { sounds.playClick(); setFixturesRound(r); }}
                            className={`px-2.5 py-1 rounded font-sans transition-all cursor-pointer ${
                              fixturesRound === r
                                ? "bg-emerald-550 text-zinc-950 font-black"
                                : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            R{r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs font-mono text-emerald-400 bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-xl mb-4 font-black uppercase text-center tracking-wider">
                      {ROUND_NAMES[fixturesRound] || `Rodada ${fixturesRound}`}
                    </div>

                    {matches.filter(m => m.roundNumber === fixturesRound).length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-2xl">
                        Nenhum jogo cadastrado para esta rodada ainda.
                        <p className="text-[10px] text-zinc-600 mt-1 pb-1">
                          Consulte o Administrador para fazer a primeira carga oficial.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {matches
                          .filter(m => m.roundNumber === fixturesRound)
                          .map((match) => (
                            <div 
                              key={match.id} 
                              className="bg-zinc-950/40 hover:bg-zinc-950/80 border border-zinc-850/80 p-3.5 rounded-2xl flex flex-col justify-between gap-3 text-xs"
                            >
                              {/* Metadata line */}
                              <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase">
                                <span>{match.group}</span>
                                <span>{match.stadium} • {match.city}</span>
                              </div>

                              {/* Main fixture line */}
                              <div className="flex items-center justify-between text-zinc-200">
                                {/* Team A */}
                                <div className="flex items-center gap-2 flex-grow justify-end w-1/3 min-w-0">
                                  <span className="font-sans font-extrabold text-white text-xs text-ellipsis overflow-hidden whitespace-nowrap text-right">
                                    {match.homeTeam}
                                  </span>
                                  <img 
                                    src={getFlagUrl(match.homeTeam)} 
                                    alt="" 
                                    className="w-6 h-4 object-cover rounded border border-zinc-800 shadow-sm flex-shrink-0"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    referrerPolicy="no-referrer"
                                  />
                                </div>

                                {/* Score board */}
                                <div className="flex items-center justify-center gap-1.5 px-3.5 mx-2 bg-zinc-900 border border-zinc-850 rounded-lg py-1 flex-shrink-0">
                                  {match.homeScore !== null ? (
                                    <span className="font-mono font-black text-yellow-400 text-sm">
                                      {match.homeScore}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-zinc-600">-</span>
                                  )}
                                  <span className="text-zinc-650 text-[10px]">x</span>
                                  {match.awayScore !== null ? (
                                    <span className="font-mono font-black text-yellow-400 text-sm">
                                      {match.awayScore}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-zinc-600">-</span>
                                  )}
                                </div>

                                {/* Team B */}
                                <div className="flex items-center gap-2 flex-grow w-1/3 min-w-0">
                                  <img 
                                    src={getFlagUrl(match.awayTeam)} 
                                    alt="" 
                                    className="w-6 h-4 object-cover rounded border border-zinc-800 shadow-sm flex-shrink-0"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="font-sans font-extrabold text-white text-xs text-ellipsis overflow-hidden whitespace-nowrap font-black">
                                    {match.awayTeam}
                                  </span>
                                </div>
                              </div>

                              {/* Kickoff date description */}
                              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 border-t border-zinc-900/40 pt-2">
                                <span className="uppercase text-[9px] text-zinc-600">Pontapé inicial:</span>
                                <span className="font-semibold text-zinc-400">
                                  {new Date(match.date).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                              </div>

                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT C: WORLD CUP GROUPS STANDINGS */}
                {activeTabHomepage === "groups" && (
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-850 pb-3 mb-4 gap-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                        🌍 CLASSIFICAÇÃO DOS GRUPOS
                      </h2>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-full uppercase">
                        Pontuação Oficial FIFA
                      </span>
                    </div>

                    {/* Group selection quick pills */}
                    <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                      {["Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H", "Grupo I", "Grupo J", "Grupo K", "Grupo L"].map((groupName) => {
                        const letter = groupName.replace("Grupo ", "");
                        const isSelected = selectedGroupStatic === groupName;
                        return (
                          <button
                            key={groupName}
                            onClick={() => { sounds.playClick(); setSelectedGroupStatic(groupName); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-sans font-extrabold cursor-pointer transition-all flex-shrink-0 ${
                              isSelected
                                ? "bg-emerald-500 text-zinc-950 font-black scale-102 shadow-md"
                                : "bg-zinc-950/80 text-zinc-400 hover:text-white border border-zinc-850"
                            }`}
                          >
                            Grupo {letter}
                          </button>
                        );
                      })}
                    </div>

                    {/* Standings table */}
                    {(() => {
                      const standings = calculateGroupStandings(matches);
                      const currentGroupStandings = standings[selectedGroupStatic] || [];

                      return (
                        <div className="bg-zinc-950/60 border border-zinc-850 rounded-2xl overflow-hidden shadow-inner">
                          {/* Table Header */}
                          <div className="grid grid-cols-12 gap-1 bg-zinc-900/60 p-3 text-[10px] font-mono uppercase font-extrabold text-zinc-450 border-b border-zinc-850/80">
                            <span className="col-span-6 flex items-center">Seleção</span>
                            <span className="col-span-1 text-center font-black text-white">P</span>
                            <span className="col-span-1 text-center">J</span>
                            <span className="col-span-1 text-center">V</span>
                            <span className="col-span-1 text-center">E</span>
                            <span className="col-span-1 text-center">D</span>
                            <span className="col-span-1 text-center">SG</span>
                          </div>

                          {currentGroupStandings.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500 font-mono text-xs">
                              Sem seleções inicializadas neste grupo.
                            </div>
                          ) : (
                            <div className="divide-y divide-zinc-900/40">
                              {currentGroupStandings.map((team, idx) => {
                                const isZone = idx < 2; // top 2 advance
                                return (
                                  <div 
                                    key={team.name} 
                                    className="grid grid-cols-12 gap-1 p-3 items-center text-xs hover:bg-zinc-900/20 transition-all font-sans"
                                  >
                                    {/* Team Name and flag */}
                                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                                      <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isZone ? "bg-emerald-500" : "bg-zinc-800"}`} />
                                      <span className="font-mono text-[10px] text-zinc-500 w-4 text-center">
                                        {idx + 1}º
                                      </span>
                                      <img 
                                        src={getFlagUrl(team.name)} 
                                        alt="" 
                                        className="w-6 h-4 object-cover rounded shadow-sm border border-zinc-800 flex-shrink-0"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="font-extrabold text-white truncate text-ellipsis overflow-hidden">
                                        {team.name}
                                      </span>
                                    </div>

                                    {/* Points and stats */}
                                    <span className="col-span-1 text-center font-black text-emerald-400 text-sm">
                                      {team.points}
                                    </span>
                                    <span className="col-span-1 text-center font-mono text-zinc-300">
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
                          <div className="p-3 bg-zinc-950/80 border-t border-zinc-900/60 text-[9px] font-mono text-zinc-500 flex gap-4">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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

                {activeTabHomepage === "bracket" && (
                  <div className="animate-fade-in">
                    <TournamentBracket matches={matches} currentUser={null} />
                  </div>
                )}

              </div>

              {/* Right Side: Secure Login Credentials Panel */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Visual access card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Lock size={14} className="text-orange-500" />
                    <span className="text-[10px] font-mono uppercase font-black text-zinc-400 tracking-wider">
                      CONECTAR AO MEU BOLÃO
                    </span>
                  </div>

                  {/* Login Selector Tab */}
                  <div className="flex bg-zinc-950 p-1 border border-zinc-850 rounded-xl mb-6 text-xs">
                    <button
                      onClick={() => { sounds.playClick(); setLoginMode("player"); setCredentialsError(null); }}
                      className={`flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer ${
                        loginMode === "player"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Aluno 3A
                    </button>
                    <button
                      onClick={() => { sounds.playClick(); setLoginMode("admin"); setCredentialsError(null); }}
                      className={`flex-1 py-2 rounded-lg font-sans font-extrabold transition-all cursor-pointer ${
                        loginMode === "admin"
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Administrador
                    </button>
                  </div>

                  {/* Validation alert responses */}
                  {credentialsError && (
                    <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 font-sans text-xs flex items-center gap-2" id="login_error">
                      <ShieldAlert size={14} className="flex-shrink-0" />
                      <span>{credentialsError}</span>
                    </div>
                  )}

                  {/* 1. STUDENT LOGIN MODULE */}
                  {loginMode === "player" && (
                    <form onSubmit={handleStudentLogin} className="space-y-5">
                      <div>
                        <label className="block text-[10px] uppercase font-mono font-black text-zinc-400 tracking-wider mb-1.5">
                          Selecione Seu Nome
                        </label>
                        {students.length === 0 ? (
                          <div className="text-xs font-mono text-zinc-500 py-3 bg-zinc-950/50 border border-dashed border-zinc-800 text-center rounded-xl">
                            Nenhum aluno cadastrado no ranking pelo Admin ainda.
                          </div>
                        ) : (
                          <select
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="w-full bg-zinc-950/80 text-white border border-zinc-800 rounded-xl px-3.5 py-3 text-sm font-sans outline-none focus:border-emerald-500 cursor-pointer text-ellipsis overflow-hidden"
                            required
                          >
                            <option value="">-- Clique e selecione seu nome --</option>
                            {students.map((std) => (
                              <option key={std.id} value={std.id}>
                                ⚽ {std.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-mono font-black text-zinc-400 tracking-wider mb-1.5">
                          Senha de 4 dígitos (PIN)
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          value={playerPin}
                          onChange={(e) => setPlayerPin(e.target.value.replace(/[^0-9]/g, ""))}
                          className="w-full bg-zinc-950/80 text-orange-400 border border-zinc-800 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-widest font-black outline-none focus:border-emerald-500 focus:shadow-md focus:shadow-emerald-950"
                          required
                        />
                        <p className="text-[10px] text-zinc-500 mt-1.5 text-center font-sans leading-normal">
                          Sua senha numérica exclusiva de 4 dígitos foi gerada pelo admin da sala.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={students.length === 0}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-neutral-950 font-sans font-bold text-sm tracking-wide shadow-lg cursor-pointer transition-all disabled:opacity-45"
                      >
                        Entrar no Painel e Apostar
                      </button>
                    </form>
                  )}

                  {/* 2. ADMIN LOGIN MODULE */}
                  {loginMode === "admin" && (
                    <form onSubmit={handleAdminLogin} className="space-y-5">
                      <div>
                        <label className="block text-[10px] uppercase font-mono font-black text-zinc-400 tracking-wider mb-1.5">
                          Usuário Admin
                        </label>
                        <input
                          type="text"
                          placeholder="admin"
                          value={adminUser}
                          onChange={(e) => setAdminUser(e.target.value)}
                          className="w-full bg-zinc-950/80 text-white border border-zinc-800 rounded-xl px-4 py-3 text-sm font-sans outline-none focus:border-orange-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-mono font-black text-zinc-400 tracking-wider mb-1.5">
                          Senha Administrativa
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={adminPass}
                          onChange={(e) => setAdminPass(e.target.value)}
                          className="w-full bg-zinc-950/80 text-white border border-zinc-800 rounded-xl px-4 py-3 text-sm font-sans outline-none focus:border-orange-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-sans font-bold text-sm tracking-wide shadow-lg cursor-pointer transition-all"
                      >
                        Liberar Painel do Admin
                      </button>
                    </form>
                  )}

                </div>

                {/* Sweepstakes rules quick view summary card */}
                <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex gap-3 text-xs">
                  <Info className="text-yellow-500 flex-shrink-0" size={16} />
                  <div className="font-sans text-zinc-400 leading-normal space-y-1">
                    <p className="font-bold text-zinc-300">Regras de Pontuação Simplificadas:</p>
                    <p>• Acertar placar exato = <strong className="text-yellow-500">3 pontos</strong></p>
                    <p>• Acertar vencedor ou empate, errando placar = <strong className="text-emerald-400">1 ponto</strong></p>
                    <p>• Errar ambos = <strong>0 pontos</strong></p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer Branding credits */}
      <footer className="py-6 border-t border-zinc-900 mt-12 text-center text-xs font-mono text-zinc-600">
        <div>BOLÃO COPA 2026 • SALA 3A • ESCOLA AMÉRICO FRANCO</div>
        <div className="mt-1 opacity-70">Visual inspirado no Cartola FC • Desenvolvido em tempo real</div>
      </footer>

    </div>
  );
}

import React, { useState } from "react";
import { doc, updateDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { MatchData, BRACKET_PROGRESSION, getFlagUrl } from "../data/worldCupMatches";
import { Sparkles, Trophy, Navigation, MapPin, Calendar, HelpCircle, Check, Crown } from "lucide-react";
import sounds from "./SoundEffects";

interface TournamentBracketProps {
  matches: MatchData[];
  currentUser: {
    id: string;
    name: string;
    role: "admin" | "user";
  } | null;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches, currentUser }) => {
  const [activeStageFilter, setActiveStageFilter] = useState<"all" | "r32" | "r16" | "q8" | "s4" | "f2">("all");
  const isAdmin = currentUser?.role === "admin";
  const [confirmWinner, setConfirmWinner] = useState<{ matchId: string; teamName: string } | null>(null);

  // Filter matches belonging to the knockout stage (roundNumber === 4)
  const koMatches = matches.filter((m) => m.roundNumber === 4);

  // Group matches by their official stage
  const r32Matches = koMatches.filter((m) => m.id.startsWith("copa_r32_"));
  const r16Matches = koMatches.filter((m) => m.id.startsWith("copa_r16_"));
  const q8Matches = koMatches.filter((m) => m.id.startsWith("copa_q8_"));
  const s4Matches = koMatches.filter((m) => m.id.startsWith("copa_s4_"));
  const f2Matches = koMatches.filter((m) => m.id.startsWith("copa_f2_"));

  // Sort helper to ensure matches appear in correct slot order (e.g. Jogo 1 to Jogo 16)
  const sortMatchesByIdIdx = (arr: MatchData[], prefix: string) => {
    return [...arr].sort((a, b) => {
      const idxA = parseInt(a.id.replace(prefix, ""), 10);
      const idxB = parseInt(b.id.replace(prefix, ""), 10);
      return idxA - idxB;
    });
  };

  const sortedR32 = sortMatchesByIdIdx(r32Matches, "copa_r32_");
  const sortedR16 = sortMatchesByIdIdx(r16Matches, "copa_r16_");
  const sortedQ8 = sortMatchesByIdIdx(q8Matches, "copa_q8_");
  const sortedS4 = sortMatchesByIdIdx(s4Matches, "copa_s4_");
  const sortedF2 = sortMatchesByIdIdx(f2Matches, "copa_f2_");

  // Handler to set the winner of a match and progress them to the next stage slot
  const handleSetMatchWinner = async (matchId: string, winningTeam: string) => {
    sounds.playWhistle();
    setConfirmWinner(null);

    const matchInstance = koMatches.find((m) => m.id === matchId);
    if (!matchInstance) return;

    // 1. Update the finished status in database
    const matchRef = doc(db, "matches", matchId);
    try {
      // Determine if winner was home or away to set default hypothetical score if empty
      const isHomeWinner = matchInstance.homeTeam === winningTeam;
      const updatedHomeScore = matchInstance.homeScore !== null ? matchInstance.homeScore : (isHomeWinner ? 1 : 0);
      const updatedAwayScore = matchInstance.awayScore !== null ? matchInstance.awayScore : (isHomeWinner ? 0 : 1);

      await updateDoc(matchRef, {
        status: "finished",
        homeScore: updatedHomeScore,
        awayScore: updatedAwayScore,
      });

      // 2. Compute dynamic bracket progression flow
      const progression = BRACKET_PROGRESSION[matchId];
      if (progression) {
        const nextMatchRef = doc(db, "matches", progression.nextMatchId);
        
        if (progression.slot === "home") {
          await updateDoc(nextMatchRef, {
            homeTeam: winningTeam,
            homeFlag: matchInstance.homeTeam === winningTeam ? matchInstance.homeFlag : matchInstance.awayFlag,
          });
        } else {
          await updateDoc(nextMatchRef, {
            awayTeam: winningTeam,
            awayFlag: matchInstance.homeTeam === winningTeam ? matchInstance.homeFlag : matchInstance.awayFlag,
          });
        }
      }

      // 3. Automatically recalculate all student scores
      try {
        const uSnapshot = await getDocs(collection(db, "users"));
        const mSnapshot = await getDocs(collection(db, "matches"));
        const matchesMap: Record<string, MatchData> = {};
        mSnapshot.forEach(d => {
          matchesMap[d.id] = { id: d.id, ...d.data() } as MatchData;
        });

        // Ensure newly-updated match is correctly reflected in calculations
        if (matchesMap[matchId]) {
          matchesMap[matchId].homeScore = updatedHomeScore;
          matchesMap[matchId].awayScore = updatedAwayScore;
          matchesMap[matchId].status = "finished";
        }

        const bSnapshot = await getDocs(collection(db, "bets"));
        const userBetsMap: Record<string, any[]> = {};
        bSnapshot.forEach(d => {
          const bet = d.data();
          const uId = bet.userId;
          if (!userBetsMap[uId]) userBetsMap[uId] = [];
          userBetsMap[uId].push({ id: d.id, ...bet });
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
            const m = matchesMap[bet.matchId];
            if (!m || m.homeScore === null || m.awayScore === null) return;

            const hBet = bet.homeTeamBet;
            const aBet = bet.awayTeamBet;
            const hReal = m.homeScore;
            const aReal = m.awayScore;

            let pts = 0;
            if (hBet === hReal && aBet === aReal) {
              pts = 3;
              exactCount++;
            } else {
              const outcomeBet = Math.sign(hBet - aBet);
              const outcomeReal = Math.sign(hReal - aReal);
              if (outcomeBet === outcomeReal) {
                pts = 1;
                outcomeCount++;
              } else {
                pts = 0;
              }
            }

            batch.update(doc(db, "bets", bet.id), { pointsEarned: pts });
            totalScore += pts;
          });

          batch.update(doc(db, "users", uId), {
            score: totalScore,
            exactMatches: exactCount,
            outcomeMatches: outcomeCount
          });
        });

        await batch.commit();
        sounds.playGoalCheer();
      } catch (calcError) {
        console.error("Erro ao recalcular pontos após definir vencedor no bracket:", calcError);
      }
    } catch (e) {
      console.error("Erro ao definir vencedor do mata-mata no FireStore:", e);
    }
  };

  const isPlaceholderTeam = (name: string) => {
    return !name || name.startsWith("1º Grupo") || name.startsWith("2º Grupo") || name.startsWith("3º Grupo") || name.startsWith("Vence") || name.startsWith("Vencedor");
  };

  const renderMatchCard = (match: MatchData, isCompact: boolean = false) => {
    const isFinished = match.status === "finished";
    const homeIsWinner = isFinished && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
    const awayIsWinner = isFinished && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

    // Fallback display code
    const isHomePlaceholder = isPlaceholderTeam(match.homeTeam);
    const isAwayPlaceholder = isPlaceholderTeam(match.awayTeam);

    return (
      <div 
        key={match.id}
        className={`bg-zinc-950/90 border-2 rounded-2xl p-3.5 shadow-xl transition-all relative ${
          isFinished ? "border-emerald-500/20 shadow-emerald-950/10" : "border-zinc-800 hover:border-zinc-700"
        } ${confirmWinner?.matchId === match.id ? "ring-2 ring-emerald-500 bg-zinc-900" : ""}`}
      >
        {/* Match Header metadata */}
        <div className="flex justify-between items-center text-[10px] uppercase font-mono font-bold text-zinc-500 mb-2 border-b border-zinc-900 pb-1.5">
          <span className="text-zinc-400 font-extrabold flex items-center gap-1">
            <Sparkles size={11} className="text-amber-500 flex-shrink-0" />
            {match.group}
          </span>
          <span className="truncate max-w-[120px]" title={match.city}>
            📍 {match.city}
          </span>
        </div>

        {/* Home Team Slot Row */}
        <div 
          onClick={() => {
            if (isAdmin && !isHomePlaceholder) {
              sounds.playClick();
              setConfirmWinner({ matchId: match.id, teamName: match.homeTeam });
            }
          }}
          className={`group/row flex items-center justify-between p-2 rounded-xl transition-all select-none ${
            isAdmin && !isHomePlaceholder ? "cursor-pointer hover:bg-zinc-900" : ""
          } ${homeIsWinner ? "bg-emerald-950/20 border border-emerald-500/10" : "border border-transparent"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {!isHomePlaceholder ? (
              <img 
                src={getFlagUrl(match.homeTeam)} 
                alt="" 
                className="w-7 h-4.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-4.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[8px] text-zinc-650 font-sans flex-shrink-0">
                ?
              </div>
            )}
            <span className={`font-sans text-xs truncate max-w-[150px] ${
              isHomePlaceholder ? "text-zinc-500 tracking-wide font-mono" : "text-white font-extrabold"
            } ${homeIsWinner ? "text-emerald-400 font-black" : ""}`}>
              {match.homeTeam}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFinished ? (
              <span className={`font-mono text-xs font-black min-w-4 text-center ${homeIsWinner ? "text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded" : "text-zinc-500"}`}>
                {match.homeScore}
              </span>
            ) : (
              isAdmin && !isHomePlaceholder && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/row:opacity-100 transition-all uppercase">
                  vence
                </span>
              )
            )}
            {homeIsWinner && <Crown size={12} className="text-amber-500" />}
          </div>
        </div>

        {/* VS Separator */}
        <div className="h-1 flex items-center justify-center my-0.5" />

        {/* Away Team Slot Row */}
        <div 
          onClick={() => {
            if (isAdmin && !isAwayPlaceholder) {
              sounds.playClick();
              setConfirmWinner({ matchId: match.id, teamName: match.awayTeam });
            }
          }}
          className={`group/row flex items-center justify-between p-2 rounded-xl transition-all select-none ${
            isAdmin && !isAwayPlaceholder ? "cursor-pointer hover:bg-zinc-900" : ""
          } ${awayIsWinner ? "bg-emerald-950/20 border border-emerald-500/10" : "border border-transparent"}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {!isAwayPlaceholder ? (
              <img 
                src={getFlagUrl(match.awayTeam)} 
                alt="" 
                className="w-7 h-4.5 object-cover rounded shadow border border-zinc-800 flex-shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-4.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[8px] text-zinc-650 font-sans flex-shrink-0">
                ?
              </div>
            )}
            <span className={`font-sans text-xs truncate max-w-[150px] ${
              isAwayPlaceholder ? "text-zinc-500 tracking-wide font-mono" : "text-white font-extrabold"
            } ${awayIsWinner ? "text-emerald-400 font-black" : ""}`}>
              {match.awayTeam}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFinished ? (
              <span className={`font-mono text-xs font-black min-w-4 text-center ${awayIsWinner ? "text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded" : "text-zinc-500"}`}>
                {match.awayScore}
              </span>
            ) : (
              isAdmin && !isAwayPlaceholder && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/row:opacity-100 transition-all uppercase">
                  vence
                </span>
              )
            )}
            {awayIsWinner && <Crown size={12} className="text-amber-500" />}
          </div>
        </div>

        {/* Date line */}
        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-zinc-900/40 text-[9px] font-mono text-zinc-550">
          <span>📅 {new Date(match.date).toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</span>
          <span>⏲️ {new Date(match.date).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}</span>
        </div>

        {/* Inline confirmation helper banner */}
        {confirmWinner && confirmWinner.matchId === match.id && (
          <div className="absolute inset-0 bg-zinc-950/95 rounded-2xl flex flex-col justify-center items-center p-3 animate-fade-in z-20">
            <Trophy size={20} className="text-amber-400 mb-1" />
            <p className="text-[10px] text-zinc-400 text-center uppercase font-mono tracking-wide">AVANÇAR SELEÇÃO</p>
            <p className="text-xs text-white text-center font-bold font-sans mt-0.5 truncate max-w-[180px]">
              {confirmWinner.teamName} venceu?
            </p>
            
            <div className="flex gap-1.5 mt-3 w-full">
              <button 
                onClick={() => setConfirmWinner(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] uppercase font-mono font-extrabold text-zinc-400 py-1 rounded cursor-pointer transition-all"
              >
                Não
              </button>
              <button 
                onClick={() => handleSetMatchWinner(match.id, confirmWinner.teamName)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-[10px] uppercase font-sans font-black py-1 rounded cursor-pointer transition-all"
              >
                Sim!
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFilterHeading = (title: string, desc: string, totalCount: number) => {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-black font-sans text-zinc-200 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm" />
          {title}
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 border border-zinc-900 rounded-full font-bold ml-1">
            {totalCount} Confrontos
          </span>
        </h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl -z-1" />
        <div className="absolute left-1/3 bottom-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl -z-1" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase font-black text-emerald-400 rounded-full mb-3">
              <Trophy size={11} /> Fase Eliminatória Copa 2026
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-sans text-white tracking-tight">
              Chaveamento do Mata-Mata
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
              Confira os cruzamentos oficiais da FIFA. Classificam-se os 2 primeiros de cada grupo e os 8 melhores 3º colocados no novo formato com a Fase de 32!
            </p>
          </div>

          <div className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-2 border border-zinc-850 rounded-xl flex flex-col md:items-end flex-shrink-0">
            <span className="font-bold text-zinc-300">ADMIN MODE: INFO</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">
              {isAdmin ? "💡 Clique em um país para avançar de fase!" : "⚠️ Apenas administradores podem decidir confrontos."}
            </span>
          </div>
        </div>

        {/* Filter Selection Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mt-6 select-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {[
            { id: "all", label: "Árvore Completa" },
            { id: "r32", label: "Fase de 32 (16-avos)" },
            { id: "r16", label: "Oitavas de Final" },
            { id: "q8", label: "Quartas de Final" },
            { id: "s4", label: "Semifinais" },
            { id: "f2", label: "Grande Final" },
          ].map((tab) => {
            const isSel = activeStageFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveStageFilter(tab.id as any); }}
                className={`px-4 py-2 rounded-xl text-xs font-sans font-extrabold cursor-pointer transition-all flex-shrink-0 ${
                  isSel
                    ? "bg-emerald-500 text-zinc-950 font-black scale-102 shadow-md shadow-emerald-500/20"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-850"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Column Lists or Grid depending on activeStageFilter view */}
      {activeStageFilter !== "all" ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          {activeStageFilter === "r32" && (
            <>
              {renderFilterHeading("Fase de 32", "Os 16 primeiros confrontos do mata-mata definidos pelo emparelhamento FIFA.", sortedR32.length)}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedR32.map((m) => renderMatchCard(m))}
              </div>
            </>
          )}

          {activeStageFilter === "r16" && (
            <>
              {renderFilterHeading("Oitavas de Final", "Vencedores dos jogos da Fase de 32 se enfrentam seguindo a ordem de chaves.", sortedR16.length)}
              {sortedR16.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">Confrontos não definidos ainda. Decida a Fase anterior.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sortedR16.map((m) => renderMatchCard(m))}
                </div>
              )}
            </>
          )}

          {activeStageFilter === "q8" && (
            <>
              {renderFilterHeading("Quartas de Final", "Caminho rumo às semifinais. Disputadas de 9 a 11 de julho.", sortedQ8.length)}
              {sortedQ8.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">Confrontos não definidos ainda. Decida a Fase anterior.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sortedQ8.map((m) => renderMatchCard(m))}
                </div>
              )}
            </>
          )}

          {activeStageFilter === "s4" && (
            <>
              {renderFilterHeading("Semifinais", "Os 4 melhores se enfrentam em Dallas e Atlanta em 14 e 15 de julho.", sortedS4.length)}
              {sortedS4.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">Confrontos não definidos ainda. Decida a Fase anterior.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedS4.map((m) => renderMatchCard(m))}
                </div>
              )}
            </>
          )}

          {activeStageFilter === "f2" && (
            <>
              {renderFilterHeading("Grande Final", "A decisão do título mundial em 19 de julho na arena MetLife Stadium em Nova York.", sortedF2.length)}
              {sortedF2.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">Confrontos não definidos ainda. Decida a Fase anterior.</div>
              ) : (
                <div className="max-w-md mx-auto">
                  {sortedF2.map((m) => renderMatchCard(m))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Full Layout Tree Screen Side-Scrolling Bracket */
        <div className="overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="min-w-[1300px] flex items-stretch gap-8 px-1 select-none py-2">
            
            {/* COLUMN 1: Fase de 32 (8 matches Left + 8 matches Right as a single long column logically grouped) */}
            <div className="w-72 flex-shrink-0 flex flex-col justify-between gap-4">
              <div className="bg-zinc-950 font-mono text-[9px] text-zinc-500 font-extrabold uppercase px-3 py-1.5 border border-zinc-940 rounded-xl text-center shadow">
                Fase de 32 (16-avos de Final)
              </div>
              <div className="flex flex-col gap-4">
                {sortedR32.map((m) => renderMatchCard(m))}
              </div>
            </div>

            {/* COLUMN 2: Oitavas (8 games) */}
            <div className="w-72 flex-shrink-0 flex flex-col justify-around gap-4 py-8">
              <div className="bg-zinc-950 font-mono text-[9px] text-zinc-500 font-extrabold uppercase px-3 py-1.5 border border-zinc-940 rounded-xl text-center shadow">
                Oitavas de Final (Rodada de 16)
              </div>
              {sortedR16.map((m) => renderMatchCard(m))}
              {sortedR16.length === 0 && (
                <div className="flex flex-col items-center justify-center border border-zinc-850 border-dashed rounded-3xl h-64 text-center p-4">
                  <HelpCircle className="text-zinc-600 mb-1" size={18} />
                  <span className="text-[10px] font-mono text-zinc-550 header-title">Aguardando Fase anterior</span>
                </div>
              )}
            </div>

            {/* COLUMN 3: Quartas (4 games) */}
            <div className="w-72 flex-shrink-0 flex flex-col justify-around gap-4 py-16">
              <div className="bg-zinc-950 font-mono text-[9px] text-zinc-500 font-extrabold uppercase px-3 py-1.5 border border-zinc-940 rounded-xl text-center shadow">
                Quartas de Final
              </div>
              {sortedQ8.map((m) => renderMatchCard(m))}
              {sortedQ8.length === 0 && (
                <div className="flex flex-col items-center justify-center border border-zinc-850 border-dashed rounded-3xl h-64 text-center p-4">
                  <HelpCircle className="text-zinc-600 mb-1" size={18} />
                  <span className="text-[10px] font-mono text-zinc-550 header-title">Aguardando Oitavas</span>
                </div>
              )}
            </div>

            {/* COLUMN 4: Semis (2 games) */}
            <div className="w-72 flex-shrink-0 flex flex-col justify-around gap-4 py-24">
              <div className="bg-zinc-950 font-mono text-[9px] text-zinc-500 font-extrabold uppercase px-3 py-1.5 border border-zinc-940 rounded-xl text-center shadow">
                Semifinais
              </div>
              {sortedS4.map((m) => renderMatchCard(m))}
              {sortedS4.length === 0 && (
                <div className="flex flex-col items-center justify-center border border-zinc-850 border-dashed rounded-3xl h-64 text-center p-4">
                  <HelpCircle className="text-zinc-600 mb-1" size={18} />
                  <span className="text-[10px] font-mono text-zinc-550 header-title">Aguardando Quartas</span>
                </div>
              )}
            </div>

            {/* COLUMN 5: Grande Final (1 game) */}
            <div className="w-72 flex-shrink-0 flex flex-col justify-center gap-4 py-32">
              <div className="bg-zinc-950 font-mono text-[9px] text-zinc-500 font-extrabold uppercase px-3 py-1.5 border border-zinc-940 rounded-xl text-center shadow">
                Grande Final
              </div>
              
              <div className="p-3 bg-zinc-950 border-2 border-dashed border-amber-500/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center shadow-inner py-4 mb-4">
                <Trophy className="text-amber-500 animate-pulse" size={24} />
                <span className="font-extrabold text-xs text-white uppercase tracking-wider font-sans">Campeã Mundial</span>
                <span className="text-[10px] text-zinc-500 font-mono">19 de Julho • Nova York</span>
              </div>

              {sortedF2.map((m) => renderMatchCard(m))}
              {sortedF2.length === 0 && (
                <div className="flex flex-col items-center justify-center border border-zinc-850 border-dashed rounded-3xl h-64 text-center p-4">
                  <HelpCircle className="text-zinc-600 mb-1" size={18} />
                  <span className="text-[10px] font-mono text-zinc-550 header-title">Aguardando Semis</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export interface TeamStanding {
  name: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export function calculateGroupStandings(matches: MatchData[]): Record<string, TeamStanding[]> {
  const standings: Record<string, Record<string, TeamStanding>> = {};

  // Initialize standing records for all teams mentioned in the matches
  matches.forEach((match) => {
    // Filter out knockout matches (round 4 or containing knockout phases in group label)
    const gLower = match.group.toLowerCase();
    if (
      match.roundNumber === 4 || 
      gLower.includes("oitavas") || 
      gLower.includes("quartas") || 
      gLower.includes("semi") || 
      gLower.includes("final") ||
      gLower.includes("mata")
    ) {
      return;
    }

    const grp = match.group; // e.g. "Grupo A", "Grupo B", etc.
    if (!standings[grp]) {
      standings[grp] = {};
    }

    const teamsInGroup = [match.homeTeam, match.awayTeam];
    teamsInGroup.forEach((t) => {
      if (!t) return;
      // Skip generic placeholder team names
      if (t.startsWith("Vencedor") || t.startsWith("1º") || t.startsWith("2º") || t === "Melhor 2º Colocado") {
        return;
      }
      if (!standings[grp][t]) {
        standings[grp][t] = {
          name: t,
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0
        };
      }
    });
  });

  // Process finished match results
  matches.forEach((match) => {
    const gLower = match.group.toLowerCase();
    if (
      match.roundNumber === 4 || 
      gLower.includes("oitavas") || 
      gLower.includes("quartas") || 
      gLower.includes("semi") || 
      gLower.includes("final") ||
      gLower.includes("mata")
    ) {
      return;
    }

    if (match.status !== "finished" || match.homeScore === null || match.awayScore === null) {
      return;
    }

    const grp = match.group;
    const home = match.homeTeam;
    const away = match.awayTeam;

    if (!standings[grp] || !standings[grp][home] || !standings[grp][away]) {
      return;
    }

    const scoreH = match.homeScore;
    const scoreA = match.awayScore;

    // Increment games played
    standings[grp][home].played += 1;
    standings[grp][away].played += 1;

    // Add goals
    standings[grp][home].goalsFor += scoreH;
    standings[grp][home].goalsAgainst += scoreA;
    standings[grp][away].goalsFor += scoreA;
    standings[grp][away].goalsAgainst += scoreH;

    // Wins, losses, draws
    if (scoreH > scoreA) {
      standings[grp][home].wins += 1;
      standings[grp][home].points += 3;
      standings[grp][away].losses += 1;
    } else if (scoreH < scoreA) {
      standings[grp][away].wins += 1;
      standings[grp][away].points += 3;
      standings[grp][home].losses += 1;
    } else {
      standings[grp][home].draws += 1;
      standings[grp][home].points += 1;
      standings[grp][away].draws += 1;
      standings[grp][away].points += 1;
    }

    // Calculate goal differences
    standings[grp][home].goalDifference = standings[grp][home].goalsFor - standings[grp][home].goalsAgainst;
    standings[grp][away].goalDifference = standings[grp][away].goalsFor - standings[grp][away].goalsAgainst;
  });

  // Convert Record of records to Record of arrays, and sort by points, then gd, then goalsFor
  const sortedStandings: Record<string, TeamStanding[]> = {};
  Object.keys(standings).forEach((grp) => {
    const groupArr = Object.values(standings[grp]);
    groupArr.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.goalDifference !== a.goalDifference) {
        return b.goalDifference - a.goalDifference;
      }
      return b.goalsFor - a.goalsFor;
    });
    sortedStandings[grp] = groupArr;
  });

  return sortedStandings;
}

export interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string; // Emoji fallback
  awayFlag: string; // Emoji fallback
  group: string;
  stadium: string;
  city: string;
  date: string; // ISO date string
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "finished";
  roundNumber: number; // 1: Grupos A-D, 2: Grupos E-H, 3: Grupos I-L, 4: Mata-Mata
}

export const TEAM_FLAGS: Record<string, string> = {
  "México": "mx",
  "África do Sul": "za",
  "Coreia do Sul": "kr",
  "Rep. Tcheca": "cz",
  "Canadá": "ca",
  "Bósnia-Herzegovina": "ba",
  "Catar": "qa",
  "Suíça": "ch",
  "Brasil": "br",
  "Marrocos": "ma",
  "Haiti": "ht",
  "Escócia": "gb-sct",
  "Estados Unidos": "us",
  "Paraguai": "py",
  "Austrália": "au",
  "Turquia": "tr",
  "Alemanha": "de",
  "Curaçao": "cw",
  "Costa do Marfim": "ci",
  "Equador": "ec",
  "Países Baixos": "nl",
  "Japão": "jp",
  "Suécia": "se",
  "Tunísia": "tn",
  "Bélgica": "be",
  "Egito": "eg",
  "Irã": "ir",
  "Nova Zelândia": "nz",
  "Espanha": "es",
  "Cabo Verde": "cv",
  "Arábia Saudita": "sa",
  "Uruguai": "uy",
  "França": "fr",
  "Senegal": "sn",
  "Iraque": "iq",
  "Noruega": "no",
  "Argentina": "ar",
  "Argélia": "dz",
  "Áustria": "at",
  "Jordânia": "jo",
  "Portugal": "pt",
  "RD do Congo": "cd",
  "Uzbequistão": "uz",
  "Colômbia": "co",
  "Inglaterra": "gb-eng",
  "Croácia": "hr",
  "Gana": "gh",
  "Panamá": "pa"
};

// Returns country flag url from flagcdn (high resolution PNG)
export function getFlagUrl(teamName: string): string {
  if (!teamName) return "https://flagcdn.com/w40/un.png";
  const normalized = teamName.trim();
  const code = TEAM_FLAGS[normalized];
  if (!code) {
    return "https://flagcdn.com/w40/un.png"; // fallback to UN / custom placeholder
  }
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}

export const INITIAL_MATCHES: MatchData[] = [
  // ================= GRUPO A (Rodada 1: A-D) =================
  {
    id: "copa_01",
    homeTeam: "México",
    awayTeam: "África do Sul",
    homeFlag: "🇲🇽",
    awayFlag: "🇿🇦",
    group: "Grupo A",
    stadium: "Estádio Azteca",
    city: "Cidade do México",
    date: "2026-06-11T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_02",
    homeTeam: "Coreia do Sul",
    awayTeam: "Rep. Tcheca",
    homeFlag: "🇰🇷",
    awayFlag: "🇨🇿",
    group: "Grupo A",
    stadium: "Estádio Akron",
    city: "Guadalajara",
    date: "2026-06-11T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_03",
    homeTeam: "Rep. Tcheca",
    awayTeam: "África do Sul",
    homeFlag: "🇨🇿",
    awayFlag: "🇿🇦",
    group: "Grupo A",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-18T13:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_04",
    homeTeam: "México",
    awayTeam: "Coreia do Sul",
    homeFlag: "🇲🇽",
    awayFlag: "🇰🇷",
    group: "Grupo A",
    stadium: "Estádio Akron",
    city: "Guadalajara",
    date: "2026-06-18T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_05",
    homeTeam: "Rep. Tcheca",
    awayTeam: "México",
    homeFlag: "🇨🇿",
    awayFlag: "🇲🇽",
    group: "Grupo A",
    stadium: "Estádio Azteca",
    city: "Cidade do México",
    date: "2026-06-24T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_06",
    homeTeam: "África do Sul",
    awayTeam: "Coreia do Sul",
    homeFlag: "🇿🇦",
    awayFlag: "🇰🇷",
    group: "Grupo A",
    stadium: "Estádio BBVA",
    city: "Monterrey",
    date: "2026-06-24T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },

  // ================= GRUPO B (Rodada 1: A-D) =================
  {
    id: "copa_07",
    homeTeam: "Canadá",
    awayTeam: "Bósnia-Herzegovina",
    homeFlag: "🇨🇦",
    awayFlag: "🇧🇦",
    group: "Grupo B",
    stadium: "BMO Field",
    city: "Toronto",
    date: "2026-06-12T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_08",
    homeTeam: "Catar",
    awayTeam: "Suíça",
    homeFlag: "🇶🇦",
    awayFlag: "🇨🇭",
    group: "Grupo B",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-06-13T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_09",
    homeTeam: "Suíça",
    awayTeam: "Bósnia-Herzegovina",
    homeFlag: "🇨🇭",
    awayFlag: "🇧🇦",
    group: "Grupo B",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-18T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_10",
    homeTeam: "Canadá",
    awayTeam: "Catar",
    homeFlag: "🇨🇦",
    awayFlag: "🇶🇦",
    group: "Grupo B",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-06-18T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_11",
    homeTeam: "Bósnia-Herzegovina",
    awayTeam: "Catar",
    homeFlag: "🇧🇦",
    awayFlag: "🇶🇦",
    group: "Grupo B",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-24T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_12",
    homeTeam: "Suíça",
    awayTeam: "Canadá",
    homeFlag: "🇨🇭",
    awayFlag: "🇨🇦",
    group: "Grupo B",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-06-24T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },

  // ================= GRUPO C (Rodada 1: A-D) =================
  {
    id: "copa_13",
    homeTeam: "Brasil",
    awayTeam: "Marrocos",
    homeFlag: "🇧🇷",
    awayFlag: "🇲🇦",
    group: "Grupo C",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-13T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_14",
    homeTeam: "Haiti",
    awayTeam: "Escócia",
    homeFlag: "🇭🇹",
    awayFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    group: "Grupo C",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-13T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_15",
    homeTeam: "Escócia",
    awayTeam: "Marrocos",
    homeFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    awayFlag: "🇲🇦",
    group: "Grupo C",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-19T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_16",
    homeTeam: "Brasil",
    awayTeam: "Haiti",
    homeFlag: "🇧🇷",
    awayFlag: "🇭🇹",
    group: "Grupo C",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-06-19T21:30:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_17",
    homeTeam: "Escócia",
    awayTeam: "Brasil",
    homeFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    awayFlag: "🇧🇷",
    group: "Grupo C",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-06-24T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_18",
    homeTeam: "Marrocos",
    awayTeam: "Haiti",
    homeFlag: "🇲🇦",
    awayFlag: "🇭🇹",
    group: "Grupo C",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-24T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },

  // ================= GRUPO D (Rodada 1: A-D) =================
  {
    id: "copa_19",
    homeTeam: "Estados Unidos",
    awayTeam: "Paraguai",
    homeFlag: "🇺🇸",
    awayFlag: "🇵🇾",
    group: "Grupo D",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-12T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_20",
    homeTeam: "Austrália",
    awayTeam: "Turquia",
    homeFlag: "🇦🇺",
    awayFlag: "🇹🇷",
    group: "Grupo D",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-06-13T01:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_21",
    homeTeam: "Estados Unidos",
    awayTeam: "Austrália",
    homeFlag: "🇺🇸",
    awayFlag: "🇦🇺",
    group: "Grupo D",
    stadium: "Lumen Field",
    city: "Seattle",
    date: "2026-06-19T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_22",
    homeTeam: "Turquia",
    awayTeam: "Paraguai",
    homeFlag: "🇹🇷",
    awayFlag: "🇵🇾",
    group: "Grupo D",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-06-20T00:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_23",
    homeTeam: "Turquia",
    awayTeam: "Estados Unidos",
    homeFlag: "🇹🇷",
    awayFlag: "🇺🇸",
    group: "Grupo D",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-25T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },
  {
    id: "copa_24",
    homeTeam: "Paraguai",
    awayTeam: "Austrália",
    homeFlag: "🇵🇾",
    awayFlag: "🇦🇺",
    group: "Grupo D",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-06-25T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 1
  },

  // ================= GRUPO E (Rodada 2: E-H) =================
  {
    id: "copa_25",
    homeTeam: "Alemanha",
    awayTeam: "Curaçao",
    homeFlag: "🇩🇪",
    awayFlag: "🇨🇼",
    group: "Grupo E",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-06-14T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_26",
    homeTeam: "Costa do Marfim",
    awayTeam: "Equador",
    homeFlag: "🇨🇮",
    awayFlag: "🇪🇨",
    group: "Grupo E",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-06-14T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_27",
    homeTeam: "Alemanha",
    awayTeam: "Costa do Marfim",
    homeFlag: "🇩🇪",
    awayFlag: "🇨🇮",
    group: "Grupo E",
    stadium: "BMO Field",
    city: "Toronto",
    date: "2026-06-20T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_28",
    homeTeam: "Equador",
    awayTeam: "Curaçao",
    homeFlag: "🇪🇨",
    awayFlag: "🇨🇼",
    group: "Grupo E",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-06-20T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_29",
    homeTeam: "Curaçao",
    awayTeam: "Costa do Marfim",
    homeFlag: "🇨🇼",
    awayFlag: "🇨🇮",
    group: "Grupo E",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-06-25T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_30",
    homeTeam: "Equador",
    awayTeam: "Alemanha",
    homeFlag: "🇪🇨",
    awayFlag: "🇩🇪",
    group: "Grupo E",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-25T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },

  // ================= GRUPO F (Rodada 2: E-H) =================
  {
    id: "copa_31",
    homeTeam: "Países Baixos",
    awayTeam: "Japão",
    homeFlag: "🇳🇱",
    awayFlag: "🇯🇵",
    group: "Grupo F",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-06-14T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_32",
    homeTeam: "Suécia",
    awayTeam: "Tunísia",
    homeFlag: "🇸🇪",
    awayFlag: "🇹🇳",
    group: "Grupo F",
    stadium: "Estádio BBVA",
    city: "Monterrey",
    date: "2026-06-14T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_33",
    homeTeam: "Países Baixos",
    awayTeam: "Suécia",
    homeFlag: "🇳🇱",
    awayFlag: "🇸🇪",
    group: "Grupo F",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-06-20T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_34",
    homeTeam: "Tunísia",
    awayTeam: "Japão",
    homeFlag: "🇹🇳",
    awayFlag: "🇯🇵",
    group: "Grupo F",
    stadium: "Estádio BBVA",
    city: "Monterrey",
    date: "2026-06-21T01:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_35",
    homeTeam: "Japão",
    awayTeam: "Suécia",
    homeFlag: "🇯🇵",
    awayFlag: "🇸🇪",
    group: "Grupo F",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-06-25T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_36",
    homeTeam: "Tunísia",
    awayTeam: "Países Baixos",
    homeFlag: "🇹🇳",
    awayFlag: "🇳🇱",
    group: "Grupo F",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-06-25T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },

  // ================= GRUPO G (Rodada 2: E-H) =================
  {
    id: "copa_37",
    homeTeam: "Bélgica",
    awayTeam: "Egito",
    homeFlag: "🇧🇪",
    awayFlag: "🇪🇬",
    group: "Grupo G",
    stadium: "Lumen Field",
    city: "Seattle",
    date: "2026-06-15T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_38",
    homeTeam: "Irã",
    awayTeam: "Nova Zelândia",
    homeFlag: "🇮🇷",
    awayFlag: "🇳🇿",
    group: "Grupo G",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-15T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_39",
    homeTeam: "Bélgica",
    awayTeam: "Irã",
    homeFlag: "🇧🇪",
    awayFlag: "🇮🇷",
    group: "Grupo G",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-21T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_40",
    homeTeam: "Nova Zelândia",
    awayTeam: "Egito",
    homeFlag: "🇳🇿",
    awayFlag: "🇪🇬",
    group: "Grupo G",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-06-21T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_41",
    homeTeam: "Nova Zelândia",
    awayTeam: "Bélgica",
    homeFlag: "🇳🇿",
    awayFlag: "🇧🇪",
    group: "Grupo G",
    stadium: "Empower Field",
    city: "Denver",
    date: "2026-06-27T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_42",
    homeTeam: "Egito",
    awayTeam: "Irã",
    homeFlag: "🇪🇬",
    awayFlag: "🇮🇷",
    group: "Grupo G",
    stadium: "Lumen Field",
    city: "Seattle",
    date: "2026-06-27T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },

  // ================= GRUPO H (Rodada 2: E-H) =================
  {
    id: "copa_43",
    homeTeam: "Espanha",
    awayTeam: "Cabo Verde",
    homeFlag: "🇪🇸",
    awayFlag: "🇨🇻",
    group: "Grupo H",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-15T13:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_44",
    homeTeam: "Arábia Saudita",
    awayTeam: "Uruguai",
    homeFlag: "🇸🇦",
    awayFlag: "🇺🇾",
    group: "Grupo H",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-06-15T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_45",
    homeTeam: "Espanha",
    awayTeam: "Arábia Saudita",
    homeFlag: "🇪🇸",
    awayFlag: "🇸🇦",
    group: "Grupo H",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-21T13:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_46",
    homeTeam: "Uruguai",
    awayTeam: "Cabo Verde",
    homeFlag: "🇺🇾",
    awayFlag: "🇨🇻",
    group: "Grupo H",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-06-21T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_47",
    homeTeam: "Cabo Verde",
    awayTeam: "Arábia Saudita",
    homeFlag: "🇨🇻",
    awayFlag: "🇸🇦",
    group: "Grupo H",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-06-26T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },
  {
    id: "copa_48",
    homeTeam: "Uruguai",
    awayTeam: "Espanha",
    homeFlag: "🇺🇾",
    awayFlag: "🇪🇸",
    group: "Grupo H",
    stadium: "Estádio Akron",
    city: "Guadalajara",
    date: "2026-06-26T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 2
  },

  // ================= GRUPO I (Rodada 3: I-L) =================
  {
    id: "copa_49",
    homeTeam: "França",
    awayTeam: "Senegal",
    homeFlag: "🇫🇷",
    awayFlag: "🇸🇳",
    group: "Grupo I",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-16T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_50",
    homeTeam: "Iraque",
    awayTeam: "Noruega",
    homeFlag: "🇮🇶",
    awayFlag: "🇳🇴",
    group: "Grupo I",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-16T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_51",
    homeTeam: "França",
    awayTeam: "Iraque",
    homeFlag: "🇫🇷",
    awayFlag: "🇮🇶",
    group: "Grupo I",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-06-22T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_52",
    homeTeam: "Noruega",
    awayTeam: "Senegal",
    homeFlag: "🇳🇴",
    awayFlag: "🇸🇳",
    group: "Grupo I",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-22T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_53",
    homeTeam: "Noruega",
    awayTeam: "França",
    homeFlag: "🇳🇴",
    awayFlag: "🇫🇷",
    group: "Grupo I",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-26T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_54",
    homeTeam: "Senegal",
    awayTeam: "Iraque",
    homeFlag: "🇸🇳",
    awayFlag: "🇮🇶",
    group: "Grupo I",
    stadium: "BMO Field",
    city: "Toronto",
    date: "2026-06-26T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },

  // ================= GRUPO J (Rodada 3: I-L) =================
  {
    id: "copa_55",
    homeTeam: "Argentina",
    awayTeam: "Argélia",
    homeFlag: "🇦🇷",
    awayFlag: "🇩🇿",
    group: "Grupo J",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-06-16T22:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_56",
    homeTeam: "Áustria",
    awayTeam: "Jordânia",
    homeFlag: "🇦🇹",
    awayFlag: "🇯🇴",
    group: "Grupo J",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-06-17T01:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_57",
    homeTeam: "Argentina",
    awayTeam: "Áustria",
    homeFlag: "🇦🇷",
    awayFlag: "🇦🇹",
    group: "Grupo J",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-06-22T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_58",
    homeTeam: "Jordânia",
    awayTeam: "Argélia",
    homeFlag: "🇯🇴",
    awayFlag: "🇩🇿",
    group: "Grupo J",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-06-23T00:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_59",
    homeTeam: "Argélia",
    awayTeam: "Áustria",
    homeFlag: "🇩🇿",
    awayFlag: "🇦🇹",
    group: "Grupo J",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-06-27T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_60",
    homeTeam: "Jordânia",
    awayTeam: "Argentina",
    homeFlag: "🇯🇴",
    awayFlag: "🇦🇷",
    group: "Grupo J",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-06-27T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },

  // ================= GRUPO K (Rodada 3: I-L) =================
  {
    id: "copa_61",
    homeTeam: "Portugal",
    awayTeam: "RD do Congo",
    homeFlag: "🇵🇹",
    awayFlag: "🇨🇩",
    group: "Grupo K",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-06-17T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_62",
    homeTeam: "Uzbequistão",
    awayTeam: "Colômbia",
    homeFlag: "🇺🇿",
    awayFlag: "🇨🇴",
    group: "Grupo K",
    stadium: "Estádio Azteca",
    city: "Cidade do México",
    date: "2026-06-17T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_63",
    homeTeam: "Portugal",
    awayTeam: "Uzbequistão",
    homeFlag: "🇵🇹",
    awayFlag: "🇺🇿",
    group: "Grupo K",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-06-23T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_64",
    homeTeam: "Colômbia",
    awayTeam: "RD do Congo",
    homeFlag: "🇨🇴",
    awayFlag: "🇨🇩",
    group: "Grupo K",
    stadium: "Estádio Akron",
    city: "Guadalajara",
    date: "2026-06-23T23:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_65",
    homeTeam: "Colômbia",
    awayTeam: "Portugal",
    homeFlag: "🇨🇴",
    awayFlag: "🇵🇹",
    group: "Grupo K",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-06-27T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_66",
    homeTeam: "RD do Congo",
    awayTeam: "Uzbequistão",
    homeFlag: "🇨🇩",
    awayFlag: "🇺🇿",
    group: "Grupo K",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-27T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },

  // ================= GRUPO L (Rodada 3: I-L) =================
  {
    id: "copa_67",
    homeTeam: "Inglaterra",
    awayTeam: "Croácia",
    homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    awayFlag: "🇭🇷",
    group: "Grupo L",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-06-17T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_68",
    homeTeam: "Gana",
    awayTeam: "Panamá",
    homeFlag: "🇬🇭",
    awayFlag: "🇵🇦",
    group: "Grupo L",
    stadium: "BMO Field",
    city: "Toronto",
    date: "2026-06-17T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_69",
    homeTeam: "Inglaterra",
    awayTeam: "Gana",
    homeFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    awayFlag: "🇬🇭",
    group: "Grupo L",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-23T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_70",
    homeTeam: "Panamá",
    awayTeam: "Croácia",
    homeFlag: "🇵🇦",
    awayFlag: "🇭🇷",
    group: "Grupo L",
    stadium: "BMO Field",
    city: "Toronto",
    date: "2026-06-23T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_71",
    homeTeam: "Panamá",
    awayTeam: "Inglaterra",
    homeFlag: "🇵🇦",
    awayFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    group: "Grupo L",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-27T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },
  {
    id: "copa_72",
    homeTeam: "Croácia",
    awayTeam: "Gana",
    homeFlag: "🇭🇷",
    awayFlag: "🇬🇭",
    group: "Grupo L",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-06-27T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 3
  },

  // ================= MATA-MATA (Fase de 32, Oitavas, Quartas, Semis, Final) =================
  // Fase de 32 (Rodada 4)
  {
    id: "copa_r32_1",
    homeTeam: "1º Grupo A",
    awayTeam: "3º Grupo C, D, E ou F",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 1)",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-06-28T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_2",
    homeTeam: "2º Grupo A",
    awayTeam: "2º Grupo B",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 2)",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-06-28T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_3",
    homeTeam: "1º Grupo B",
    awayTeam: "3º Grupo A, C, D, I ou J",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 3)",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-06-29T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_4",
    homeTeam: "1º Grupo C",
    awayTeam: "3º Grupo A, B, F, G ou H",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 4)",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-06-29T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_5",
    homeTeam: "2º Grupo C",
    awayTeam: "2º Grupo K",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 5)",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-06-30T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_6",
    homeTeam: "1º Grupo D",
    awayTeam: "3º Grupo B, E, F, I ou J",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 6)",
    stadium: "Lumen Field",
    city: "Seattle",
    date: "2026-06-30T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_7",
    homeTeam: "1º Grupo E",
    awayTeam: "3º Grupo A, B, C, D ou G",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 7)",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-07-01T15:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_8",
    homeTeam: "2º Grupo E",
    awayTeam: "2º Grupo F",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 8)",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-07-01T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_9",
    homeTeam: "1º Grupo F",
    awayTeam: "3º Grupo C, D, G, H ou I",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 9)",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-07-02T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_10",
    homeTeam: "1º Grupo G",
    awayTeam: "3º Grupo E, F, H, I ou J",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 10)",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-07-02T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_11",
    homeTeam: "2º Grupo G",
    awayTeam: "2º Grupo H",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 11)",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-07-03T14:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_12",
    homeTeam: "1º Grupo H",
    awayTeam: "3º Grupo E, I, J, K ou L",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 12)",
    stadium: "Levi's Stadium",
    city: "San Francisco",
    date: "2026-07-03T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_13",
    homeTeam: "1º Grupo I",
    awayTeam: "3º Grupo E, F, G, H ou K",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 13)",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-07-03T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_14",
    homeTeam: "2º Grupo I",
    awayTeam: "2º Grupo J",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 14)",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-07-04T12:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_15",
    homeTeam: "1º Grupo J",
    awayTeam: "2º Grupo L",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 15)",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-07-04T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r32_16",
    homeTeam: "1º Grupo K",
    awayTeam: "2º Grupo D",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Fase de 32 (Jogo 16)",
    stadium: "Marcus Field",
    city: "Chicago",
    date: "2026-07-04T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },

  // Oitavas de Final (Rodada 4)
  {
    id: "copa_r16_1",
    homeTeam: "Vence Jogo 1",
    awayTeam: "Vence Jogo 2",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 18)",
    stadium: "SoFi Stadium",
    city: "Los Angeles",
    date: "2026-07-05T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_2",
    homeTeam: "Vence Jogo 3",
    awayTeam: "Vence Jogo 4",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 19)",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-07-05T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_3",
    homeTeam: "Vence Jogo 5",
    awayTeam: "Vence Jogo 6",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 20)",
    stadium: "BC Place",
    city: "Vancouver",
    date: "2026-07-06T15:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_4",
    homeTeam: "Vence Jogo 7",
    awayTeam: "Vence Jogo 8",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 21)",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-07-06T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_5",
    homeTeam: "Vence Jogo 9",
    awayTeam: "Vence Jogo 10",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 22)",
    stadium: "Estádio Azteca",
    city: "Cidade do México",
    date: "2026-07-07T16:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_6",
    homeTeam: "Vence Jogo 11",
    awayTeam: "Vence Jogo 12",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 23)",
    stadium: "Hard Rock Stadium",
    city: "Miami",
    date: "2026-07-07T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_7",
    homeTeam: "Vence Jogo 13",
    awayTeam: "Vence Jogo 14",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 24)",
    stadium: "NRG Stadium",
    city: "Houston",
    date: "2026-07-07T23:30:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_r16_8",
    homeTeam: "Vence Jogo 15",
    awayTeam: "Vence Jogo 16",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Oitavas de Final (Jogo 25)",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-07-08T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },

  // Quartas de Final (Rodada 4)
  {
    id: "copa_q8_1",
    homeTeam: "Vence Oitavas 18",
    awayTeam: "Vence Oitavas 19",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Quartas de Final (Jogo A)",
    stadium: "Gillette Stadium",
    city: "Boston",
    date: "2026-07-09T19:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_q8_2",
    homeTeam: "Vence Oitavas 20",
    awayTeam: "Vence Oitavas 21",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Quartas de Final (Jogo B)",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-07-10T20:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_q8_3",
    homeTeam: "Vence Oitavas 22",
    awayTeam: "Vence Oitavas 23",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Quartas de Final (Jogo C)",
    stadium: "Arrowhead Stadium",
    city: "Kansas City",
    date: "2026-07-11T17:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_q8_4",
    homeTeam: "Vence Oitavas 24",
    awayTeam: "Vence Oitavas 25",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Quartas de Final (Jogo D)",
    stadium: "Lincoln Financial Field",
    city: "Filadélfia",
    date: "2026-07-11T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },

  // Semifinais (Rodada 4)
  {
    id: "copa_s4_1",
    homeTeam: "Vence Quartas A",
    awayTeam: "Vence Quartas B",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Semifinal A",
    stadium: "AT&T Stadium",
    city: "Dallas",
    date: "2026-07-14T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },
  {
    id: "copa_s4_2",
    homeTeam: "Vence Quartas C",
    awayTeam: "Vence Quartas D",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Semifinal B",
    stadium: "Mercedes-Benz Stadium",
    city: "Atlanta",
    date: "2026-07-15T21:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  },

  // Final (Rodada 4)
  {
    id: "copa_f2_1",
    homeTeam: "Vence Semi A",
    awayTeam: "Vence Semi B",
    homeFlag: "🏳️",
    awayFlag: "🏳️",
    group: "Grande Final Copa 2026",
    stadium: "MetLife Stadium",
    city: "Nova York/NJ",
    date: "2026-07-19T18:00:00-03:00",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    roundNumber: 4
  }
];

export const ROUND_NAMES: Record<number, string> = {
  1: "Grupos A-D - Rodada Completa",
  2: "Grupos E-H - Rodada Completa",
  3: "Grupos I-L - Rodada Completa",
  4: "Mata-Mata Completo (32-avos a Final)"
};

// Bracket progression path mapping (from current match to next match and slot)
export const BRACKET_PROGRESSION: Record<string, { nextMatchId: string; slot: "home" | "away" }> = {
  // Round of 32 to Round of 16 (Oitavas)
  "copa_r32_1": { nextMatchId: "copa_r16_1", slot: "home" },
  "copa_r32_2": { nextMatchId: "copa_r16_1", slot: "away" },
  "copa_r32_3": { nextMatchId: "copa_r16_2", slot: "home" },
  "copa_r32_4": { nextMatchId: "copa_r16_2", slot: "away" },
  "copa_r32_5": { nextMatchId: "copa_r16_3", slot: "home" },
  "copa_r32_6": { nextMatchId: "copa_r16_3", slot: "away" },
  "copa_r32_7": { nextMatchId: "copa_r16_4", slot: "home" },
  "copa_r32_8": { nextMatchId: "copa_r16_4", slot: "away" },
  "copa_r32_9": { nextMatchId: "copa_r16_5", slot: "home" },
  "copa_r32_10": { nextMatchId: "copa_r16_5", slot: "away" },
  "copa_r32_11": { nextMatchId: "copa_r16_6", slot: "home" },
  "copa_r32_12": { nextMatchId: "copa_r16_6", slot: "away" },
  "copa_r32_13": { nextMatchId: "copa_r16_7", slot: "home" },
  "copa_r32_14": { nextMatchId: "copa_r16_7", slot: "away" },
  "copa_r32_15": { nextMatchId: "copa_r16_8", slot: "home" },
  "copa_r32_16": { nextMatchId: "copa_r16_8", slot: "away" },

  // Round of 16 (Oitavas) to Quarterfinals (Quartas)
  "copa_r16_1": { nextMatchId: "copa_q8_1", slot: "home" },
  "copa_r16_2": { nextMatchId: "copa_q8_1", slot: "away" },
  "copa_r16_3": { nextMatchId: "copa_q8_2", slot: "home" },
  "copa_r16_4": { nextMatchId: "copa_q8_2", slot: "away" },
  "copa_r16_5": { nextMatchId: "copa_q8_3", slot: "home" },
  "copa_r16_6": { nextMatchId: "copa_q8_3", slot: "away" },
  "copa_r16_7": { nextMatchId: "copa_q8_4", slot: "home" },
  "copa_r16_8": { nextMatchId: "copa_q8_4", slot: "away" },

  // Quarterfinals (Quartas) to Semifinals (Semis)
  "copa_q8_1": { nextMatchId: "copa_s4_1", slot: "home" },
  "copa_q8_2": { nextMatchId: "copa_s4_1", slot: "away" },
  "copa_q8_3": { nextMatchId: "copa_s4_2", slot: "home" },
  "copa_q8_4": { nextMatchId: "copa_s4_2", slot: "away" },

  // Semifinals (Semis) to Final
  "copa_s4_1": { nextMatchId: "copa_f2_1", slot: "home" },
  "copa_s4_2": { nextMatchId: "copa_f2_1", slot: "away" }
};


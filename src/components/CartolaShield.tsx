import React from "react";

// Formato de codificação do avatar: "formato|padrao|cor1|cor2|simbolo"
// Exemplo: "classic|stripes|#11bf65|#e2e8f0|⚽"

export interface ShieldConfig {
  shape: string;       // classic, modern, circle, star, retro
  pattern: string;     // solid, stripes, diagonal, cross, ring
  color1: string;      // hex code primary
  color2: string;      // hex code secondary
  symbol: string;      // emoji or short character glyph
}

export function parseShieldString(avatarStr: string | undefined): ShieldConfig {
  const fallback: ShieldConfig = {
    shape: "classic",
    pattern: "solid",
    color1: "#FF4B1F",
    color2: "#1F9FFD",
    symbol: "⚽"
  };

  if (!avatarStr || !avatarStr.includes("|")) {
    return fallback;
  }

  const parts = avatarStr.split("|");
  return {
    shape: parts[0] || fallback.shape,
    pattern: parts[1] || fallback.pattern,
    color1: parts[2] || fallback.color1,
    color2: parts[3] || fallback.color2,
    symbol: parts[4] || fallback.symbol
  };
}

export function serializeShield(config: ShieldConfig): string {
  return `${config.shape}|${config.pattern}|${config.color1}|${config.color2}|${config.symbol}`;
}

interface CartolaShieldProps {
  avatarString?: string;
  size?: number | string;
  className?: string;
}

export const CartolaShield: React.FC<CartolaShieldProps> = ({
  avatarString,
  size = 48,
  className = ""
}) => {
  const config = parseShieldString(avatarString);
  const sizeNum = typeof size === "number" ? size : parseInt(size) || 48;

  // Render SVG path base outlines based on shape style
  const renderClipPath = () => {
    switch (config.shape) {
      case "modern":
        // Sleek sharp bottom pointy pentagon
        return "polygon(50% 0%, 100% 15%, 85% 85%, 50% 100%, 15% 85%, 0% 15%)";
      case "circle":
        // Pure round athletic badge
        return "circle(50% at 50% 50%)";
      case "retro":
        // Retro curved shield mapped via responsive polygon
        return "polygon(10% 0%, 90% 0%, 100% 20%, 100% 65%, 50% 100%, 0% 65%, 0% 20%)";
      case "star":
        // Star outline shape
        return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
      case "hexagon":
        // Modern honeycomb hexagon
        return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
      case "octagon":
        // Heavy duty athletic octagon
        return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
      case "diamond":
        // Elegant Imperial Diamond
        return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      case "classic":
      default:
        // Traditional shield curves
        return "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)";
    }
  };

  const getBackgroundStyle = () => {
    const { pattern, color1, color2 } = config;
    switch (pattern) {
      case "stripes":
        return {
          background: `repeating-linear-gradient(90deg, ${color1}, ${color1} 15px, ${color2} 15px, ${color2} 30px)`
        };
      case "horizontal":
        return {
          background: `repeating-linear-gradient(0deg, ${color1}, ${color1} 15px, ${color2} 15px, ${color2} 30px)`
        };
      case "diagonal":
        return {
          background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`
        };
      case "gradient":
        return {
          background: `linear-gradient(135deg, ${color1}, ${color2})`
        };
      case "checkered":
        return {
          background: `repeating-conic-gradient(${color1} 0% 25%, ${color2} 0% 50%)`,
          backgroundSize: "20px 20px"
        };
      case "cross":
        return {
          background: `linear-gradient(90deg, ${color1} 50%, ${color2} 50%)`,
          position: "relative" as const
        };
      case "ring":
        return {
          backgroundColor: color2,
          boxShadow: `inset 0 0 0 ${sizeNum * 0.12}px ${color1}`
        };
      case "solid":
      default:
        return { backgroundColor: color1 };
    }
  };

  const ringStyle = config.pattern === "ring";

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shadow-lg transition-transform hover:scale-105 ${className}`}
      style={{
        width: sizeNum,
        height: sizeNum,
        minWidth: sizeNum,
        minHeight: sizeNum
      }}
    >
      {/* Outer border / shadow layer */}
      <div
        className="absolute inset-0 bg-neutral-900 duration-200"
        style={{
          clipPath: renderClipPath(),
          transform: "scale(1.08)",
          opacity: 0.85
        }}
      />

      {/* Main body of the shield */}
      <div
        className="absolute inset-0 overflow-hidden flex items-center justify-center border border-neutral-800"
        style={{
          clipPath: renderClipPath(),
          ...getBackgroundStyle()
        }}
      >
        {/* Subtle diagonal glossy overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* Cross special helper layout */}
        {config.pattern === "cross" && (
          <div
            className="absolute inset-x-0 h-1/2"
            style={{
              backgroundColor: config.color2,
              transform: "translateY(-50%) scaleY(0.7)",
              mixBlendMode: "overlay",
              opacity: 0.5
            }}
          />
        )}
      </div>

      {/* Central Symbol / Icon with glowing shadow */}
      <div
        className="relative z-10 flex items-center justify-center font-bold text-center"
        style={{
          fontSize: sizeNum * 0.46,
          textShadow: "1px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.5)"
        }}
      >
        {config.symbol}
      </div>
    </div>
  );
};

// List of configuration palettes inspired by Cartola FC theme selection
export const SHAPE_OPTIONS = [
  { id: "classic", label: "Clássico", desc: "Escudo curvado" },
  { id: "modern", label: "Moderno", desc: "Bordas afiadas" },
  { id: "circle", label: "Círculo", desc: "Badge redondo" },
  { id: "retro", label: "Retrô", desc: "Antigo refinado" },
  { id: "hexagon", label: "Hexágono", desc: "Bordas colmeia" },
  { id: "octagon", label: "Octógono", desc: "Visual robusto" },
  { id: "diamond", label: "Losango", desc: "Formato imperial" },
  { id: "star", label: "Estrela", desc: "Astro da Copa" }
];

export const PATTERN_OPTIONS = [
  { id: "solid", label: "Sólido", desc: "Cor lisa" },
  { id: "stripes", label: "Listras V", desc: "Linhas em colunas" },
  { id: "horizontal", label: "Listras H", desc: "Linhas em linhas" },
  { id: "diagonal", label: "Diagonal", desc: "Meia-pista" },
  { id: "gradient", label: "Degradê", desc: "Transição suave" },
  { id: "checkered", label: "Xadrez", desc: "Estilo tabuleiro" },
  { id: "ring", label: "Anel", desc: "Borda marcante" }
];

export const SYMBOL_OPTIONS = [
  "⚽", "🏆", "👑", "⚡", "🔥", "⭐", "🛡️", "🥅", "🦖", "🦁", "🦅", "🐺", "🐯", "🦈", "🦉", "🦊", "🐉", "🎯", "🚀", "💎", "🦾", "🥷", "👾", "🎮", "💚", "🇧🇷", "🇲🇽", "🇺🇸", "🇨🇦"
];

export const PRESET_COLORS = [
  "#FF0429", // Vermelho Cartola
  "#FF9D00", // Laranja Vivo
  "#FFE000", // Amarelo Ouro
  "#00E75C", // Verde Elétrico
  "#0099FF", // Azul Marinho
  "#7B00FF", // Roxo Neon
  "#FF00C4", // Rosa Hot
  "#0B0F19", // Dark Slate
  "#E2E8F0", // Off White
  "#16F2E2", // Ciano Fluorescence
  "#10B981", // Emerald Green
  "#EF4444", // Rose Red
  "#F59E0B", // Amber Gold
  "#3B82F6", // Royal Blue
  "#8B5CF6", // Violet Purple
  "#EC4899", // Magenta Pink
  "#6366F1", // Indigo Velvet
  "#14B8A6", // Teal Menthe
  "#84CC16", // Lime Punch
  "#F43F5E", // Ruby Rose
  "#1E293B", // Steel Gray
  "#475569", // Classic Slate
  "#D97706", // Bronze / Ochre
  "#059669"  // Deep Field Green
];

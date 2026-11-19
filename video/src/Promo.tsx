import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { along, color, Cursor, Editable, Eyebrow, font, Glyph, ramp, rise, typed, type GlyphName } from "./lib";
import { PixelPhoto } from "./PixelPhoto";

export const FPS = 30;

/** Scene lengths in frames. They add up to 45 seconds. */
const LENGTH = { hero: 135, claim: 110, demo: 320, commit: 200, agents: 230, facts: 185, end: 170 };
export const DURATION = Object.values(LENGTH).reduce((sum, n) => sum + n, 0);

const display: CSSProperties = { fontFamily: font.sans, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1 };
const pixel: CSSProperties = { fontFamily: font.pixel, fontWeight: 500, letterSpacing: "-0.02em" };
const mono: CSSProperties = { fontFamily: font.mono, fontWeight: 400 };

/** A scene that fades in and out over a few frames, on its own background. */
function Scene({
  length,
  background,
  fadeIn = true,
  fadeOut = true,
  children,
}: {
  length: number;
  background: string;
  fadeIn?: boolean;
  fadeOut?: boolean;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const opacity = Math.min(fadeIn ? ramp(frame, 0, 8) : 1, fadeOut ? 1 - ramp(frame, length - 8, 8) : 1);
  return <AbsoluteFill style={{ background, opacity, fontFamily: font.sans }}>{children}</AbsoluteFill>;
}

// ---- 1. The hero, as on the site ------------------------------------------------------

const heroPointer = (frame: number) => {
  if (frame < 58 || frame > 118) return null;
  const { x, y } = along(frame, [
    [58, 0.36, 0.42],
    [84, 0.5, 0.52],
    [118, 0.64, 0.66],
  ]);
  return { x, y };
};

function Hero() {
  const frame = useCurrentFrame();
  const pointer = heroPointer(frame);
  return (
    <Scene length={LENGTH.hero} background="#77866b" fadeIn={false}>
      <PixelPhoto intro={0} pointer={heroPointer} />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.3) 72%, rgba(0,0,0,0.72) 100%)" }}
      />
      <div style={{ position: "absolute", top: 48, left: 64, color: "#fff", fontSize: 44, ...pixel, ...rise(frame, 14) }}>Torso</div>
      <div
        style={{
          position: "absolute",
          top: 112,
          width: "100%",
          textAlign: "center",
          color: "#fff",
          fontSize: 152,
          fontFamily: font.sans,
          fontWeight: 400,
          letterSpacing: "-0.045em",
          lineHeight: 1.02,
          textShadow: "0 2px 32px rgba(0,0,0,0.32)",
          ...rise(frame, 22),
        }}
      >
        Victory needs{" "}
        <Editable state={frame > 44 ? "hover" : "plain"} onPhoto style={pixel}>
          no head.
        </Editable>
      </div>
      {pointer && <Cursor x={pointer.x * 1920} y={pointer.y * 1080} />}
    </Scene>
  );
}

// ---- 2. The claim ---------------------------------------------------------------------

function Claim() {
  const frame = useCurrentFrame();
  const lines = ["No head.", "No backend.", "No schema."];
  return (
    <Scene length={LENGTH.claim} background={color.paper}>
      <div style={{ position: "absolute", left: 140, top: 150, color: color.ink, fontSize: 156, ...display }}>
        {lines.map((line, index) => (
          <div key={line} style={{ ...rise(frame, 6 + index * 14), marginBottom: 14 }}>
            {line}
          </div>
        ))}
        <div style={{ ...rise(frame, 56), marginTop: 30 }}>
          Just{" "}
          <Editable state={frame > 72 ? "editing" : "hover"} frame={frame} style={pixel}>
            your code.
          </Editable>
        </div>
      </div>
    </Scene>
  );
}

// ---- 3. Click, type, save -------------------------------------------------------------

const BEFORE = "Ship your product, not your backlog";
const AFTER = "Ship faster. Sleep better.";

function Window({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        background: color.paper,
        border: `2px solid ${color.line}`,
        boxShadow: "0 40px 80px -40px rgba(11,11,12,0.35)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 22px", background: color.soft, borderBottom: `2px solid ${color.line}` }}>
        <div style={{ display: "flex", gap: 9 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 15, height: 15, background: "rgba(11,11,12,0.15)" }} />
          ))}
        </div>
        <div style={{ flex: 1, background: color.paper, padding: "7px 16px", fontSize: 20, color: color.muted, ...mono }}>yoursite.com/edit</div>
      </div>
      {children}
    </div>
  );
}

function CodePanel({ file, lines, marked, style }: { file: string; lines: string[]; marked: number[]; style: CSSProperties }) {
  return (
    <div style={{ position: "absolute", background: color.ink, color: "#f4f4f5", overflow: "hidden", ...style }}>
      <div style={{ padding: "18px 28px", borderBottom: `2px solid ${color.lineOnInk}`, fontSize: 20, color: color.mutedOnInk, ...mono }}>{file}</div>
      <div style={{ padding: "22px 0", fontSize: 23, lineHeight: 1.75, ...mono }}>
        {lines.map((line, index) => {
          const on = marked.includes(index);
          return (
            <div
              key={index}
              style={{
                padding: "0 28px",
                whiteSpace: "pre",
                borderLeft: `5px solid ${on ? color.mark : "transparent"}`,
                background: on ? "rgba(36,80,255,0.28)" : "transparent",
              }}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Demo() {
  const frame = useCurrentFrame();
  const heading =
    frame < 70 ? BEFORE : frame < 108 ? BEFORE.slice(0, Math.max(0, BEFORE.length - Math.round((frame - 70) * 1.05))) : typed(AFTER, frame, 110, 2.6);
  const dirty = frame >= 71;
  const saved = frame >= 252;
  const state = frame < 42 ? "plain" : frame < 58 ? "hover" : saved ? "plain" : "editing";
  const cursor = along(frame, [
    [0, 1180, 980],
    [40, 372, 392],
    [205, 372, 392],
    [244, 668, 792],
    [320, 668, 792],
  ]);
  const pressed = (frame >= 58 && frame < 64) || (frame >= 248 && frame < 255);
  const enter = rise(frame, 4, 40, 22);

  return (
    <Scene length={LENGTH.demo} background={color.paper}>
      <div style={{ position: "absolute", left: 120, top: 70, ...rise(frame, 0) }}>
        <Eyebrow>{saved ? "Save writes the source file" : "Click any text. Type."}</Eyebrow>
      </div>

      <Window style={{ left: 120, top: 150, width: 840, height: 720, ...enter }}>
        <div style={{ padding: "64px 60px", color: color.ink }}>
          <div style={{ fontSize: 68, minHeight: 150, ...display, lineHeight: 1.08 }}>
            <Editable state={state} frame={frame}>
              {heading || "​"}
            </Editable>
          </div>
          <div style={{ marginTop: 26, fontSize: 30, lineHeight: 1.5, color: color.muted }}>
            Previews for every pull request, so reviews happen on the real thing.
          </div>
          <div style={{ marginTop: 40, display: "inline-block", background: color.ink, color: color.paper, padding: "18px 34px", fontSize: 26, fontWeight: 500 }}>
            Start for free
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, background: color.ink, color: color.paper, padding: "10px 10px 10px 26px", fontSize: 22 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 11, height: 11, background: dirty && !saved ? color.markOnInk : "rgba(255,255,255,0.3)" }} />
              {saved ? "Saved 1 change" : dirty ? "1 unsaved change" : "No changes"}
            </span>
            <span
              style={{
                padding: "9px 22px",
                fontWeight: 500,
                background: dirty && !saved ? color.mark : "rgba(255,255,255,0.1)",
                color: dirty && !saved ? "#fff" : "rgba(255,255,255,0.5)",
                transform: `scale(${pressed && frame > 200 ? 0.95 : 1})`,
              }}
            >
              Save
            </span>
          </div>
        </div>
      </Window>

      <CodePanel
        file="components/hero.tsx"
        marked={dirty ? [3] : []}
        style={{ left: 1000, top: 150, width: 800, height: 720, ...rise(frame, 10, 40, 22) }}
        lines={[
          "export function Hero() {",
          "  return (",
          "    <section>",
          `      <h1>${heading}</h1>`,
          "      <p>",
          "        Previews for every pull request, so",
          "        reviews happen on the real thing.",
          "      </p>",
          '      <a href="/signup">Start for free</a>',
          "    </section>",
          "  );",
          "}",
        ]}
      />

      <div style={{ position: "absolute", left: 120, top: 910, fontSize: 40, color: color.ink, ...display, letterSpacing: "-0.03em", ...rise(frame, 20) }}>
        {saved ? "The page and the code are the same thing." : "You edit the page. Torso edits the line it came from."}
      </div>
      <Cursor x={cursor.x} y={cursor.y} pressed={pressed} />
    </Scene>
  );
}

// ---- 4. Save is a commit --------------------------------------------------------------

function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "22px 30px", fontSize: 26, ...mono, ...style }}>{children}</div>
  );
}

function Commit() {
  const frame = useCurrentFrame();
  return (
    <Scene length={LENGTH.commit} background={color.ink}>
      <div style={{ position: "absolute", left: 140, top: 110, color: "#f4f4f5" }}>
        <Eyebrow onInk>In production</Eyebrow>
        <div style={{ marginTop: 34, fontSize: 132, ...display, ...rise(frame, 4) }}>
          Save is a{" "}
          <span style={{ ...pixel, color: color.markOnInk }}>
            <Editable state="hover" style={{ outlineColor: color.markOnInk, background: "rgba(111,140,255,0.14)" }}>
              commit.
            </Editable>
          </span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 140, top: 430, width: 1640, border: `2px solid ${color.lineOnInk}`, color: "#f4f4f5", ...rise(frame, 22, 40, 22) }}>
        <Row style={{ borderBottom: `2px solid ${color.lineOnInk}` }}>
          <span style={{ width: 14, height: 14, background: color.markOnInk }} />
          <span>Edit content in components/hero.tsx</span>
          <span style={{ marginLeft: "auto", color: color.mutedOnInk }}>main · just now</span>
        </Row>
        <div style={{ padding: "18px 0", fontSize: 25, lineHeight: 1.9, ...mono }}>
          <div style={{ padding: "0 30px", background: "rgba(200,16,46,0.22)", color: "#ffb3bf", whiteSpace: "pre" }}>{`-      <h1>${BEFORE}</h1>`}</div>
          <div style={{ padding: "0 30px", background: "rgba(36,80,255,0.3)", whiteSpace: "pre", opacity: ramp(frame, 40, 10) }}>{`+      <h1>${AFTER}</h1>`}</div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 140, top: 720, width: 1640, border: `2px solid ${color.lineOnInk}`, color: "#f4f4f5", ...rise(frame, 100, 40, 22) }}>
        <Row>
          <span style={{ color: color.markOnInk }}>#12</span>
          <span>Content edits</span>
          <span style={{ color: color.mutedOnInk }}>torso/edits → main</span>
          <span style={{ marginLeft: "auto", border: `2px solid ${color.markOnInk}`, color: color.markOnInk, padding: "4px 16px", fontSize: 21 }}>OPEN</span>
        </Row>
      </div>
      <div style={{ position: "absolute", left: 140, top: 850, fontSize: 40, color: color.mutedOnInk, ...display, letterSpacing: "-0.03em", ...rise(frame, 112) }}>
        Or one pull request. Nothing goes live until you merge.
      </div>
    </Scene>
  );
}

// ---- 5. Agents ------------------------------------------------------------------------

function Agents() {
  const frame = useCurrentFrame();
  const prompt = typed("Rename the Team plan to Growth", frame, 26, 1.7);
  const done = frame >= 92;
  return (
    <Scene length={LENGTH.agents} background={color.paper}>
      <div style={{ position: "absolute", left: 140, top: 100, color: color.ink }}>
        <Eyebrow>Agent-native</Eyebrow>
        <div style={{ marginTop: 34, fontSize: 118, ...display, ...rise(frame, 4) }}>
          Agents never need to{" "}
          <Editable state="hover" style={pixel}>
            see it.
          </Editable>
        </div>
      </div>

      <div style={{ position: "absolute", left: 140, top: 420, width: 800, height: 250, background: color.ink, color: "#f4f4f5", padding: "34px 38px", fontSize: 27, lineHeight: 1.9, ...mono, ...rise(frame, 16, 40, 22) }}>
        <div>
          <span style={{ color: color.mutedOnInk }}>&gt; </span>
          {prompt}
          {!done && <span style={{ opacity: Math.floor(frame / 12) % 2 ? 0 : 1 }}>▌</span>}
        </div>
        {done && (
          <div style={rise(frame, 92, 10, 10)}>
            <span style={{ color: color.markOnInk }}>● </span>Edited lib/pricing.ts
          </div>
        )}
        {done && <div style={{ color: color.mutedOnInk, ...rise(frame, 104, 10, 10) }}>No API. No schema. No plugin.</div>}
      </div>

      <CodePanel
        file="lib/pricing.ts"
        marked={done ? [1] : []}
        style={{ left: 980, top: 420, width: 800, height: 250, ...rise(frame, 22, 40, 22) }}
        lines={["export const plans = [", `  { name: "${done ? "Growth" : "Team"}", price: 29 },`, "];"]}
      />

      <div style={{ position: "absolute", left: 140, top: 720, width: 1640, border: `2px solid ${color.line}`, color: color.ink, ...rise(frame, 128, 40, 22) }}>
        <Row style={{ borderBottom: `2px solid ${color.line}` }}>
          <span style={{ width: 14, height: 14, background: color.mark }} />
          <span>Edit content in components/hero.tsx</span>
          <span style={{ marginLeft: "auto", color: color.muted }}>a person, in the browser</span>
        </Row>
        <Row>
          <span style={{ width: 14, height: 14, background: color.mark }} />
          <span>Rename the Team plan to Growth</span>
          <span style={{ marginLeft: "auto", color: color.muted }}>a coding agent</span>
        </Row>
      </div>
      <div style={{ position: "absolute", left: 140, top: 930, fontSize: 40, color: color.muted, ...display, letterSpacing: "-0.03em", ...rise(frame, 142) }}>
        Your copy is plain code. Same files, same history.
      </div>
    </Scene>
  );
}

// ---- 6. What you get ------------------------------------------------------------------

const facts: { glyph: GlyphName; title: string; body: string }[] = [
  { glyph: "empty", title: "No schema", body: "If it is written in your JSX, it is editable." },
  { glyph: "nothing", title: "Nothing to host", body: "No content API, database or admin app." },
  { glyph: "branch", title: "Every edit versioned", body: "History, review and revert come with git." },
  { glyph: "code", title: "Components untouched", body: "No hooks, wrappers or content files." },
  { glyph: "lock", title: "Your login or a password", body: "Without either, the edit URL is a 404." },
  { glyph: "agent", title: "Agent-native", body: "Agents edit the code, like anything else." },
];

function Facts() {
  const frame = useCurrentFrame();
  return (
    <Scene length={LENGTH.facts} background={color.soft}>
      <div style={{ position: "absolute", left: 140, top: 84, color: color.ink, fontSize: 96, ...display, ...rise(frame, 2) }}>
        <span style={pixel}>Less</span> of everything a CMS brings
      </div>
      <div style={{ position: "absolute", left: 140, top: 250, width: 1640, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {facts.map((fact, index) => (
          <div key={fact.title} style={{ background: color.paper, border: `2px solid ${color.line}`, padding: "38px 40px", height: 330, ...rise(frame, 14 + index * 6, 30, 20) }}>
            <Glyph name={fact.glyph} size={68} frame={frame} start={22 + index * 6} />
            <div style={{ marginTop: 34, fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em", color: color.ink }}>{fact.title}</div>
            <div style={{ marginTop: 12, fontSize: 27, lineHeight: 1.4, color: color.muted }}>{fact.body}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 140, top: 990, fontSize: 30, color: color.muted, ...mono, ...rise(frame, 70) }}>
        Next.js today. React on Vite, experimental.
      </div>
    </Scene>
  );
}

// ---- 7. End card ----------------------------------------------------------------------

function End() {
  const frame = useCurrentFrame();
  return (
    <Scene length={LENGTH.end} background="#4a4a3a" fadeOut={false}>
      <PixelPhoto intro={0} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.58)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center" }}>
        <div style={{ fontSize: 250, lineHeight: 1, ...pixel, ...rise(frame, 16) }}>Torso</div>
        <div style={{ marginTop: 40, fontSize: 74, ...display, fontWeight: 400, ...rise(frame, 30) }}>
          Click the page. Read the{" "}
          <Editable state={frame > 60 ? "editing" : "hover"} frame={frame} onPhoto style={pixel}>
            commit.
          </Editable>
        </div>
        <div style={{ marginTop: 64, fontSize: 34, color: "rgba(255,255,255,0.85)", ...mono, ...rise(frame, 46) }}>github.com/julien1k/torso-cms</div>
      </AbsoluteFill>
    </Scene>
  );
}

export function Promo() {
  let from = 0;
  const at = (length: number) => {
    const start = from;
    from += length;
    return start;
  };
  return (
    <AbsoluteFill style={{ background: color.ink }}>
      <Sequence from={at(LENGTH.hero)} durationInFrames={LENGTH.hero}>
        <Hero />
      </Sequence>
      <Sequence from={at(LENGTH.claim)} durationInFrames={LENGTH.claim}>
        <Claim />
      </Sequence>
      <Sequence from={at(LENGTH.demo)} durationInFrames={LENGTH.demo}>
        <Demo />
      </Sequence>
      <Sequence from={at(LENGTH.commit)} durationInFrames={LENGTH.commit}>
        <Commit />
      </Sequence>
      <Sequence from={at(LENGTH.agents)} durationInFrames={LENGTH.agents}>
        <Agents />
      </Sequence>
      <Sequence from={at(LENGTH.facts)} durationInFrames={LENGTH.facts}>
        <Facts />
      </Sequence>
      <Sequence from={at(LENGTH.end)} durationInFrames={LENGTH.end}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
}

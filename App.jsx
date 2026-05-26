import { useState } from "react";

const AGENTS = [
  {
    id: "advocate",
    name: "Devil's Advocate",
    label: "ATTACKS",
    color: "#E24B4A",
    bg: "rgba(226,75,74,0.07)",
    border: "rgba(226,75,74,0.25)",
    system: "You are a sharp, experienced critic. Your ONLY job is to attack this decision. Find every weakness, flaw, and reason it could fail. Be specific and uncomfortable. No sugarcoating. Respond with 4 bullet points using • character, each 1-2 sentences.",
  },
  {
    id: "defender",
    name: "Defender",
    label: "DEFENDS",
    color: "#1D9E75",
    bg: "rgba(29,158,117,0.07)",
    border: "rgba(29,158,117,0.25)",
    system: "You are a strategic optimist. Your ONLY job is to steelman this decision — make the strongest case FOR it. Find the best arguments and opportunities. Respond with 4 bullet points using • character, each 1-2 sentences.",
  },
  {
    id: "blindspot",
    name: "Blind Spot Detector",
    label: "WHAT YOU'RE MISSING",
    color: "#EF9F27",
    bg: "rgba(239,159,39,0.07)",
    border: "rgba(239,159,39,0.25)",
    system: "You are an expert in second-order thinking. Find what the decision-maker is NOT seeing — hidden assumptions, unconsidered consequences, things taken for granted. Respond with 4 bullet points using • character, each 1-2 sentences.",
  },
  {
    id: "expert",
    name: "Domain Expert",
    label: "EXPERT LENS",
    color: "#378ADD",
    bg: "rgba(55,138,221,0.07)",
    border: "rgba(55,138,221,0.25)",
    system: "You are a seasoned expert. Analyze through technical, financial, or strategic expertise depending on the decision context. Give specific insight a generalist would miss. Respond with 4 bullet points using • character, each 1-2 sentences.",
  },
];

const callClaude = async (system, userMsg) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (!data.content || !data.content[0]) throw new Error("Empty response");
  return data.content[0].text;
};

const renderBold = (text) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 500, color: "#fff" }}>{part}</strong> : part
  );
};

const parseBullets = (text) =>
  text.split("\n").filter((l) => l.trim().startsWith("•")).map((l) => l.replace("•", "").trim());

const Spinner = ({ color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
    <div style={{
      width: 14, height: 14, borderRadius: "50%",
      border: `2px solid ${color}40`, borderTopColor: color,
      animation: "spin 0.8s linear infinite"
    }} />
    Analyzing...
  </div>
);

export default function App() {
  const [decision, setDecision] = useState("");
  const [results, setResults] = useState({});
  const [synthesis, setSynthesis] = useState("");
  const [status, setStatus] = useState({});
  const [phase, setPhase] = useState("idle");
  const [orchestration, setOrchestration] = useState(null);

  const ORCHESTRATOR_SYSTEM = `You are a decision routing orchestrator. Analyze the decision and return ONLY valid JSON, no other text.

Return this exact structure:
{
  "decisionType": "technical | business | career | personal | financial",
  "activeAgents": ["advocate", "defender", "blindspot", "expert"],
  "expertRole": "specific expert role title",
  "expertFocus": "one sentence on what this expert should focus on"
}

Rules:
- activeAgents: always include all 4 for complex decisions. Drop blindspot or expert only for very simple ones.
- expertRole examples: "Senior Software Architect", "Startup Founder", "Executive Career Coach", "Behavioral Psychologist", "CFO-level Financial Strategist"
- expertFocus: tailor to the exact decision`;

  const analyze = async () => {
    if (!decision.trim() || phase === "running" || phase === "orchestrating") return;
    setPhase("orchestrating");
    setResults({});
    setSynthesis("");
    setOrchestration(null);
    setStatus({});

    // Step 1: Orchestrator classifies and routes
    let plan;
    try {
      const raw = await callClaude(ORCHESTRATOR_SYSTEM, `Decision: ${decision}`);
      const clean = raw.replace(/```json|```/g, "").trim();
      plan = JSON.parse(clean);
    } catch {
      plan = {
        decisionType: "general",
        activeAgents: ["advocate", "defender", "blindspot", "expert"],
        expertRole: "Seasoned Strategic Advisor",
        expertFocus: "Provide domain-specific insight the decision-maker may be missing."
      };
    }
    setOrchestration(plan);

    // Step 2: Build active agents with dynamic expert role
    const activeAgents = AGENTS
      .filter(a => plan.activeAgents.includes(a.id))
      .map(a => a.id === "expert" ? {
        ...a,
        name: plan.expertRole,
        system: `You are a ${plan.expertRole}. ${plan.expertFocus} Give sharp specific insight a generalist would miss. Respond with 4 bullet points using the • character, each 1-2 sentences.`
      } : a);

    setPhase("running");
    setStatus(Object.fromEntries(activeAgents.map((a) => [a.id, "loading"])));

    const agentResults = {};

    for (const agent of activeAgents) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await callClaude(agent.system, `Decision: ${decision}`);
          agentResults[agent.id] = result;
          setResults((prev) => ({ ...prev, [agent.id]: result }));
          setStatus((prev) => ({ ...prev, [agent.id]: "done" }));
          break;
        } catch {
          if (attempt === 1) setStatus((prev) => ({ ...prev, [agent.id]: "error" }));
          else await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    setPhase("synthesizing");

    const context = Object.entries(agentResults).map(([id, text]) => { const a = AGENTS.find(ag => ag.id === id); const name = id === "expert" && plan.expertRole ? plan.expertRole : (a?.name || id); return `${name}:\n${text}`; }).join("\n\n");
    try {
      const synth = await callClaude(
        "You are a decisive senior advisor synthesizing multiple perspectives. Given the agent analyses, provide exactly: 1) VERDICT: one of (Proceed / Proceed with caution / Don't proceed) + one sentence why. 2) CRITICAL FACTORS: 2-3 bullet points with • of what actually matters here. 3) NEXT STEP: one concrete action. Be direct. No fluff.",
        `Decision: ${decision}\n\nAnalyses:\n${context}`
      );
      setSynthesis(synth);
    } catch {}

    setPhase("done");
  };

  const reset = () => {
    setPhase("idle");
    setResults({});
    setSynthesis("");
    setStatus({});
    setDecision("");
    setOrchestration(null);
  };

  const verdictColor = () => {
    if (!synthesis) return "#fff";
    const s = synthesis.toLowerCase();
    if (s.includes("don't proceed") || s.includes("do not proceed")) return "#E24B4A";
    if (s.includes("proceed with caution")) return "#EF9F27";
    return "#1D9E75";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { outline: none; }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#0A0C10",
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: "#fff", padding: "40px 24px",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 48, animation: "fadeUp 0.5s ease" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", marginBottom: 12, fontWeight: 500 }}>
              ADVERSARIAL INTELLIGENCE
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif", fontSize: 36,
              fontWeight: 700, lineHeight: 1.15, color: "#fff",
              marginBottom: 12
            }}>
              Decision Challenger
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, fontWeight: 300 }}>
              Four agents attack, defend, and pressure-test your decision.<br />No validation. No comfort. Just clarity.
            </p>
          </div>

          {/* Input */}
          {phase === "idle" && (
            <div style={{ animation: "fadeUp 0.5s ease 0.1s both" }}>
              <textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="Describe your decision. Be specific — vague input gives vague output."
                style={{
                  width: "100%", minHeight: 140, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                  padding: "20px", fontSize: 15, color: "#fff",
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                  resize: "vertical", lineHeight: 1.7, marginBottom: 16
                }}
              />
              <button
                onClick={analyze}
                disabled={!decision.trim()}
                style={{
                  background: decision.trim() ? "#fff" : "rgba(255,255,255,0.1)",
                  color: decision.trim() ? "#0A0C10" : "rgba(255,255,255,0.3)",
                  border: "none", borderRadius: 8, padding: "14px 32px",
                  fontSize: 13, fontWeight: 500, letterSpacing: "0.08em",
                  cursor: decision.trim() ? "pointer" : "not-allowed",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  transition: "all 0.2s"
                }}
              >
                CHALLENGE THIS DECISION →
              </button>
            </div>
          )}

          {/* Orchestrating phase */}
          {phase === "orchestrating" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              color: "rgba(255,255,255,0.4)", fontSize: 13,
              marginBottom: 24, animation: "fadeUp 0.4s ease"
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff",
                animation: "spin 0.8s linear infinite", flexShrink: 0
              }} />
              Orchestrator is classifying your decision...
            </div>
          )}

          {/* Orchestration badge */}
          {orchestration && phase !== "orchestrating" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 16, animation: "fadeUp 0.3s ease"
            }}>
              <div style={{
                fontSize: 10, letterSpacing: "0.15em", fontWeight: 500,
                color: "rgba(255,255,255,0.3)", textTransform: "uppercase"
              }}>
                {orchestration.decisionType} decision
              </div>
              <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}/>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Expert: {orchestration.expertRole}
              </div>
            </div>
          )}

          {/* Decision label during analysis */}
          {phase !== "idle" && phase !== "orchestrating" && (
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "16px 20px", marginBottom: 32,
              animation: "fadeUp 0.4s ease"
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>DECISION UNDER ANALYSIS</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontWeight: 300 }}>{decision}</p>
            </div>
          )}

          {/* Agent cards */}
          {phase !== "idle" && phase !== "orchestrating" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
              {AGENTS.filter(a => !orchestration || (orchestration.activeAgents || []).includes(a.id)).map((agent, i) => {
                const displayAgent = agent.id === "expert" && orchestration?.expertRole ? { ...agent, name: orchestration.expertRole } : agent;
                const bullets = results[agent.id] ? parseBullets(results[agent.id]) : [];
                const isLoading = status[agent.id] === "loading";
                const agentName = agent.id === "expert" && orchestration?.expertRole ? orchestration.expertRole : agent.name;
                return (
                  <div key={agent.id} style={{
                    background: agent.bg, border: `1px solid ${agent.border}`,
                    borderRadius: 12, padding: "20px",
                    animation: `fadeUp 0.4s ease ${i * 0.05}s both`
                  }}>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: agent.color, marginBottom: 4, fontWeight: 500 }}>
                        {agent.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>{agentName}</div>
                    </div>
                    {isLoading ? (
                      <Spinner color={agent.color} />
                    ) : bullets.length > 0 ? (
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                        {bullets.map((b, j) => (
                          <li key={j} style={{ display: "flex", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, fontWeight: 300 }}>
                            <span style={{ color: agent.color, flexShrink: 0, marginTop: 2 }}>•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : status[agent.id] === "error" ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Failed to load — try again</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Synthesis */}
          {phase === "synthesizing" && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "24px", animation: "fadeUp 0.4s ease",
              display: "flex", alignItems: "center", gap: 12,
              color: "rgba(255,255,255,0.4)", fontSize: 13
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff",
                animation: "spin 0.8s linear infinite", flexShrink: 0
              }} />
              Synthesizing verdict...
            </div>
          )}

          {synthesis && phase === "done" && (
            <div style={{
              border: `1px solid ${verdictColor()}40`,
              background: `${verdictColor()}08`,
              borderRadius: 12, padding: "28px",
              animation: "fadeUp 0.5s ease"
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: verdictColor(), marginBottom: 20, fontWeight: 500 }}>
                SYNTHESIS & VERDICT
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, fontWeight: 300 }}>
                {synthesis.split("\n").filter(l => l.trim()).map((line, i) => (
                  <p key={i} style={{ marginBottom: 10 }}>{renderBold(line)}</p>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          {phase === "done" && (
            <div style={{ marginTop: 24, animation: "fadeUp 0.4s ease" }}>
              <button
                onClick={reset}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.4)", borderRadius: 8,
                  padding: "12px 24px", fontSize: 12, letterSpacing: "0.1em",
                  cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
                  transition: "all 0.2s"
                }}
              >
                ANALYZE ANOTHER DECISION
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
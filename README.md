# Decision Adversary

Most AI tools agree with you. This one doesn't.

Decision Adversary is a multi-agent system that pressure-tests your thinking before you commit to a decision. You describe what you're considering — a pivot, a hire, a technical choice, a career move — and four specialized agents tear it apart from different angles, then synthesize a verdict.

No validation. No comfort. Just clarity.

## How it works

Before any agent fires, an **orchestrator** reads your decision, classifies it (technical, business, career, personal, financial), and dynamically assigns the right expert role. Then four agents run in sequence:

- **Devil's Advocate** — attacks the decision hard. Finds every flaw, risk, and reason it could fail.
- **Defender** — steelmans it. Makes the strongest possible case for going ahead.
- **Blind Spot Detector** — surfaces what you're not seeing. Hidden assumptions, second-order consequences, things you've taken for granted.
- **Domain Expert** — assigned dynamically based on your decision type. A software architect for technical decisions. A startup founder for product bets. A behavioral psychologist for personal ones.

A fifth **Synthesizer** agent then reads all four outputs and delivers a verdict: Proceed / Proceed with caution / Don't proceed — with the critical factors that actually matter and one concrete next step.

## Why multi-agent

A single model asked to "argue both sides" pulls its punches. It knows it's playing both roles and hedges. Separate agents with separate system prompts don't — each one is only given one job and instructed to do it without softening.

The orchestrator pattern also means the system adapts. It doesn't run the same four generic agents on every input. It reads the context first and routes accordingly.

## Tech stack

- React (Vite)
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- Sequential agent execution with retry logic
- Dynamic orchestration via structured JSON routing

## Run it

This is built as a Claude artifact — it runs directly in the Claude.ai interface without a backend. To run it locally, paste `App.jsx` into a Vite React project and add your Anthropic API key handling.

## What's next

This is a prototype. The architecture is solid — the next meaningful upgrade is memory across decisions, so the system can track patterns in how you think and flag recurring blind spots over time.

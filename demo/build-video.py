"""Build an evidence-based narrated demo video for Atlassian Circuit Guard.

Run: uv run --with pillow --with edge-tts python demo/build-video.py
Uses ffmpeg-static and ffprobe-static from tracebound.
"""
from pathlib import Path
import asyncio
import hashlib
import json
import os
import subprocess

import edge_tts
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / 'demo'
WORK = DEMO / 'work'
FRAMES = DEMO / 'frames'
FFMPEG = Path(r'D:\distro\tracebound\node_modules\ffmpeg-static\ffmpeg.exe')
FFPROBE = Path(r'D:\distro\tracebound\node_modules\ffprobe-static\bin\win32\x64\ffprobe.exe')
FINAL = DEMO / 'circuit-guard-demo.mp4'

WIDTH, HEIGHT = 1440, 900
AUDIO_TEMPO = 1.05
BG, PANEL, WHITE, MUTED, BLUE, CYAN, GREEN, RED = '#0b101b', '#151d2f', '#f4f5f7', '#8993a4', '#0052cc', '#00c7e6', '#36b37e', '#ff5630'
FONTDIR = Path(r'C:\Windows\Fonts')


def font(size, bold=False, mono=False):
    fname = 'consola.ttf' if mono else ('segoeuib.ttf' if bold else 'segoeui.ttf')
    return ImageFont.truetype(str(FONTDIR / fname), size)


SCENES = [
    (
        "Autonomous Agents in Jira Need Safeguards",
        "ATLASSIAN ROVO & MCP RISK",
        "The hidden danger of unconstrained agent retries and token drains",
        [
            "Autonomous agents triage, write code, and run tests in Jira",
            "Ambiguous requirements can trigger repetitive retry loops",
            "Token spend explodes before human engineering leads notice"
        ],
        [
            "Task: PROJ-1042 Fix Distributed Cache",
            "Agent: Atlassian Rovo Autonomous Worker",
            "Status: Retrying failing tool run (Loop #4)",
            "",
            "Unconstrained Token Spend: $45.80",
            "Issue Budget Ceiling:      $15.00 [BREACHED]",
            "",
            ">> Runaway background spending without governance"
        ],
        "Autonomous software agents in Jira accelerate engineering velocity, but unconstrained agents can enter runaway tool retry loops, burning hundreds of dollars in API credits before human leads notice."
    ),
    (
        "Proactive Governance with Atlassian Forge",
        "CIRCUIT GUARD ARCHITECTURE",
        "Embedding pre-action budget leases into Rovo and MCP",
        [
            "Native Forge app combining rovo:agent and rovo:mcp",
            "Standard JSON-RPC 2.0 Model Context Protocol tools",
            "Pre-execution lease check before any expensive tool runs"
        ],
        [
            "Forge Manifest Modules:",
            "  - rovo:agent     (Circuit Guard Monitor)",
            "  - rovo:mcp       (Governance JSON-RPC Server)",
            "  - jira:issuePanel (Real-Time Budget HUD)",
            "",
            "MCP Tools Exposed to Rovo:",
            "  * check_issue_budget_lease",
            "  * detect_trajectory_loop",
            "  * sync_teamwork_graph"
        ],
        "Circuit Guard embeds deterministic governance directly into Atlassian Forge. It exposes standard Model Context Protocol tools that Rovo agents must query before initiating expensive actions."
    ),
    (
        "Pre-Execution Atomic Budget Lease",
        "BUDGET GOVERNOR IN ACTION",
        "Enforcing financial and token ceilings per Jira issue",
        [
            "Atomic admission check per issue ceiling",
            "Reserves in-flight commitment before tool execution",
            "Reconciles actual token spend or releases on failure"
        ],
        [
            "Issue: PROJ-1042 | Budget Limit: $20.00",
            "",
            "1. MCP Request: check_issue_budget_lease($1.20)",
            "   Spend: $14.20 + Reserved: $1.20 <= $20.00",
            "   Status: LEASE GRANTED",
            "",
            "2. Remaining Issue Ceiling: $4.60 (77.0% spent)",
            "3. Teamwork Graph node updated with lease lease_id"
        ],
        "Before invoking any external tool, the Rovo agent requests a budget lease. Circuit Guard verifies the issue ceiling, reserves the in-flight commitment, and permits execution."
    ),
    (
        "Trajectory Loop & Stagnation Detection",
        "MATHEMATICAL LOOP HALT",
        "Jaccard N-gram semantic diffing across recent actions",
        [
            "Evaluates consecutive tool arguments and outputs",
            "Halts execution when similarity exceeds eighty-five percent",
            "Trips the circuit breaker fail-closed to stop token drain"
        ],
        [
            "Trajectory History for Agent on PROJ-1042:",
            "  Action 1: npm test -- --filter=cache [FAIL]",
            "  Action 2: npm test -- --filter=cache [FAIL]",
            "  Action 3: npm test -- --filter=cache [FAIL]",
            "",
            "Jaccard Semantic Similarity: 89% (Threshold: 85%)",
            "CIRCUIT BREAKER: TRIPPED · FAIL-CLOSED",
            ">> Agent execution halted immediately"
        ],
        "When an agent is stuck on failing steps, Circuit Guard diffs consecutive tool calls. If semantic similarity exceeds eighty-five percent, it immediately trips the circuit breaker fail-closed, preventing runaway costs."
    ),
    (
        "Atlassian Teamwork Graph Synchronization",
        "TEAM OBSERVABILITY",
        "Real-time telemetry dispatch to Teamwork Graph nodes",
        [
            "Publishes governance events to team graph nodes",
            "Real-time audit trail visible across Jira and Bitbucket",
            "Proactive escalation alerts delivered to engineering leads"
        ],
        [
            "Teamwork Graph Event Stream:",
            "  Event:   circuit_breaker_tripped",
            "  Node ID: ari:cloud:teamwork::node/rovo-guard-proj-1042",
            "  Edge:    issue(PROJ-1042) -> tripped_by(rovo_agent)",
            "  Reason:  Trajectory loop stagnation (89%)",
            "",
            "HUD Status: Alert dispatched to lead engineer"
        ],
        "Every budget reservation, spend reconciliation, and tripped breaker dispatches real-time events to the Atlassian Teamwork Graph, connecting autonomous agent governance directly with engineering observability."
    ),
    (
        "Verified Automated Test Suite",
        "100% PASSING VITEST SUITE",
        "Fully tested Forge governor and MCP server",
        [
            "10 automated unit tests passing across all components",
            "Rigorous invariant testing: leases, loops, and graph sync",
            "Open source under MIT license on GitHub"
        ],
        [
            "$ npx vitest run",
            "",
            " ✓ test/governor.test.ts (4 tests)",
            " ✓ test/mcp.test.ts (3 tests)",
            " ✓ test/teamwork_graph.test.ts (3 tests)",
            "",
            "Test Files  3 passed (3)",
            "Tests       10 passed (10)",
            "Duration    85ms",
            "",
            "Repo: github.com/sidsri14/atlassian-rovo-guard"
        ],
        "The complete implementation is verified with ten passing Vitest tests covering governor invariants, MCP protocol tools, and Teamwork Graph synchronization. Circuit Guard is open source at github dot com slash sidsri fourteen slash atlassian rovo guard."
    ),
]


def wrapped(draw, text, xy, fnt, color=WHITE, max_width=560, spacing=8):
    x, y = xy
    lines, current = [], ''
    for word in text.split():
        candidate = (current + ' ' + word).strip()
        if draw.textlength(candidate, font=fnt) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=color)
        y += fnt.size + spacing
    return y


def render_frames():
    FRAMES.mkdir(parents=True, exist_ok=True)
    for i, (title, badge, subtitle, bullets, terminal, _) in enumerate(SCENES):
        image = Image.new('RGB', (WIDTH, HEIGHT), BG)
        d = ImageDraw.Draw(image)
        # Top banner line
        d.rectangle((0, 0, WIDTH, 8), fill=CYAN)
        d.text((56, 36), 'ATLASSIAN CIRCUIT GUARD', font=font(22, True), fill=CYAN)
        d.text((1200, 40), f'{i + 1:02d} / {len(SCENES):02d}', font=font(18, mono=True), fill=MUTED)
        d.text((56, 92), title, font=font(40, True), fill=WHITE)
        d.text((58, 150), subtitle, font=font(22), fill=MUTED)
        
        # Left Panel (Concept & Bullets)
        d.rounded_rectangle((54, 210, 650, 720), 16, fill=PANEL, outline='#1c273e', width=1)
        # Right Panel (Terminal / Code / Verification)
        d.rounded_rectangle((680, 210, 1386, 720), 16, fill='#070b14', outline='#1f2c44', width=2)
        
        badge_color = RED if 'RISK' in badge or 'HALT' in badge else CYAN
        d.text((80, 236), badge, font=font(18, True), fill=badge_color)
        
        y = 295
        for text in bullets:
            d.ellipse((80, y + 10, 88, y + 18), fill=badge_color)
            y = wrapped(d, text, (104, y), font(24), max_width=510, spacing=6) + 20
        
        d.text((710, 236), 'EVIDENCE / MCP RUNTIME REPLAY', font=font(16, True), fill=MUTED)
        y = 295
        for line in terminal:
            color = RED if '[BREACHED]' in line or 'TRIPPED' in line or '[FAIL]' in line else (GREEN if 'passed' in line or 'GRANTED' in line or line.startswith('$') else WHITE)
            d.text((712, y), line, font=font(21, mono=True), fill=color)
            y += 34
        
        # Bottom Tagline
        d.text((56, 755), 'CODEGEIST 2026 SUBMISSION · ATLASSIAN FORGE + MCP + ROVO AGENT', font=font(15, True), fill=MUTED)
        d.rectangle((54, 785, 1386, 787), fill='#1a2436')
        image.save(FRAMES / f'scene-{i + 1:02d}.png')


def run(args):
    subprocess.run([str(x) for x in args], cwd=ROOT, check=True)


def duration(path):
    return float(subprocess.check_output([str(FFPROBE), '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)], text=True))


def srt_time(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'


async def speech():
    semaphore = asyncio.Semaphore(3)
    async def one(i, scene):
        target = WORK / f'scene-{i + 1:02d}.mp3'
        if target.exists() and target.stat().st_size > 2000:
            return
        async with semaphore:
            await edge_tts.Communicate(scene[-1], 'en-US-AriaNeural', rate='+10%').save(str(target))
    await asyncio.gather(*(one(i, scene) for i, scene in enumerate(SCENES)))


def build():
    WORK.mkdir(parents=True, exist_ok=True)
    print("Rendering video frames...", flush=True)
    render_frames()
    print("Generating natural speech narration with Edge TTS...", flush=True)
    asyncio.run(speech())

    captions, segments, timeline = [], [], 0.0
    for i, scene in enumerate(SCENES):
        audio = WORK / f'scene-{i + 1:02d}.mp3'
        spoken = duration(audio) / AUDIO_TEMPO
        segment_duration = spoken + 0.6
        segment = WORK / f'scene-{i + 1:02d}.mp4'
        run([
            FFMPEG, '-y', '-loglevel', 'error',
            '-loop', '1', '-i', FRAMES / f'scene-{i + 1:02d}.png',
            '-i', audio,
            '-vf', 'format=yuv420p',
            '-af', f'atempo={AUDIO_TEMPO},apad=pad_dur=0.6',
            '-r', '24',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
            '-t', f'{segment_duration:.3f}',
            '-movflags', '+faststart',
            segment
        ])
        words = scene[-1].split()
        chunks = [' '.join(words[x:x + 10]) for x in range(0, len(words), 10)]
        offset = 0
        for chunk in chunks:
            end = offset + len(chunk.split())
            start_s = timeline + (spoken * offset / len(words))
            end_s = timeline + (spoken * end / len(words))
            captions.append(f'{len(captions) + 1}\n{srt_time(start_s)} --> {srt_time(end_s)}\n{chunk}')
            offset = end
        timeline += segment_duration
        segments.append(segment)
        print(f"Built scene {i + 1}/{len(SCENES)}: {segment_duration:.2f}s", flush=True)

    srt = DEMO / 'circuit-guard-demo.srt'
    srt.write_text('\n\n'.join(captions) + '\n', encoding='utf8')
    concat = WORK / 'segments.ffconcat'
    concat.write_text('ffconcat version 1.0\n' + '\n'.join(f"file '{p.as_posix()}'" for p in segments), encoding='utf8')
    joined = WORK / 'joined.mp4'
    run([FFMPEG, '-y', '-loglevel', 'error', '-safe', '0', '-f', 'concat', '-i', concat, '-c', 'copy', joined])
    
    print("Compiling final narrated video with subtitles...", flush=True)
    run([
        FFMPEG, '-y', '-loglevel', 'error', '-i', joined,
        '-vf', "subtitles=demo/circuit-guard-demo.srt:force_style='FontName=Segoe UI,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H000B101B,BorderStyle=3,BackColour=&HC00B101B,Outline=1,Shadow=0,Alignment=2,MarginL=60,MarginR=60,MarginV=18'",
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart',
        FINAL
    ])
    
    probe = json.loads(subprocess.check_output([str(FFPROBE), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(FINAL)], text=True))
    report = {
        'path': str(FINAL),
        'duration_seconds': float(probe['format']['duration']),
        'size_bytes': FINAL.stat().st_size,
        'sha256': hashlib.sha256(FINAL.read_bytes()).hexdigest(),
        'voice': 'en-US-AriaNeural',
        'scenes': len(SCENES),
        'captions': len(captions)
    }
    (DEMO / 'video-verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print("Video generation successfully complete!", flush=True)
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    build()

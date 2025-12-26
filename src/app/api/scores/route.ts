import { NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { Score } from "@/models/Score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCORE_LIMIT = 10;
const MAX_NAME_LENGTH = 40;
const MAX_CANDLES = 29;
const MAX_TIME_MS = 15000;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanName = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
};

const cleanEmail = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
};

const isTopTenCandidate = (candles: number, timeMs: number, scores: Score[]) => {
  if (scores.length < SCORE_LIMIT) return true;
  const lastEntry = scores[scores.length - 1];
  if (!lastEntry) return true;
  if (candles > lastEntry.candles) return true;
  if (candles === lastEntry.candles && timeMs < lastEntry.timeMs) return true;
  return false;
};

const serializeScore = (entry: Score) => ({
  id: entry.id,
  name: entry.name,
  candles: entry.candles,
  timeMs: entry.timeMs,
  createdAt: entry.createdAt.toISOString(),
});

export async function GET() {
  try {
    await ensureDb();
    const scores = await Score.findAll({
      order: [
        ["candles", "DESC"],
        ["timeMs", "ASC"],
        ["createdAt", "ASC"],
      ],
      limit: SCORE_LIMIT,
    });
    return NextResponse.json({ scores: scores.map(serializeScore) });
  } catch {
    return NextResponse.json(
      { error: "Unable to load scores." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const body =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const name = cleanName(body.name);
  const candlesValue = Number(body.candles);
  const timeMsValue = Number(body.timeMs);
  const email = cleanEmail(body.email);

  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(candlesValue) ||
    candlesValue < 0 ||
    candlesValue > MAX_CANDLES
  ) {
    return NextResponse.json(
      { error: "Candles must be a valid number." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(timeMsValue) ||
    timeMsValue < 0 ||
    timeMsValue > MAX_TIME_MS
  ) {
    return NextResponse.json(
      { error: "Time must be a valid number." },
      { status: 400 },
    );
  }

  if (email && !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Email must be valid." },
      { status: 400 },
    );
  }

  try {
    await ensureDb();
    const currentTop = await Score.findAll({
      order: [
        ["candles", "DESC"],
        ["timeMs", "ASC"],
        ["createdAt", "ASC"],
      ],
      limit: SCORE_LIMIT,
    });

    const requiresEmail = isTopTenCandidate(
      Math.floor(candlesValue),
      Math.floor(timeMsValue),
      currentTop,
    );
    if (requiresEmail && !email) {
      return NextResponse.json(
        { error: "Email required for top 10 scores." },
        { status: 400 },
      );
    }

    await Score.create({
      name,
      candles: Math.floor(candlesValue),
      timeMs: Math.floor(timeMsValue),
      email: email || null,
    });

    const scores = await Score.findAll({
      order: [
        ["candles", "DESC"],
        ["timeMs", "ASC"],
        ["createdAt", "ASC"],
      ],
      limit: SCORE_LIMIT,
    });

    return NextResponse.json({ scores: scores.map(serializeScore) });
  } catch {
    return NextResponse.json(
      { error: "Unable to save score." },
      { status: 500 },
    );
  }
}

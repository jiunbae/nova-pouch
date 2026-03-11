import crypto from 'node:crypto';
import { MongoServerError, ObjectId, type Filter } from 'mongodb';
import { getDb } from '../db/mongo';
import { HttpError } from '../lib/httpError';
import {
  getLikesCollection,
  getRecordsCollection,
  type DailyTokens,
  type NovaRecordDocument,
  type NovaToken,
} from '../models/record';

export type NovaRecordView = {
  id: string;
  shortId: string | null;
  userId: string | null;
  anonName: string | null;
  date: string;
  tokens: DailyTokens;
  story: string;
  likeCount: number;
  createdAt: string;
};

const RED_TOKENS: NovaToken[] = [
  { id: 'red-door', label: '문', emoji: '🚪', labelEn: 'Door' },
  { id: 'red-key', label: '열쇠', emoji: '🗝️', labelEn: 'Key' },
  { id: 'red-book', label: '책', emoji: '📘', labelEn: 'Book' },
  { id: 'red-clock', label: '시계', emoji: '⏰', labelEn: 'Clock' },
  { id: 'red-bridge', label: '다리', emoji: '🌉', labelEn: 'Bridge' },
  { id: 'red-window', label: '창문', emoji: '🪟', labelEn: 'Window' },
  { id: 'red-letter', label: '편지', emoji: '✉️', labelEn: 'Letter' },
  { id: 'red-mirror', label: '거울', emoji: '🪞', labelEn: 'Mirror' },
  { id: 'red-island', label: '섬', emoji: '🏝️', labelEn: 'Island' },
  { id: 'red-train', label: '기차', emoji: '🚆', labelEn: 'Train' },
];

const BLUE_TOKENS: NovaToken[] = [
  { id: 'blue-singing', label: '노래하는', emoji: '🎵', labelEn: 'Singing' },
  { id: 'blue-floating', label: '떠다니는', emoji: '🫧', labelEn: 'Floating' },
  { id: 'blue-burning', label: '타오르는', emoji: '🔥', labelEn: 'Burning' },
  { id: 'blue-whispering', label: '속삭이는', emoji: '🗣️', labelEn: 'Whispering' },
  { id: 'blue-forgotten', label: '잊혀진', emoji: '🫥', labelEn: 'Forgotten' },
  { id: 'blue-endless', label: '끝없는', emoji: '♾️', labelEn: 'Endless' },
  { id: 'blue-fragile', label: '부서지기 쉬운', emoji: '🧊', labelEn: 'Fragile' },
  { id: 'blue-luminous', label: '빛나는', emoji: '✨', labelEn: 'Luminous' },
  { id: 'blue-silent', label: '고요한', emoji: '🤫', labelEn: 'Silent' },
  { id: 'blue-invisible', label: '보이지 않는', emoji: '🫥', labelEn: 'Invisible' },
];

const GREEN_TOKENS: NovaToken[] = [
  { id: 'green-two-people', label: '2명이 동시에', emoji: '👥', labelEn: 'Two people at once' },
  { id: 'green-under-rain', label: '비가 오는 동안만', emoji: '🌧️', labelEn: 'Only while raining' },
  { id: 'green-before-sunrise', label: '해뜨기 전에만', emoji: '🌅', labelEn: 'Before sunrise only' },
  { id: 'green-no-words', label: '말 없이', emoji: '🤐', labelEn: 'Without words' },
  { id: 'green-with-closed-eyes', label: '눈을 감은 채', emoji: '🙈', labelEn: 'With eyes closed' },
  { id: 'green-once-lifetime', label: '인생에서 한 번만', emoji: '1️⃣', labelEn: 'Only once in a lifetime' },
  { id: 'green-in-midnight', label: '자정에만', emoji: '🕛', labelEn: 'At midnight only' },
  { id: 'green-without-touch', label: '손대지 않고', emoji: '🫳', labelEn: 'Without touching' },
  { id: 'green-in-public', label: '사람들 앞에서만', emoji: '🎭', labelEn: 'Only in public' },
  { id: 'green-in-three-minutes', label: '3분 안에', emoji: '⏳', labelEn: 'Within three minutes' },
];

const BASE62_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateShortId(length = 7): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i]! % 62];
  }
  return result;
}

function dateString(date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function parseObjectId(value: string, fieldName: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new HttpError(400, `Invalid ${fieldName}`);
  }
  return new ObjectId(value);
}

function hashWithPrime(input: string, prime: number): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash + char.charCodeAt(0) * prime) % 2_147_483_647;
  }
  return hash;
}

function tokensMatch(a: DailyTokens, b: DailyTokens): boolean {
  return a.red.id === b.red.id && a.blue.id === b.blue.id && a.green.id === b.green.id;
}

function normalizeDate(date: string | undefined): string {
  const candidate = date || dateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw new HttpError(400, 'Invalid date format. Use YYYY-MM-DD');
  }
  return candidate;
}

function serializeRecord(record: NovaRecordDocument): NovaRecordView {
  return {
    id: record._id?.toString() || '',
    shortId: record.shortId || null,
    userId: record.userId ? record.userId.toString() : null,
    anonName: record.anonName || null,
    date: record.date,
    tokens: record.tokens,
    story: record.story,
    likeCount: record.likeCount,
    createdAt: record.createdAt.toISOString(),
  };
}

export function getDailyTokens(dateStr: string): DailyTokens {
  const normalizedDate = normalizeDate(dateStr);
  return {
    red: RED_TOKENS[hashWithPrime(`${normalizedDate}:red`, 31) % RED_TOKENS.length] as NovaToken,
    blue: BLUE_TOKENS[hashWithPrime(`${normalizedDate}:blue`, 37) % BLUE_TOKENS.length] as NovaToken,
    green: GREEN_TOKENS[hashWithPrime(`${normalizedDate}:green`, 41) % GREEN_TOKENS.length] as NovaToken,
  };
}

export function getTodayDateString(): string {
  return dateString();
}

export async function createRecord(input: {
  userId?: string;
  anonName?: string;
  date: string;
  tokens: DailyTokens;
  story: string;
}): Promise<NovaRecordView> {
  const db = getDb();
  const records = getRecordsCollection(db);

  const normalizedDate = normalizeDate(input.date);
  const expectedTokens = getDailyTokens(normalizedDate);

  if (!tokensMatch(input.tokens, expectedTokens)) {
    throw new HttpError(400, 'Submitted tokens do not match the daily token combination');
  }

  const story = input.story?.trim();
  if (!story) throw new HttpError(400, 'Story is required');
  if (story.length > 5000) throw new HttpError(400, 'Story must be 5000 characters or fewer');

  const userObjectId = input.userId ? parseObjectId(input.userId, 'user id') : null;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortId = generateShortId();
    const recordToInsert: NovaRecordDocument = {
      shortId,
      userId: userObjectId,
      anonName: input.anonName?.trim().slice(0, 50) || undefined,
      date: normalizedDate,
      tokens: input.tokens,
      story,
      likeCount: 0,
      createdAt: new Date(),
    };

    try {
      const insertResult = await records.insertOne(recordToInsert);
      const created = await records.findOne({ _id: insertResult.insertedId });
      if (!created) throw new Error('Created record not found');
      return serializeRecord(created);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const keyPattern = error.keyPattern as Record<string, number> | undefined;
        if (keyPattern?.shortId && attempt < maxRetries - 1) continue;
        throw new HttpError(409, 'Only one record per day is allowed for each user');
      }
      throw error;
    }
  }

  throw new HttpError(500, 'Failed to generate unique short ID');
}

export async function getRecords(options: {
  date?: string;
  page?: number;
  limit?: number;
  sort?: 'likes' | 'newest';
}): Promise<{ date: string; page: number; limit: number; total: number; totalPages: number; records: NovaRecordView[] }> {
  const db = getDb();
  const records = getRecordsCollection(db);

  const date = normalizeDate(options.date);
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = options.sort === 'likes' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    records.find({ date }).sort(sort).skip(skip).limit(limit).toArray(),
    records.countDocuments({ date }),
  ]);

  return {
    date,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    records: items.map(serializeRecord),
  };
}

export async function getRecord(recordId: string): Promise<NovaRecordView | null> {
  const db = getDb();
  const records = getRecordsCollection(db);
  const objectId = parseObjectId(recordId, 'record id');
  const record = await records.findOne({ _id: objectId });
  if (!record) return null;
  return serializeRecord(record);
}

export async function getRecordByShortId(shortId: string): Promise<NovaRecordView | null> {
  const db = getDb();
  const records = getRecordsCollection(db);
  const record = await records.findOne({ shortId });
  if (!record) return null;
  return serializeRecord(record);
}

export async function toggleLike(
  recordId: string,
  userId?: string,
  anonFingerprint?: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const db = getDb();
  const records = getRecordsCollection(db);
  const likes = getLikesCollection(db);

  const recordObjectId = parseObjectId(recordId, 'record id');
  const record = await records.findOne({ _id: recordObjectId }, { projection: { _id: 1 } });
  if (!record) throw new HttpError(404, 'Record not found');

  const identityFilter: Filter<any> = { recordId: recordObjectId };
  let resolvedUserId: ObjectId | null = null;

  if (userId) {
    resolvedUserId = parseObjectId(userId, 'user id');
    identityFilter.userId = resolvedUserId;
  } else if (anonFingerprint?.trim()) {
    identityFilter.anonFingerprint = anonFingerprint.trim();
  } else {
    throw new HttpError(400, 'Anonymous fingerprint is required when not authenticated');
  }

  const existingLike = await likes.findOne(identityFilter);
  let liked: boolean;

  if (existingLike) {
    const { deletedCount } = await likes.deleteOne({ _id: existingLike._id });
    if (deletedCount === 1) {
      await records.updateOne({ _id: recordObjectId }, { $inc: { likeCount: -1 } });
    }
    liked = false;
  } else {
    try {
      await likes.insertOne({
        recordId: recordObjectId,
        userId: resolvedUserId,
        anonFingerprint: resolvedUserId ? undefined : anonFingerprint?.trim(),
        createdAt: new Date(),
      });
      await records.updateOne({ _id: recordObjectId }, { $inc: { likeCount: 1 } });
      liked = true;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        liked = true;
      } else {
        throw error;
      }
    }
  }

  const updated = await records.findOne({ _id: recordObjectId }, { projection: { likeCount: 1 } });
  return { liked, likeCount: Math.max(0, updated?.likeCount ?? 0) };
}

export async function getUserRecords(userId: string, limit = 200): Promise<NovaRecordView[]> {
  const db = getDb();
  const records = getRecordsCollection(db);
  const userObjectId = parseObjectId(userId, 'user id');
  const items = await records.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return items.map(serializeRecord);
}

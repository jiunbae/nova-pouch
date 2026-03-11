import { type Collection, type Db, ObjectId } from 'mongodb';

export interface NovaToken {
  id: string;
  label: string;
  emoji: string;
  labelEn: string;
}

export interface DailyTokens {
  red: NovaToken;
  blue: NovaToken;
  green: NovaToken;
}

export interface NovaRecordDocument {
  _id?: ObjectId;
  shortId?: string;
  userId: ObjectId | null;
  anonName?: string;
  date: string;
  tokens: DailyTokens;
  story: string;
  likeCount: number;
  createdAt: Date;
}

export interface NovaLikeDocument {
  _id?: ObjectId;
  recordId: ObjectId;
  userId: ObjectId | null;
  anonFingerprint?: string;
  createdAt: Date;
}

export function getRecordsCollection(db: Db): Collection<NovaRecordDocument> {
  return db.collection<NovaRecordDocument>('nova_records');
}

export function getLikesCollection(db: Db): Collection<NovaLikeDocument> {
  return db.collection<NovaLikeDocument>('nova_likes');
}

export async function createIndexes(db: Db): Promise<void> {
  const records = getRecordsCollection(db);
  const likes = getLikesCollection(db);

  await records.createIndex({ date: -1, createdAt: -1 }, { name: 'date_createdAt_desc' });
  await records.createIndex({ date: 1, likeCount: -1, createdAt: -1 }, { name: 'date_likes_desc' });
  await records.createIndex(
    { shortId: 1 },
    {
      unique: true,
      name: 'shortId_unique',
      partialFilterExpression: { shortId: { $type: 'string' } },
    },
  );
  await records.createIndex({ userId: 1 }, { name: 'userId_idx' });
  await records.createIndex(
    { date: 1, userId: 1 },
    {
      unique: true,
      name: 'date_userId_unique',
      partialFilterExpression: { userId: { $type: 'objectId' } },
    },
  );

  await likes.createIndex(
    { recordId: 1, userId: 1 },
    {
      unique: true,
      name: 'record_user_like_unique',
      partialFilterExpression: { userId: { $type: 'objectId' } },
    },
  );
  await likes.createIndex(
    { recordId: 1, anonFingerprint: 1 },
    {
      unique: true,
      name: 'record_anon_like_unique',
      partialFilterExpression: { anonFingerprint: { $type: 'string' } },
    },
  );
}

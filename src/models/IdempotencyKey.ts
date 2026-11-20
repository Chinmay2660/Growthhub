import mongoose, { Schema, Model } from "mongoose";

export interface IIdempotencyKey {
  userId: string;
  key: string;
  status: "pending" | "done";
  responseStatus?: number;
  responseBody?: unknown;
  createdAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>({
  userId: { type: String, required: true },
  key: { type: String, required: true },
  status: { type: String, enum: ["pending", "done"], default: "pending" },
  responseStatus: Number,
  responseBody: Schema.Types.Mixed,
  // Keys only need to outlive the offline replay window.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});
IdempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true });

const IdempotencyKey: Model<IIdempotencyKey> =
  mongoose.models.IdempotencyKey ?? mongoose.model<IIdempotencyKey>("IdempotencyKey", IdempotencyKeySchema);

export default IdempotencyKey;

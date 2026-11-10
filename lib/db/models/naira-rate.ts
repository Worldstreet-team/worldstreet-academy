import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * The naira rate a bank transfer is quoted at (client, 2026-11-05: "use a fixed
 * exchange rate at checkout, it can be updated automatically if possible").
 * One row, `key: "USD_NGN"`, read and written only by lib/naira-rate.ts:
 * `market` is the last rate fetched from the public feed (refreshed about
 * daily), `pinned` an admin's own rate, which wins while set. New collection,
 * written only by the web — the Go API never reads it.
 */
export interface INairaRate extends Document {
  _id: Types.ObjectId
  key: "USD_NGN"
  /** Naira per US dollar from the feed; `asOf` is the feed's own update time. */
  market: { ngnPerUsd: number; asOf: Date; fetchedAt: Date } | null
  /** An admin's rate, used instead of the market rate until cleared. */
  pinned: { ngnPerUsd: number; by: Types.ObjectId; byName: string; at: Date } | null
  /**
   * The last few rates replaced (a new market reading, a changed or cleared
   * pin) and when, newest last — so a proof submitted at a rate checkout
   * showed just before it changed still stores that rate.
   */
  recent: { ngnPerUsd: number; source: "pinned" | "market"; until: Date }[]
  createdAt: Date
  updatedAt: Date
}

const NairaRateSchema = new Schema<INairaRate>(
  {
    key: { type: String, enum: ["USD_NGN"], required: true, unique: true },
    market: {
      type: new Schema(
        {
          ngnPerUsd: { type: Number, required: true, min: 1 },
          asOf: { type: Date, required: true },
          fetchedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    pinned: {
      type: new Schema(
        {
          ngnPerUsd: { type: Number, required: true, min: 1 },
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          byName: { type: String, required: true },
          at: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    recent: {
      type: [
        new Schema(
          {
            ngnPerUsd: { type: Number, required: true, min: 1 },
            source: { type: String, enum: ["pinned", "market"], required: true },
            until: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "nairarates" }
)

export const NairaRate: Model<INairaRate> =
  mongoose.models.NairaRate || mongoose.model<INairaRate>("NairaRate", NairaRateSchema)

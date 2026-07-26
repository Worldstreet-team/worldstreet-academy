import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Exam question — MCQ only in v1 ("single" = radio, "multi" = checkboxes).
 *
 * SECURITY: `correctOptionIds` is `select: false` — it never rides along on
 * default queries. Grading and the instructor builder opt in explicitly with
 * `.select("+correctOptionIds")`; the student runner never does.
 */

export type QuestionType = "single" | "multi"

export interface IQuestionOption {
  id: string
  text: string
}

export interface IQuestion extends Document {
  _id: Types.ObjectId
  exam: Types.ObjectId
  type: QuestionType
  prompt: string
  options: IQuestionOption[]
  correctOptionIds: string[]
  points: number
  order: number
  createdAt: Date
  updatedAt: Date
}

const QuestionSchema = new Schema<IQuestion>(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    type: { type: String, enum: ["single", "multi"], default: "single" },
    prompt: { type: String, required: true, maxlength: 2000 },
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true, maxlength: 500 },
        _id: false,
      },
    ],
    correctOptionIds: { type: [String], required: true, select: false },
    points: { type: Number, default: 1, min: 1, max: 100 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

QuestionSchema.index({ exam: 1, order: 1 })

export const Question: Model<IQuestion> =
  mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema)

import mongoose, { Schema, Document, Model, Types } from "mongoose"

export interface IMessage extends Document {
  _id: Types.ObjectId
  conversationId: Types.ObjectId
  senderId: Types.ObjectId
  receiverId: Types.ObjectId
  content: string
  type: "text" | "image" | "video" | "audio" | "file"
  fileUrl?: string
  fileUrls?: string[] // Multiple file URLs (multi-image)
  fileName?: string
  fileSize?: string
  duration?: string // For audio/video
  waveform?: number[] // Audio waveform data for visualization
  isRead: boolean
  isDelivered: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IConversation extends Document {
  _id: Types.ObjectId
  participants: Types.ObjectId[]
  lastMessage?: Types.ObjectId
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file"],
      default: "text",
    },
    fileUrl: {
      type: String,
    },
    fileUrls: {
      type: [String],
      default: undefined,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: String,
    },
    duration: {
      type: String,
    },
    waveform: {
      type: [Number],
      default: undefined,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 })
ConversationSchema.index({ participants: 1 })
ConversationSchema.index({ lastMessageAt: -1 })

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema)

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>("Conversation", ConversationSchema)

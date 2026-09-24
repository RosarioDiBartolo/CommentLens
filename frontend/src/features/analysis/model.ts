import { z } from 'zod'

const count = z.number().int().nonnegative()
const probabilities = z.record(z.string(), z.number().min(0).max(1))
const answer = z.object({ label: z.string(), probabilities })
const answersSchema = z.object({
  sentiment: answer, stance: answer, question: answer, toxicity: answer,
})
const summarySchema = z.object({
  count,
  signals: z.record(z.string(), probabilities).optional(),
})
export const decisionsSchema = z.object({
  status: z.enum(['disabled', 'complete', 'partial', 'unavailable']),
  provider: z.string().optional(),
  total: count.optional(),
  summary: summarySchema,
  error: z.string().nullable().optional(),
})
const commentSchema = z.object({
  comment_id: z.string(), text: z.string(), author: z.string(),
  likes: count, similarity: z.number(), decisions: answersSchema.optional(),
})
export const analysisSchema = z.object({
  analysis_id: z.number().int(), video_id: z.string(), video_title: z.string(),
  fetched_at: z.iso.datetime({ offset: true }),
  total_comments_fetched: count, total_after_cleaning: count, cached: z.boolean(),
  decisions: decisionsSchema.optional(),
  clusters: z.array(z.object({
    cluster_id: z.number().int(), title: z.string(), size: count,
    avg_likes: z.number().nonnegative(), percentage: z.number().min(0).max(100),
    comments: z.array(commentSchema), decision_summary: summarySchema.optional(),
  })),
})

export type Analysis = z.infer<typeof analysisSchema>
export type Comment = z.infer<typeof commentSchema>
export type Summary = z.infer<typeof summarySchema>
export type Answers = z.infer<typeof answersSchema>
export type Decisions = z.infer<typeof decisionsSchema>
export interface AnalysisRequest { url: string; refresh: boolean }

export const snapshotSchema = z.object({
  run_id: z.uuid(), video_id: z.string(), video_title: z.string(),
  fetched_at: z.iso.datetime({ offset: true }), total_comments_fetched: count, cached: z.boolean(),
})
export const opinionsSchema = z.object({
  decisions: decisionsSchema.extend({ comments: z.array(z.object({
    comment_id: z.string(), text: z.string(), author: z.string(), likes: count, answers: answersSchema,
  })) }),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Opinions = z.infer<typeof opinionsSchema>

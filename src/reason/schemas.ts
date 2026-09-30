import { z } from "zod";

export const businessLogicNoteSchema = z.object({
  endpoint: z.object({
    method: z.string().optional(),
    route: z.string(),
    file: z.string(),
    line: z.number().optional(),
    description: z.string(),
  }),
  intendedRule: z.string(),
  concern: z.string(),
  relatedFindingIds: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]),
});

export const businessLogicResponseSchema = z.object({
  notes: z.array(businessLogicNoteSchema),
});

export const attackChainSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["race-condition", "generic-logic-chain"]),
  narrative: z.string(),
  impact: z.string(),
  steps: z.array(
    z.object({
      order: z.number(),
      action: z.string(),
      description: z.string(),
      findingIds: z.array(z.string()).default([]),
    })
  ),
  findingIds: z.array(z.string()).default([]),
  businessLogicNoteIndex: z.number().optional(),
  suggestedFix: z.object({
    summary: z.string(),
    diffHint: z.string().optional(),
  }),
  plannerConfidence: z.enum(["low", "medium", "high"]),
});

export const plannerResponseSchema = z.object({
  chains: z.array(attackChainSchema),
});

export type BusinessLogicResponse = z.infer<typeof businessLogicResponseSchema>;
export type PlannerResponse = z.infer<typeof plannerResponseSchema>;

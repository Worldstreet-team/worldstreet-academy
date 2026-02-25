/**
 * Vivid AI — barrel exports
 */

export { VividProvider, useVivid } from "./provider"
export { VividWidget } from "../../components/vivid/vivid-widget"
export { VividWrapper } from "../../components/vivid/vivid-wrapper"
export { RealtimeClient } from "./realtime-client"
export { createVividSession, executeVividFunction } from "./actions"
export { buildAcademyPrompt, generateFunctionInstructions } from "./prompt"
export { allVividFunctions, clientFunctions, serverFunctions } from "./functions"
export { useVividStore } from "./store"
export type * from "./types"

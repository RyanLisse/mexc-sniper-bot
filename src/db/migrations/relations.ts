import { relations } from "drizzle-orm/relations";
import {
  account,
  alertInstances,
  alertNotifications,
  alertRules,
  apiCredentials,
  executionHistory,
  notificationChannels,
  patternEmbeddings,
  patternSimilarityCache,
  positionSnapshots,
  session,
  simulationSessions,
  simulationTrades,
  snipeTargets,
  strategyConfigBackups,
  strategyPerformanceMetrics,
  strategyPhaseExecutions,
  strategyTemplates,
  tradingStrategies,
  transactionLocks,
  transactionQueue,
  transactions,
  user,
  userPreferences,
} from "./schema";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  apiCredentials: many(apiCredentials),
  executionHistories: many(executionHistory),
  snipeTargets: many(snipeTargets),
  positionSnapshots: many(positionSnapshots),
  sessions: many(session),
  simulationSessions: many(simulationSessions),
  tradingStrategies: many(tradingStrategies),
  strategyPerformanceMetrics: many(strategyPerformanceMetrics),
  strategyPhaseExecutions: many(strategyPhaseExecutions),
  transactions: many(transactions),
  userPreferences: many(userPreferences),
}));

export const alertInstancesRelations = relations(alertInstances, ({ one, many }) => ({
  alertRule: one(alertRules, {
    fields: [alertInstances.ruleId],
    references: [alertRules.id],
  }),
  alertNotifications: many(alertNotifications),
}));

export const alertRulesRelations = relations(alertRules, ({ many }) => ({
  alertInstances: many(alertInstances),
}));

export const alertNotificationsRelations = relations(alertNotifications, ({ one }) => ({
  alertInstance: one(alertInstances, {
    fields: [alertNotifications.alertId],
    references: [alertInstances.id],
  }),
  notificationChannel: one(notificationChannels, {
    fields: [alertNotifications.channelId],
    references: [notificationChannels.id],
  }),
}));

export const notificationChannelsRelations = relations(notificationChannels, ({ many }) => ({
  alertNotifications: many(alertNotifications),
}));

export const apiCredentialsRelations = relations(apiCredentials, ({ one }) => ({
  user: one(user, {
    fields: [apiCredentials.userId],
    references: [user.id],
  }),
}));

export const executionHistoryRelations = relations(executionHistory, ({ one }) => ({
  user: one(user, {
    fields: [executionHistory.userId],
    references: [user.id],
  }),
  snipeTarget: one(snipeTargets, {
    fields: [executionHistory.snipeTargetId],
    references: [snipeTargets.id],
  }),
}));

export const snipeTargetsRelations = relations(snipeTargets, ({ one, many }) => ({
  executionHistories: many(executionHistory),
  user: one(user, {
    fields: [snipeTargets.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
}));

export const patternSimilarityCacheRelations = relations(patternSimilarityCache, ({ one }) => ({
  patternEmbedding_patternId1: one(patternEmbeddings, {
    fields: [patternSimilarityCache.patternId1],
    references: [patternEmbeddings.patternId],
    relationName: "patternSimilarityCache_patternId1_patternEmbeddings_patternId",
  }),
  patternEmbedding_patternId2: one(patternEmbeddings, {
    fields: [patternSimilarityCache.patternId2],
    references: [patternEmbeddings.patternId],
    relationName: "patternSimilarityCache_patternId2_patternEmbeddings_patternId",
  }),
}));

export const patternEmbeddingsRelations = relations(patternEmbeddings, ({ many }) => ({
  patternSimilarityCaches_patternId1: many(patternSimilarityCache, {
    relationName: "patternSimilarityCache_patternId1_patternEmbeddings_patternId",
  }),
  patternSimilarityCaches_patternId2: many(patternSimilarityCache, {
    relationName: "patternSimilarityCache_patternId2_patternEmbeddings_patternId",
  }),
}));

export const positionSnapshotsRelations = relations(positionSnapshots, ({ one }) => ({
  user: one(user, {
    fields: [positionSnapshots.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const simulationSessionsRelations = relations(simulationSessions, ({ one, many }) => ({
  user: one(user, {
    fields: [simulationSessions.userId],
    references: [user.id],
  }),
  simulationTrades: many(simulationTrades),
}));

export const simulationTradesRelations = relations(simulationTrades, ({ one }) => ({
  simulationSession: one(simulationSessions, {
    fields: [simulationTrades.sessionId],
    references: [simulationSessions.id],
  }),
}));

export const tradingStrategiesRelations = relations(tradingStrategies, ({ one, many }) => ({
  user: one(user, {
    fields: [tradingStrategies.userId],
    references: [user.id],
  }),
  strategyTemplate: one(strategyTemplates, {
    fields: [tradingStrategies.strategyTemplateId],
    references: [strategyTemplates.id],
  }),
  strategyConfigBackups: many(strategyConfigBackups),
  strategyPerformanceMetrics: many(strategyPerformanceMetrics),
  strategyPhaseExecutions: many(strategyPhaseExecutions),
}));

export const strategyTemplatesRelations = relations(strategyTemplates, ({ many }) => ({
  tradingStrategies: many(tradingStrategies),
}));

export const strategyConfigBackupsRelations = relations(strategyConfigBackups, ({ one }) => ({
  tradingStrategy: one(tradingStrategies, {
    fields: [strategyConfigBackups.strategyId],
    references: [tradingStrategies.id],
  }),
}));

export const strategyPerformanceMetricsRelations = relations(
  strategyPerformanceMetrics,
  ({ one }) => ({
    user: one(user, {
      fields: [strategyPerformanceMetrics.userId],
      references: [user.id],
    }),
    tradingStrategy: one(tradingStrategies, {
      fields: [strategyPerformanceMetrics.strategyId],
      references: [tradingStrategies.id],
    }),
  })
);

export const strategyPhaseExecutionsRelations = relations(strategyPhaseExecutions, ({ one }) => ({
  user: one(user, {
    fields: [strategyPhaseExecutions.userId],
    references: [user.id],
  }),
  tradingStrategy: one(tradingStrategies, {
    fields: [strategyPhaseExecutions.strategyId],
    references: [tradingStrategies.id],
  }),
}));

export const transactionQueueRelations = relations(transactionQueue, ({ one }) => ({
  transactionLock: one(transactionLocks, {
    fields: [transactionQueue.lockId],
    references: [transactionLocks.lockId],
  }),
}));

export const transactionLocksRelations = relations(transactionLocks, ({ many }) => ({
  transactionQueues: many(transactionQueue),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
  snipeTarget: one(snipeTargets, {
    fields: [transactions.snipeTargetId],
    references: [snipeTargets.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(user, {
    fields: [userPreferences.userId],
    references: [user.id],
  }),
}));

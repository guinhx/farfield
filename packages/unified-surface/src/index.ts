import { gzipSync, gunzipSync, strFromU8, strToU8 } from "fflate";
import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const NullableStringSchema = z.union([z.string(), z.null()]);
const NonNegativeIntSchema = z.number().int().nonnegative();
const DEFAULT_CONTENT_REF_BYTE_LIMIT = 8_192;
const CONTENT_REF_PREVIEW_MAX_CHARS = 1_200;

export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonPrimitive = z.infer<typeof JsonPrimitiveSchema>;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

export const UnifiedProviderIdSchema = z.enum(["codex", "opencode"]);
export type UnifiedProviderId = z.infer<typeof UnifiedProviderIdSchema>;

export const UnifiedContentRefKindSchema = z.enum([
  "agentText",
  "reasoningText",
  "turnDiff",
  "commandOutput",
  "fileDiff",
  "mcpArguments",
  "mcpResult",
  "dynamicArguments",
  "dynamicContentItems"
]);
export type UnifiedContentRefKind = z.infer<typeof UnifiedContentRefKindSchema>;

export const UnifiedContentRefSchema = z
  .object({
    id: NonEmptyStringSchema,
    kind: UnifiedContentRefKindSchema,
    contentType: z.enum(["text", "json"]),
    byteLength: NonNegativeIntSchema,
    preview: z.union([z.string(), z.null()])
  })
  .strict();
export type UnifiedContentRef = z.infer<typeof UnifiedContentRefSchema>;

export const UnifiedContentRefValueSchema = z
  .object({
    ref: UnifiedContentRefSchema,
    value: JsonValueSchema
  })
  .strict();
export type UnifiedContentRefValue = z.infer<typeof UnifiedContentRefValueSchema>;

export const UnifiedApprovalPolicySchema = z.enum([
  "untrusted",
  "on-failure",
  "on-request",
  "never"
]);
export type UnifiedApprovalPolicy = z.infer<typeof UnifiedApprovalPolicySchema>;

export const UNIFIED_FEATURE_IDS = [
  "listThreads",
  "createThread",
  "readThread",
  "sendMessage",
  "interrupt",
  "listModels",
  "listCollaborationModes",
  "setCollaborationMode",
  "submitUserInput",
  "readLiveState",
  "readStreamEvents",
  "listProjectDirectories"
 ] as const;

export const UnifiedFeatureIdSchema = z.enum(UNIFIED_FEATURE_IDS);
export type UnifiedFeatureId = z.infer<typeof UnifiedFeatureIdSchema>;

export const UnifiedFeatureUnavailableReasonSchema = z.enum([
  "unsupportedByProvider",
  "providerDisabled",
  "providerDisconnected",
  "providerNotReady",
  "requiresOwnerClientId"
]);
export type UnifiedFeatureUnavailableReason = z.infer<typeof UnifiedFeatureUnavailableReasonSchema>;

export const UnifiedFeatureAvailabilitySchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("available")
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      reason: UnifiedFeatureUnavailableReasonSchema,
      detail: z.string().optional()
    })
    .strict()
]);
export type UnifiedFeatureAvailability = z.infer<typeof UnifiedFeatureAvailabilitySchema>;

export type UnifiedFeatureMatrix = Record<
  UnifiedProviderId,
  Record<UnifiedFeatureId, UnifiedFeatureAvailability>
>;

export const UnifiedFeatureMatrixSchema = z
  .object({
    codex: z.record(UnifiedFeatureIdSchema, UnifiedFeatureAvailabilitySchema),
    opencode: z.record(UnifiedFeatureIdSchema, UnifiedFeatureAvailabilitySchema)
  })
  .strict();

export const UnifiedModelSchema = z
  .object({
    id: NonEmptyStringSchema,
    displayName: z.string(),
    description: z.string(),
    defaultReasoningEffort: NullableStringSchema.optional(),
    supportedReasoningEfforts: z.array(z.string()).default([]),
    hidden: z.boolean().optional().default(false),
    isDefault: z.boolean().optional().default(false)
  })
  .strict();
export type UnifiedModel = z.infer<typeof UnifiedModelSchema>;

export const UnifiedCollaborationModeSchema = z
  .object({
    name: z.string(),
    mode: NonEmptyStringSchema,
    model: NullableStringSchema.optional(),
    reasoningEffort: NullableStringSchema.optional(),
    developerInstructions: NullableStringSchema.optional()
  })
  .strict();
export type UnifiedCollaborationMode = z.infer<typeof UnifiedCollaborationModeSchema>;

const UnifiedInputTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string()
  })
  .strict();

const UnifiedInputImagePartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string()
  })
  .strict();

const UnifiedInputLocalImagePartSchema = z
  .object({
    type: z.literal("localImage"),
    path: z.string()
  })
  .strict();

const UnifiedInputSkillPartSchema = z
  .object({
    type: z.literal("skill"),
    name: z.string(),
    path: z.string()
  })
  .strict();

const UnifiedInputMentionPartSchema = z
  .object({
    type: z.literal("mention"),
    name: z.string(),
    path: z.string()
  })
  .strict();

export const UnifiedInputPartSchema = z.union([
  UnifiedInputTextPartSchema,
  UnifiedInputImagePartSchema,
  UnifiedInputLocalImagePartSchema,
  UnifiedInputSkillPartSchema,
  UnifiedInputMentionPartSchema
]);
export type UnifiedInputPart = z.infer<typeof UnifiedInputPartSchema>;

const UnifiedQuestionOptionSchema = z
  .object({
    label: z.string(),
    description: z.string()
  })
  .strict();

export const UnifiedUserInputRequestIdSchema = z.union([NonNegativeIntSchema, NonEmptyStringSchema]);
export type UnifiedUserInputRequestId = z.infer<typeof UnifiedUserInputRequestIdSchema>;

export const UnifiedUserInputQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string(),
    question: z.string(),
    options: z.array(UnifiedQuestionOptionSchema).default([]),
    isOther: z.boolean().optional().default(false),
    isSecret: z.boolean().optional().default(false)
  })
  .strict();
export type UnifiedUserInputQuestion = z.infer<typeof UnifiedUserInputQuestionSchema>;

const UnifiedUserInputAnswerSchema = z
  .object({
    answers: z.array(z.string())
  })
  .strict();

export const UnifiedUserInputResponseSchema = z
  .object({
    answers: z.record(UnifiedUserInputAnswerSchema)
  })
  .strict();
export type UnifiedUserInputResponse = z.infer<typeof UnifiedUserInputResponseSchema>;

const UnifiedNetworkApprovalProtocolSchema = z.enum([
  "http",
  "https",
  "socks5Tcp",
  "socks5Udp"
]);

const UnifiedNetworkApprovalContextSchema = z
  .object({
    host: z.string(),
    protocol: UnifiedNetworkApprovalProtocolSchema
  })
  .strict();

const UnifiedNetworkPolicyRuleActionSchema = z.enum(["allow", "deny"]);

const UnifiedNetworkPolicyAmendmentSchema = z
  .object({
    action: UnifiedNetworkPolicyRuleActionSchema,
    host: z.string()
  })
  .strict();

const UnifiedAdditionalFileSystemPermissionsSchema = z
  .object({
    read: z.union([z.array(z.string()), z.null()]),
    write: z.union([z.array(z.string()), z.null()])
  })
  .strict();

const UnifiedAdditionalMacOsPermissionsSchema = z
  .object({
    accessibility: z.union([z.boolean(), z.null()]).optional(),
    automations: z.union([z.boolean(), z.array(z.string()), z.null()]).optional(),
    calendar: z.union([z.boolean(), z.null()]).optional(),
    preferences: z.union([z.boolean(), z.string(), z.null()]).optional()
  })
  .strict();

const UnifiedAdditionalPermissionProfileSchema = z
  .object({
    network: z.union([z.boolean(), z.null()]),
    fileSystem: z.union([UnifiedAdditionalFileSystemPermissionsSchema, z.null()]),
    macos: z.union([UnifiedAdditionalMacOsPermissionsSchema, z.null()])
  })
  .strict();

const UnifiedRequestedCommandActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    command: z.string().optional(),
    name: z.string().optional(),
    path: NullableStringSchema.optional(),
    query: NullableStringSchema.optional()
  })
  .strict();

const UnifiedCommandExecutionApprovalDecisionSchema = z.union([
  z.literal("accept"),
  z.literal("acceptForSession"),
  z.literal("decline"),
  z.literal("cancel"),
  z
    .object({
      acceptWithExecpolicyAmendment: z
        .object({
          execpolicy_amendment: z.array(z.string())
        })
        .strict()
    })
    .strict(),
  z
    .object({
      applyNetworkPolicyAmendment: z
        .object({
          network_policy_amendment: UnifiedNetworkPolicyAmendmentSchema
        })
        .strict()
    })
    .strict()
]);
export type UnifiedCommandExecutionApprovalDecision = z.infer<
  typeof UnifiedCommandExecutionApprovalDecisionSchema
>;

const UnifiedFileChangeApprovalDecisionSchema = z.enum([
  "accept",
  "acceptForSession",
  "decline",
  "cancel"
]);
export type UnifiedFileChangeApprovalDecision = z.infer<typeof UnifiedFileChangeApprovalDecisionSchema>;

const UnifiedLegacyReviewDecisionSchema = z.union([
  z.literal("approved"),
  z.literal("approved_for_session"),
  z.literal("denied"),
  z.literal("abort"),
  z
    .object({
      approved_execpolicy_amendment: z
        .object({
          proposed_execpolicy_amendment: z.array(z.string())
        })
        .strict()
    })
    .strict(),
  z
    .object({
      network_policy_amendment: z
        .object({
          network_policy_amendment: UnifiedNetworkPolicyAmendmentSchema
        })
        .strict()
    })
    .strict()
]);
export type UnifiedLegacyReviewDecision = z.infer<typeof UnifiedLegacyReviewDecisionSchema>;

export const UnifiedCommandExecutionApprovalResponseSchema = z
  .object({
    decision: UnifiedCommandExecutionApprovalDecisionSchema
  })
  .strict();
export type UnifiedCommandExecutionApprovalResponse = z.infer<
  typeof UnifiedCommandExecutionApprovalResponseSchema
>;

export const UnifiedFileChangeApprovalResponseSchema = z
  .object({
    decision: UnifiedFileChangeApprovalDecisionSchema
  })
  .strict();
export type UnifiedFileChangeApprovalResponse = z.infer<
  typeof UnifiedFileChangeApprovalResponseSchema
>;

export const UnifiedLegacyReviewApprovalResponseSchema = z
  .object({
    decision: UnifiedLegacyReviewDecisionSchema
  })
  .strict();
export type UnifiedLegacyReviewApprovalResponse = z.infer<
  typeof UnifiedLegacyReviewApprovalResponseSchema
>;

export const UnifiedThreadRequestResponseSchema = z.union([
  UnifiedUserInputResponseSchema,
  UnifiedCommandExecutionApprovalResponseSchema,
  UnifiedFileChangeApprovalResponseSchema,
  UnifiedLegacyReviewApprovalResponseSchema
]);
export type UnifiedThreadRequestResponse = z.infer<typeof UnifiedThreadRequestResponseSchema>;

export const UnifiedUserInputRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("item/tool/requestUserInput"),
    params: z
      .object({
        threadId: NonEmptyStringSchema,
        turnId: NonEmptyStringSchema,
        itemId: NonEmptyStringSchema,
        questions: z.array(UnifiedUserInputQuestionSchema)
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedUserInputRequest = z.infer<typeof UnifiedUserInputRequestSchema>;

export const UnifiedCommandExecutionApprovalRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("item/commandExecution/requestApproval"),
    params: z
      .object({
        threadId: NonEmptyStringSchema,
        turnId: NonEmptyStringSchema,
        itemId: NonEmptyStringSchema,
        approvalId: z.union([z.string(), z.null()]).optional(),
        reason: NullableStringSchema.optional(),
        networkApprovalContext: z
          .union([UnifiedNetworkApprovalContextSchema, z.null()])
          .optional(),
        command: NullableStringSchema.optional(),
        cwd: NullableStringSchema.optional(),
        commandActions: z
          .union([z.array(UnifiedRequestedCommandActionSchema), z.null()])
          .optional(),
        additionalPermissions: z
          .union([UnifiedAdditionalPermissionProfileSchema, z.null()])
          .optional(),
        proposedExecpolicyAmendment: z.union([z.array(z.string()), z.null()]).optional(),
        proposedNetworkPolicyAmendments: z
          .union([z.array(UnifiedNetworkPolicyAmendmentSchema), z.null()])
          .optional(),
        availableDecisions: z
          .union([z.array(UnifiedCommandExecutionApprovalDecisionSchema), z.null()])
          .optional()
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedCommandExecutionApprovalRequest = z.infer<
  typeof UnifiedCommandExecutionApprovalRequestSchema
>;

export const UnifiedFileChangeApprovalRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("item/fileChange/requestApproval"),
    params: z
      .object({
        threadId: NonEmptyStringSchema,
        turnId: NonEmptyStringSchema,
        itemId: NonEmptyStringSchema,
        reason: NullableStringSchema.optional(),
        grantRoot: NullableStringSchema.optional()
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedFileChangeApprovalRequest = z.infer<
  typeof UnifiedFileChangeApprovalRequestSchema
>;

export const UnifiedPlanImplementationRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("item/plan/requestImplementation"),
    params: z
      .object({
        threadId: NonEmptyStringSchema,
        turnId: NonEmptyStringSchema,
        planContent: z.string()
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedPlanImplementationRequest = z.infer<typeof UnifiedPlanImplementationRequestSchema>;

export const UnifiedDynamicToolCallRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("item/tool/call"),
    params: z
      .object({
        threadId: NonEmptyStringSchema,
        turnId: NonEmptyStringSchema,
        callId: NonEmptyStringSchema,
        tool: NonEmptyStringSchema,
        arguments: JsonValueSchema
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedDynamicToolCallRequest = z.infer<typeof UnifiedDynamicToolCallRequestSchema>;

export const UnifiedChatgptAuthTokensRefreshRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("account/chatgptAuthTokens/refresh"),
    params: z
      .object({
        reason: z.literal("unauthorized"),
        previousAccountId: z.union([z.string(), z.null()]).optional()
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedChatgptAuthTokensRefreshRequest = z.infer<
  typeof UnifiedChatgptAuthTokensRefreshRequestSchema
>;

export const UnifiedApplyPatchApprovalRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("applyPatchApproval"),
    params: z
      .object({
        conversationId: NonEmptyStringSchema,
        callId: NonEmptyStringSchema,
        fileChanges: z.record(JsonValueSchema),
        reason: NullableStringSchema,
        grantRoot: NullableStringSchema
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedApplyPatchApprovalRequest = z.infer<typeof UnifiedApplyPatchApprovalRequestSchema>;

export const UnifiedExecCommandApprovalRequestSchema = z
  .object({
    id: UnifiedUserInputRequestIdSchema,
    method: z.literal("execCommandApproval"),
    params: z
      .object({
        conversationId: NonEmptyStringSchema,
        callId: NonEmptyStringSchema,
        approvalId: z.union([z.string(), z.null()]),
        command: z.array(z.string()),
        cwd: z.string(),
        reason: NullableStringSchema,
        parsedCmd: z.array(JsonValueSchema)
      })
      .strict(),
    completed: z.boolean().optional()
  })
  .strict();
export type UnifiedExecCommandApprovalRequest = z.infer<
  typeof UnifiedExecCommandApprovalRequestSchema
>;

export const UnifiedApprovalThreadRequestSchema = z.union([
  UnifiedCommandExecutionApprovalRequestSchema,
  UnifiedFileChangeApprovalRequestSchema,
  UnifiedApplyPatchApprovalRequestSchema,
  UnifiedExecCommandApprovalRequestSchema
]);
export type UnifiedApprovalThreadRequest = z.infer<typeof UnifiedApprovalThreadRequestSchema>;

export const UnifiedThreadRequestSchema = z.union([
  UnifiedUserInputRequestSchema,
  UnifiedPlanImplementationRequestSchema,
  UnifiedCommandExecutionApprovalRequestSchema,
  UnifiedFileChangeApprovalRequestSchema,
  UnifiedDynamicToolCallRequestSchema,
  UnifiedChatgptAuthTokensRefreshRequestSchema,
  UnifiedApplyPatchApprovalRequestSchema,
  UnifiedExecCommandApprovalRequestSchema
]);
export type UnifiedThreadRequest = z.infer<typeof UnifiedThreadRequestSchema>;

const UnifiedUserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userMessage"),
    content: z.array(UnifiedInputPartSchema)
  })
  .strict();

const UnifiedSteeringUserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("steeringUserMessage"),
    content: z.array(UnifiedInputPartSchema),
    attachments: z.array(JsonValueSchema).optional()
  })
  .strict();

const UnifiedAgentMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("agentMessage"),
    text: z.string(),
    textRef: UnifiedContentRefSchema.optional()
  })
  .strict();

const UnifiedErrorItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("error"),
    message: z.string(),
    willRetry: z.boolean().optional(),
    errorInfo: NullableStringSchema.optional(),
    additionalDetails: z.union([JsonValueSchema, z.null()]).optional()
  })
  .strict();

const UnifiedReasoningItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("reasoning"),
    summary: z.array(z.string()).optional(),
    text: z.string().optional(),
    textRef: UnifiedContentRefSchema.optional()
  })
  .strict();

const UnifiedPlanItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("plan"),
    text: z.string()
  })
  .strict();

const UnifiedTodoListItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("todoList"),
    explanation: NullableStringSchema.optional(),
    plan: z.array(
      z
        .object({
          step: z.string(),
          status: NonEmptyStringSchema
        })
        .strict()
    )
  })
  .strict();

const UnifiedPlanImplementationItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("planImplementation"),
    turnId: NonEmptyStringSchema,
    planContent: z.string(),
    isCompleted: z.boolean().optional()
  })
  .strict();

const UnifiedUserInputResponseItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userInputResponse"),
    requestId: UnifiedUserInputRequestIdSchema,
    turnId: NonEmptyStringSchema,
    questions: z.array(
      z
        .object({
          id: NonEmptyStringSchema,
          header: z.string().optional(),
          question: z.string().optional()
        })
        .strict()
    ),
    answers: z.record(z.array(z.string())),
    completed: z.boolean().optional()
  })
  .strict();

const UnifiedCommandActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    command: z.string().optional(),
    name: z.string().optional(),
    path: NullableStringSchema.optional(),
    query: NullableStringSchema.optional()
  })
  .strict();

const UnifiedCommandExecutionItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("commandExecution"),
    command: z.string(),
    cwd: z.string().optional(),
    processId: z.union([z.string(), z.null()]).optional(),
    status: NonEmptyStringSchema,
    commandActions: z.array(UnifiedCommandActionSchema).optional(),
    aggregatedOutput: z.union([z.string(), z.null()]).optional(),
    aggregatedOutputRef: UnifiedContentRefSchema.optional(),
    exitCode: z.union([z.number().int(), z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .strict();

const UnifiedFileChangeItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("fileChange"),
    status: NonEmptyStringSchema,
    changes: z.array(
      z
        .object({
          path: z.string(),
          kind: z
            .object({
              type: NonEmptyStringSchema,
              movePath: NullableStringSchema.optional()
            })
            .strict(),
          diff: z.string().optional(),
          diffRef: UnifiedContentRefSchema.optional()
        })
        .strict()
    )
  })
  .strict();

const UnifiedContextCompactionItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("contextCompaction"),
    completed: z.boolean().optional()
  })
  .strict();

const UnifiedWebSearchItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("webSearch"),
    query: z.string(),
    action: z
      .union([
        z
          .object({
            type: z.literal("search"),
            query: NullableStringSchema.optional(),
            queries: z.union([z.array(z.string()), z.null()]).optional()
          })
          .strict(),
        z
          .object({
            type: z.literal("openPage"),
            url: NullableStringSchema.optional()
          })
          .strict(),
        z
          .object({
            type: z.literal("findInPage"),
            url: NullableStringSchema.optional(),
            pattern: NullableStringSchema.optional()
          })
          .strict(),
        z
          .object({
            type: z.literal("other")
          })
          .strict(),
        z.null()
      ])
      .optional()
  })
  .strict();

const UnifiedMcpToolCallItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("mcpToolCall"),
    server: z.string(),
    tool: z.string(),
    status: z.enum(["inProgress", "completed", "failed"]),
    arguments: JsonValueSchema,
    argumentsRef: UnifiedContentRefSchema.optional(),
    result: z
      .union([
        z
          .object({
            content: z.array(JsonValueSchema),
            structuredContent: z.union([JsonValueSchema, z.null()]).optional()
          })
          .strict(),
        z.null()
      ])
      .optional(),
    resultRef: UnifiedContentRefSchema.optional(),
    error: z
      .union([
        z
          .object({
            message: z.string()
          })
          .strict(),
        z.null()
      ])
      .optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .strict();

const UnifiedDynamicToolCallOutputTextItemSchema = z
  .object({
    type: z.literal("inputText"),
    text: z.string()
  })
  .strict();

const UnifiedDynamicToolCallOutputImageItemSchema = z
  .object({
    type: z.literal("inputImage"),
    imageUrl: z.string()
  })
  .strict();

const UnifiedDynamicToolCallItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("dynamicToolCall"),
    tool: z.string(),
    arguments: JsonValueSchema,
    argumentsRef: UnifiedContentRefSchema.optional(),
    status: z.enum(["inProgress", "completed", "failed"]),
    contentItems: z
      .union([
        z.array(
          z.union([
            UnifiedDynamicToolCallOutputTextItemSchema,
            UnifiedDynamicToolCallOutputImageItemSchema
          ])
        ),
        z.null()
      ])
      .optional(),
    contentItemsRef: UnifiedContentRefSchema.optional(),
    success: z.union([z.boolean(), z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .strict();

const UnifiedCollabAgentToolCallItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("collabAgentToolCall"),
    tool: z.enum(["spawnAgent", "sendInput", "resumeAgent", "wait", "closeAgent"]),
    status: z.enum(["inProgress", "completed", "failed"]),
    senderThreadId: z.string(),
    receiverThreadIds: z.array(z.string()),
    prompt: NullableStringSchema.optional(),
    agentsStates: z.record(
      z
        .object({
          status: z.enum(["pendingInit", "running", "completed", "errored", "shutdown", "notFound"]),
          message: NullableStringSchema.optional()
        })
        .strict()
    )
  })
  .strict();

const UnifiedImageViewItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("imageView"),
    path: z.string()
  })
  .strict();

const UnifiedEnteredReviewModeItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("enteredReviewMode"),
    review: z.string()
  })
  .strict();

const UnifiedExitedReviewModeItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("exitedReviewMode"),
    review: z.string()
  })
  .strict();

const UnifiedRemoteTaskCreatedItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("remoteTaskCreated"),
    taskId: NonEmptyStringSchema
  })
  .strict();

const UnifiedModelChangedItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("modelChanged"),
    fromModel: NullableStringSchema.optional(),
    toModel: NullableStringSchema.optional()
  })
  .strict();

const UnifiedForkedFromConversationItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("forkedFromConversation"),
    sourceConversationId: NonEmptyStringSchema,
    sourceConversationTitle: NullableStringSchema.optional()
  })
  .strict();

const UnifiedSteeredItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("steered")
  })
  .strict();

export const UnifiedItemSchema = z.discriminatedUnion("type", [
  UnifiedUserMessageItemSchema,
  UnifiedSteeringUserMessageItemSchema,
  UnifiedAgentMessageItemSchema,
  UnifiedErrorItemSchema,
  UnifiedReasoningItemSchema,
  UnifiedPlanItemSchema,
  UnifiedTodoListItemSchema,
  UnifiedPlanImplementationItemSchema,
  UnifiedUserInputResponseItemSchema,
  UnifiedCommandExecutionItemSchema,
  UnifiedFileChangeItemSchema,
  UnifiedContextCompactionItemSchema,
  UnifiedWebSearchItemSchema,
  UnifiedMcpToolCallItemSchema,
  UnifiedDynamicToolCallItemSchema,
  UnifiedCollabAgentToolCallItemSchema,
  UnifiedImageViewItemSchema,
  UnifiedEnteredReviewModeItemSchema,
  UnifiedExitedReviewModeItemSchema,
  UnifiedRemoteTaskCreatedItemSchema,
  UnifiedModelChangedItemSchema,
  UnifiedForkedFromConversationItemSchema,
  UnifiedSteeredItemSchema
]);

export type UnifiedItem = z.infer<typeof UnifiedItemSchema>;
export type UnifiedItemKind = UnifiedItem["type"];

export const UNIFIED_ITEM_KINDS = [
  "userMessage",
  "steeringUserMessage",
  "agentMessage",
  "error",
  "reasoning",
  "plan",
  "todoList",
  "planImplementation",
  "userInputResponse",
  "commandExecution",
  "fileChange",
  "contextCompaction",
  "webSearch",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "imageView",
  "enteredReviewMode",
  "exitedReviewMode",
  "remoteTaskCreated",
  "modelChanged",
  "forkedFromConversation",
  "steered"
] as const satisfies ReadonlyArray<UnifiedItemKind>;

export const UnifiedTurnSchema = z
  .object({
    id: NonEmptyStringSchema,
    turnId: z.union([NonEmptyStringSchema, z.null()]).optional(),
    status: NonEmptyStringSchema,
    turnStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    finalAssistantStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    error: z.union([JsonValueSchema, z.null()]).optional(),
    diff: z.union([JsonValueSchema, z.null()]).optional(),
    diffRef: UnifiedContentRefSchema.optional(),
    items: z.array(UnifiedItemSchema)
  })
  .strict();
export type UnifiedTurn = z.infer<typeof UnifiedTurnSchema>;

const UnifiedLatestCollaborationModeSchema = z
  .object({
    mode: NonEmptyStringSchema,
    settings: z
      .object({
        model: NullableStringSchema.optional(),
        reasoningEffort: NullableStringSchema.optional(),
        developerInstructions: NullableStringSchema.optional()
      })
      .strict()
  })
  .strict();

export const UnifiedThreadSchema = z
  .object({
    id: NonEmptyStringSchema,
    provider: UnifiedProviderIdSchema,
    turns: z.array(UnifiedTurnSchema),
    requests: z.array(UnifiedThreadRequestSchema),
    createdAt: NonNegativeIntSchema.optional(),
    updatedAt: NonNegativeIntSchema.optional(),
    title: NullableStringSchema.optional(),
    latestCollaborationMode: z.union([UnifiedLatestCollaborationModeSchema, z.null()]),
    latestModel: NullableStringSchema,
    latestReasoningEffort: NullableStringSchema,
    latestTokenUsageInfo: z.union([JsonValueSchema, z.null()]).optional(),
    cwd: z.string().optional(),
    source: z.string().optional()
  })
  .strict();
export type UnifiedThread = z.infer<typeof UnifiedThreadSchema>;

const UnifiedThreadWindowOptionsSchema = z
  .object({
    maxItems: z.number().int().positive(),
    contentRefByteLimit: z.number().int().positive().optional()
  })
  .strict();
export type UnifiedThreadWindowOptions = z.infer<
  typeof UnifiedThreadWindowOptionsSchema
>;

const UnifiedThreadWindowMetaSchema = z
  .object({
    id: NonEmptyStringSchema,
    provider: UnifiedProviderIdSchema,
    requests: z.array(UnifiedThreadRequestSchema),
    createdAt: NonNegativeIntSchema.optional(),
    updatedAt: NonNegativeIntSchema.optional(),
    title: NullableStringSchema.optional(),
    latestCollaborationMode: z.union([UnifiedLatestCollaborationModeSchema, z.null()]),
    latestModel: NullableStringSchema,
    latestReasoningEffort: NullableStringSchema,
    latestTokenUsageInfo: z.union([JsonValueSchema, z.null()]).optional(),
    cwd: z.string().optional(),
    source: z.string().optional()
  })
  .strict();

const UnifiedThreadWindowTurnSchema = z
  .object({
    id: NonEmptyStringSchema,
    turnId: z.union([NonEmptyStringSchema, z.null()]).optional(),
    status: NonEmptyStringSchema,
    turnStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    finalAssistantStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    error: z.union([JsonValueSchema, z.null()]).optional(),
    diff: z.union([JsonValueSchema, z.null()]).optional(),
    diffRef: UnifiedContentRefSchema.optional()
  })
  .strict();

const UnifiedThreadWindowRangeSchema = z
  .object({
    totalTurns: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
    startTurnIndex: z.number().int().nonnegative(),
    endTurnIndexExclusive: z.number().int().nonnegative(),
    includedTurnCount: z.number().int().nonnegative(),
    includedItemCount: z.number().int().nonnegative(),
    maxItems: z.number().int().positive(),
    hasMoreBefore: z.boolean(),
    hasMoreAfter: z.boolean()
  })
  .strict();

export const UnifiedThreadWindowSchema = z
  .object({
    meta: UnifiedThreadWindowMetaSchema,
    range: UnifiedThreadWindowRangeSchema,
    turnOrder: z.array(NonEmptyStringSchema),
    turnsById: z.record(UnifiedThreadWindowTurnSchema),
    itemIdsByTurnId: z.record(z.array(NonEmptyStringSchema)),
    itemsById: z.record(UnifiedItemSchema),
    contentRefs: z.record(UnifiedContentRefSchema)
  })
  .strict();
export type UnifiedThreadWindow = z.infer<typeof UnifiedThreadWindowSchema>;

type UnifiedThreadWindowTurn = z.infer<typeof UnifiedThreadWindowTurnSchema>;

function encodeContentRefSegment(value: string): string {
  return encodeURIComponent(value);
}

function truncateContentRefPreview(value: string): string {
  return value.length > CONTENT_REF_PREVIEW_MAX_CHARS
    ? `${value.slice(0, CONTENT_REF_PREVIEW_MAX_CHARS)}\n...`
    : value;
}

function textByteLength(value: string): number {
  return strToU8(value).length;
}

function jsonPreview(value: JsonValue): string {
  return truncateContentRefPreview(JSON.stringify(JsonValueSchema.parse(value)));
}

function textContentRef(input: {
  threadId: string;
  turnId: string;
  itemId: string;
  field: string;
  kind: UnifiedContentRefKind;
  value: string;
}): UnifiedContentRef {
  return UnifiedContentRefSchema.parse({
    id: [
      "thread",
      encodeContentRefSegment(input.threadId),
      "turn",
      encodeContentRefSegment(input.turnId),
      "item",
      encodeContentRefSegment(input.itemId),
      "field",
      encodeContentRefSegment(input.field)
    ].join(":"),
    kind: input.kind,
    contentType: "text",
    byteLength: textByteLength(input.value),
    preview: truncateContentRefPreview(input.value)
  });
}

function jsonContentRef(input: {
  threadId: string;
  turnId: string;
  itemId: string;
  field: string;
  kind: UnifiedContentRefKind;
  value: JsonValue;
}): UnifiedContentRef {
  const parsedValue = JsonValueSchema.parse(input.value);
  return UnifiedContentRefSchema.parse({
    id: [
      "thread",
      encodeContentRefSegment(input.threadId),
      "turn",
      encodeContentRefSegment(input.turnId),
      "item",
      encodeContentRefSegment(input.itemId),
      "field",
      encodeContentRefSegment(input.field)
    ].join(":"),
    kind: input.kind,
    contentType: "json",
    byteLength: textByteLength(JSON.stringify(parsedValue)),
    preview: jsonPreview(parsedValue)
  });
}

function turnJsonContentRef(input: {
  threadId: string;
  turnId: string;
  field: string;
  kind: UnifiedContentRefKind;
  value: JsonValue;
}): UnifiedContentRef {
  const parsedValue = JsonValueSchema.parse(input.value);
  return UnifiedContentRefSchema.parse({
    id: [
      "thread",
      encodeContentRefSegment(input.threadId),
      "turn",
      encodeContentRefSegment(input.turnId),
      "field",
      encodeContentRefSegment(input.field)
    ].join(":"),
    kind: input.kind,
    contentType: "json",
    byteLength: textByteLength(JSON.stringify(parsedValue)),
    preview: jsonPreview(parsedValue)
  });
}

function storeContentRef(
  refs: Record<string, UnifiedContentRef>,
  ref: UnifiedContentRef
): void {
  refs[ref.id] = ref;
}

function shouldStoreContentRef(
  ref: UnifiedContentRef,
  contentRefByteLimit: number
): boolean {
  return ref.byteLength > contentRefByteLimit;
}

function buildUnifiedThreadWindowTurn(
  threadId: string,
  turn: UnifiedTurn,
  contentRefs: Record<string, UnifiedContentRef>,
  contentRefByteLimit: number
): UnifiedThreadWindowTurn {
  const diffRef =
    turn.diff !== undefined && turn.diff !== null
      ? turnJsonContentRef({
          threadId,
          turnId: turn.id,
          field: "diff",
          kind: "turnDiff",
          value: turn.diff
        })
      : null;
  const storedDiffRef =
    diffRef && shouldStoreContentRef(diffRef, contentRefByteLimit)
      ? diffRef
      : null;
  if (storedDiffRef) {
    storeContentRef(contentRefs, storedDiffRef);
  }

  return UnifiedThreadWindowTurnSchema.parse({
    id: turn.id,
    ...(turn.turnId !== undefined ? { turnId: turn.turnId } : {}),
    status: turn.status,
    ...(turn.turnStartedAtMs !== undefined
      ? { turnStartedAtMs: turn.turnStartedAtMs }
      : {}),
    ...(turn.finalAssistantStartedAtMs !== undefined
      ? { finalAssistantStartedAtMs: turn.finalAssistantStartedAtMs }
      : {}),
    ...(turn.error !== undefined ? { error: turn.error } : {}),
    ...(turn.diff !== undefined
      ? { diff: storedDiffRef ? storedDiffRef.preview : turn.diff }
      : {}),
    ...(storedDiffRef ? { diffRef: storedDiffRef } : {})
  });
}

function buildUnifiedThreadWindowItem(input: {
  threadId: string;
  turnId: string;
  item: UnifiedItem;
  contentRefs: Record<string, UnifiedContentRef>;
  contentRefByteLimit: number;
}): UnifiedItem {
  const contentRefInput = {
    threadId: input.threadId,
    turnId: input.turnId,
    itemId: input.item.id
  };

  switch (input.item.type) {
    case "agentMessage": {
      const ref = textContentRef({
        ...contentRefInput,
        field: "text",
        kind: "agentText",
        value: input.item.text
      });
      if (!shouldStoreContentRef(ref, input.contentRefByteLimit)) {
        return input.item;
      }
      storeContentRef(input.contentRefs, ref);
      return UnifiedItemSchema.parse({
        ...input.item,
        text: ref.preview ?? "",
        textRef: ref
      });
    }
    case "reasoning": {
      if (input.item.text === undefined) {
        return input.item;
      }
      const ref = textContentRef({
        ...contentRefInput,
        field: "text",
        kind: "reasoningText",
        value: input.item.text
      });
      if (!shouldStoreContentRef(ref, input.contentRefByteLimit)) {
        return input.item;
      }
      storeContentRef(input.contentRefs, ref);
      return UnifiedItemSchema.parse({
        ...input.item,
        text: ref.preview ?? "",
        textRef: ref
      });
    }
    case "commandExecution": {
      if (input.item.aggregatedOutput === undefined || input.item.aggregatedOutput === null) {
        return input.item;
      }
      const ref = textContentRef({
        ...contentRefInput,
        field: "aggregatedOutput",
        kind: "commandOutput",
        value: input.item.aggregatedOutput
      });
      if (!shouldStoreContentRef(ref, input.contentRefByteLimit)) {
        return input.item;
      }
      storeContentRef(input.contentRefs, ref);
      return UnifiedItemSchema.parse({
        ...input.item,
        aggregatedOutput: ref.preview,
        aggregatedOutputRef: ref
      });
    }
    case "fileChange": {
      const changes = input.item.changes.map((change, index) => {
        if (change.diff === undefined) {
          return change;
        }
        const ref = textContentRef({
          ...contentRefInput,
          field: `changes.${index}.diff`,
          kind: "fileDiff",
          value: change.diff
        });
        if (!shouldStoreContentRef(ref, input.contentRefByteLimit)) {
          return change;
        }
        storeContentRef(input.contentRefs, ref);
        return {
          ...change,
          diff: ref.preview ?? "",
          diffRef: ref
        };
      });
      return UnifiedItemSchema.parse({
        ...input.item,
        changes
      });
    }
    case "mcpToolCall": {
      const argumentsRef = jsonContentRef({
        ...contentRefInput,
        field: "arguments",
        kind: "mcpArguments",
        value: input.item.arguments
      });
      const storedArgumentsRef = shouldStoreContentRef(
        argumentsRef,
        input.contentRefByteLimit
      )
        ? argumentsRef
        : null;
      if (storedArgumentsRef) {
        storeContentRef(input.contentRefs, storedArgumentsRef);
      }

      const resultRef =
        input.item.result !== undefined && input.item.result !== null
          ? jsonContentRef({
              ...contentRefInput,
              field: "result",
              kind: "mcpResult",
              value: JsonValueSchema.parse(input.item.result)
            })
          : null;
      const storedResultRef =
        resultRef && shouldStoreContentRef(resultRef, input.contentRefByteLimit)
          ? resultRef
          : null;
      if (storedResultRef) {
        storeContentRef(input.contentRefs, storedResultRef);
      }

      if (!storedArgumentsRef && !storedResultRef) {
        return input.item;
      }

      return UnifiedItemSchema.parse({
        ...input.item,
        ...(storedArgumentsRef
          ? { arguments: null, argumentsRef: storedArgumentsRef }
          : {}),
        ...(storedResultRef ? { result: null, resultRef: storedResultRef } : {})
      });
    }
    case "dynamicToolCall": {
      const argumentsRef = jsonContentRef({
        ...contentRefInput,
        field: "arguments",
        kind: "dynamicArguments",
        value: input.item.arguments
      });
      const storedArgumentsRef = shouldStoreContentRef(
        argumentsRef,
        input.contentRefByteLimit
      )
        ? argumentsRef
        : null;
      if (storedArgumentsRef) {
        storeContentRef(input.contentRefs, storedArgumentsRef);
      }

      const contentItemsRef =
        input.item.contentItems !== undefined && input.item.contentItems !== null
          ? jsonContentRef({
              ...contentRefInput,
              field: "contentItems",
              kind: "dynamicContentItems",
              value: JsonValueSchema.parse(input.item.contentItems)
            })
          : null;
      const storedContentItemsRef =
        contentItemsRef &&
        shouldStoreContentRef(contentItemsRef, input.contentRefByteLimit)
          ? contentItemsRef
          : null;
      if (storedContentItemsRef) {
        storeContentRef(input.contentRefs, storedContentItemsRef);
      }

      if (!storedArgumentsRef && !storedContentItemsRef) {
        return input.item;
      }

      return UnifiedItemSchema.parse({
        ...input.item,
        ...(storedArgumentsRef
          ? { arguments: null, argumentsRef: storedArgumentsRef }
          : {}),
        ...(storedContentItemsRef
          ? { contentItems: null, contentItemsRef: storedContentItemsRef }
          : {})
      });
    }
    default:
      return input.item;
  }
}

export function buildUnifiedThreadWindow(
  thread: UnifiedThread,
  options: UnifiedThreadWindowOptions
): UnifiedThreadWindow {
  const parsedThread = UnifiedThreadSchema.parse(thread);
  const parsedOptions = UnifiedThreadWindowOptionsSchema.parse(options);
  const contentRefByteLimit =
    parsedOptions.contentRefByteLimit ?? DEFAULT_CONTENT_REF_BYTE_LIMIT;
  const totalTurns = parsedThread.turns.length;
  const totalItems = parsedThread.turns.reduce(
    (sum, turn) => sum + turn.items.length,
    0
  );
  const selectedTurns: UnifiedTurn[] = [];
  let includedItemCount = 0;

  for (let index = totalTurns - 1; index >= 0; index -= 1) {
    const turn = parsedThread.turns[index];
    if (!turn) {
      throw new Error(`Thread ${parsedThread.id} has a missing turn at ${index}`);
    }
    const nextItemCount = includedItemCount + turn.items.length;
    if (
      selectedTurns.length > 0 &&
      nextItemCount > parsedOptions.maxItems
    ) {
      break;
    }

    selectedTurns.unshift(turn);
    includedItemCount = nextItemCount;

    if (includedItemCount >= parsedOptions.maxItems) {
      break;
    }
  }

  const startTurnIndex = totalTurns - selectedTurns.length;
  const endTurnIndexExclusive = totalTurns;
  const turnOrder: string[] = [];
  const turnsById: Record<string, UnifiedThreadWindowTurn> = {};
  const itemIdsByTurnId: Record<string, string[]> = {};
  const itemsById: Record<string, UnifiedItem> = {};
  const contentRefs: Record<string, UnifiedContentRef> = {};

  for (const turn of selectedTurns) {
    if (turnsById[turn.id]) {
      throw new Error(`Thread ${parsedThread.id} has duplicate turn id ${turn.id}`);
    }

    turnOrder.push(turn.id);
    turnsById[turn.id] = buildUnifiedThreadWindowTurn(
      parsedThread.id,
      turn,
      contentRefs,
      contentRefByteLimit
    );
    const itemIds: string[] = [];

    for (const item of turn.items) {
      if (itemsById[item.id]) {
        throw new Error(`Thread ${parsedThread.id} has duplicate item id ${item.id}`);
      }
      itemsById[item.id] = buildUnifiedThreadWindowItem({
        threadId: parsedThread.id,
        turnId: turn.id,
        item,
        contentRefs,
        contentRefByteLimit
      });
      itemIds.push(item.id);
    }

    itemIdsByTurnId[turn.id] = itemIds;
  }

  return UnifiedThreadWindowSchema.parse({
    meta: {
      id: parsedThread.id,
      provider: parsedThread.provider,
      requests: parsedThread.requests,
      ...(parsedThread.createdAt !== undefined
        ? { createdAt: parsedThread.createdAt }
        : {}),
      ...(parsedThread.updatedAt !== undefined
        ? { updatedAt: parsedThread.updatedAt }
        : {}),
      ...(parsedThread.title !== undefined ? { title: parsedThread.title } : {}),
      latestCollaborationMode: parsedThread.latestCollaborationMode,
      latestModel: parsedThread.latestModel,
      latestReasoningEffort: parsedThread.latestReasoningEffort,
      ...(parsedThread.latestTokenUsageInfo !== undefined
        ? { latestTokenUsageInfo: parsedThread.latestTokenUsageInfo }
        : {}),
      ...(parsedThread.cwd !== undefined ? { cwd: parsedThread.cwd } : {}),
      ...(parsedThread.source !== undefined ? { source: parsedThread.source } : {})
    },
    range: {
      totalTurns,
      totalItems,
      startTurnIndex,
      endTurnIndexExclusive,
      includedTurnCount: selectedTurns.length,
      includedItemCount,
      maxItems: parsedOptions.maxItems,
      hasMoreBefore: startTurnIndex > 0,
      hasMoreAfter: false
    },
    turnOrder,
    turnsById,
    itemIdsByTurnId,
    itemsById,
    contentRefs
  });
}

export function materializeUnifiedThreadWindow(
  window: UnifiedThreadWindow
): UnifiedThread {
  const parsedWindow = UnifiedThreadWindowSchema.parse(window);
  const turns = parsedWindow.turnOrder.map((turnId) => {
    const turn = parsedWindow.turnsById[turnId];
    if (!turn) {
      throw new Error(`Thread window ${parsedWindow.meta.id} is missing turn ${turnId}`);
    }

    const itemIds = parsedWindow.itemIdsByTurnId[turnId];
    if (!itemIds) {
      throw new Error(
        `Thread window ${parsedWindow.meta.id} is missing item ids for turn ${turnId}`
      );
    }

    const items = itemIds.map((itemId) => {
      const item = parsedWindow.itemsById[itemId];
      if (!item) {
        throw new Error(
          `Thread window ${parsedWindow.meta.id} is missing item ${itemId}`
        );
      }
      return item;
    });

    return UnifiedTurnSchema.parse({
      id: turn.id,
      ...(turn.turnId !== undefined ? { turnId: turn.turnId } : {}),
      status: turn.status,
      ...(turn.turnStartedAtMs !== undefined
        ? { turnStartedAtMs: turn.turnStartedAtMs }
        : {}),
      ...(turn.finalAssistantStartedAtMs !== undefined
        ? { finalAssistantStartedAtMs: turn.finalAssistantStartedAtMs }
        : {}),
      ...(turn.error !== undefined ? { error: turn.error } : {}),
      ...(turn.diff !== undefined ? { diff: turn.diff } : {}),
      ...(turn.diffRef !== undefined ? { diffRef: turn.diffRef } : {}),
      items
    });
  });

  return UnifiedThreadSchema.parse({
    id: parsedWindow.meta.id,
    provider: parsedWindow.meta.provider,
    turns,
    requests: parsedWindow.meta.requests,
    ...(parsedWindow.meta.createdAt !== undefined
      ? { createdAt: parsedWindow.meta.createdAt }
      : {}),
    ...(parsedWindow.meta.updatedAt !== undefined
      ? { updatedAt: parsedWindow.meta.updatedAt }
      : {}),
    ...(parsedWindow.meta.title !== undefined ? { title: parsedWindow.meta.title } : {}),
    latestCollaborationMode: parsedWindow.meta.latestCollaborationMode,
    latestModel: parsedWindow.meta.latestModel,
    latestReasoningEffort: parsedWindow.meta.latestReasoningEffort,
    ...(parsedWindow.meta.latestTokenUsageInfo !== undefined
      ? { latestTokenUsageInfo: parsedWindow.meta.latestTokenUsageInfo }
      : {}),
    ...(parsedWindow.meta.cwd !== undefined ? { cwd: parsedWindow.meta.cwd } : {}),
    ...(parsedWindow.meta.source !== undefined
      ? { source: parsedWindow.meta.source }
      : {})
  });
}

function matchContentRefValue(
  refId: string,
  ref: UnifiedContentRef,
  value: JsonValue
): UnifiedContentRefValue | null {
  if (ref.id !== refId) {
    return null;
  }

  return UnifiedContentRefValueSchema.parse({
    ref,
    value
  });
}

export function resolveUnifiedThreadContentRef(
  thread: UnifiedThread,
  refId: string
): UnifiedContentRefValue {
  const parsedThread = UnifiedThreadSchema.parse(thread);

  for (const turn of parsedThread.turns) {
    if (turn.diff !== undefined && turn.diff !== null) {
      const matched = matchContentRefValue(
        refId,
        turnJsonContentRef({
          threadId: parsedThread.id,
          turnId: turn.id,
          field: "diff",
          kind: "turnDiff",
          value: turn.diff
        }),
        turn.diff
      );
      if (matched) {
        return matched;
      }
    }

    for (const item of turn.items) {
      const contentRefInput = {
        threadId: parsedThread.id,
        turnId: turn.id,
        itemId: item.id
      };

      switch (item.type) {
        case "agentMessage": {
          const matched = matchContentRefValue(
            refId,
            textContentRef({
              ...contentRefInput,
              field: "text",
              kind: "agentText",
              value: item.text
            }),
            item.text
          );
          if (matched) {
            return matched;
          }
          break;
        }
        case "reasoning": {
          if (item.text === undefined) {
            break;
          }
          const matched = matchContentRefValue(
            refId,
            textContentRef({
              ...contentRefInput,
              field: "text",
              kind: "reasoningText",
              value: item.text
            }),
            item.text
          );
          if (matched) {
            return matched;
          }
          break;
        }
        case "commandExecution": {
          if (item.aggregatedOutput === undefined || item.aggregatedOutput === null) {
            break;
          }
          const matched = matchContentRefValue(
            refId,
            textContentRef({
              ...contentRefInput,
              field: "aggregatedOutput",
              kind: "commandOutput",
              value: item.aggregatedOutput
            }),
            item.aggregatedOutput
          );
          if (matched) {
            return matched;
          }
          break;
        }
        case "fileChange": {
          for (let index = 0; index < item.changes.length; index += 1) {
            const change = item.changes[index];
            if (!change || change.diff === undefined) {
              continue;
            }
            const matched = matchContentRefValue(
              refId,
              textContentRef({
                ...contentRefInput,
                field: `changes.${index}.diff`,
                kind: "fileDiff",
                value: change.diff
              }),
              change.diff
            );
            if (matched) {
              return matched;
            }
          }
          break;
        }
        case "mcpToolCall": {
          const matchedArguments = matchContentRefValue(
            refId,
            jsonContentRef({
              ...contentRefInput,
              field: "arguments",
              kind: "mcpArguments",
              value: item.arguments
            }),
            item.arguments
          );
          if (matchedArguments) {
            return matchedArguments;
          }

          if (item.result !== undefined && item.result !== null) {
            const matchedResult = matchContentRefValue(
              refId,
              jsonContentRef({
                ...contentRefInput,
                field: "result",
                kind: "mcpResult",
                value: JsonValueSchema.parse(item.result)
              }),
              JsonValueSchema.parse(item.result)
            );
            if (matchedResult) {
              return matchedResult;
            }
          }
          break;
        }
        case "dynamicToolCall": {
          const matchedArguments = matchContentRefValue(
            refId,
            jsonContentRef({
              ...contentRefInput,
              field: "arguments",
              kind: "dynamicArguments",
              value: item.arguments
            }),
            item.arguments
          );
          if (matchedArguments) {
            return matchedArguments;
          }

          if (item.contentItems !== undefined && item.contentItems !== null) {
            const matchedContentItems = matchContentRefValue(
              refId,
              jsonContentRef({
                ...contentRefInput,
                field: "contentItems",
                kind: "dynamicContentItems",
                value: JsonValueSchema.parse(item.contentItems)
              }),
              JsonValueSchema.parse(item.contentItems)
            );
            if (matchedContentItems) {
              return matchedContentItems;
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  throw new Error(`Thread ${parsedThread.id} does not contain content ref ${refId}`);
}

export const UnifiedThreadSummarySchema = z
  .object({
    id: NonEmptyStringSchema,
    provider: UnifiedProviderIdSchema,
    preview: z.string(),
    title: NullableStringSchema.optional(),
    isGenerating: z.boolean().optional(),
    waitingOnApproval: z.boolean().optional(),
    waitingOnUserInput: z.boolean().optional(),
    createdAt: NonNegativeIntSchema,
    updatedAt: NonNegativeIntSchema,
    cwd: z.string().optional(),
    source: z.string().optional()
  })
  .strict();
export type UnifiedThreadSummary = z.infer<typeof UnifiedThreadSummarySchema>;

const UnifiedCommandListThreadsSchema = z
  .object({
    kind: z.literal("listThreads"),
    provider: UnifiedProviderIdSchema,
    limit: z.number().int().positive(),
    archived: z.boolean(),
    all: z.boolean(),
    maxPages: z.number().int().positive(),
    cursor: z.union([z.string(), z.null()]).optional()
  })
  .strict();

const UnifiedCommandCreateThreadSchema = z
  .object({
    kind: z.literal("createThread"),
    provider: UnifiedProviderIdSchema,
    cwd: z.string().optional(),
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    personality: z.string().optional(),
    sandbox: z.string().optional(),
    approvalPolicy: UnifiedApprovalPolicySchema.optional(),
    ephemeral: z.boolean().optional()
  })
  .strict();

const UnifiedCommandReadThreadSchema = z
  .object({
    kind: z.literal("readThread"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    includeTurns: z.boolean().optional().default(true),
    itemLimit: z.number().int().positive().optional()
  })
  .strict();

const UnifiedCommandSendMessageSchema = z
  .object({
    kind: z.literal("sendMessage"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    text: z.string().min(1),
    ownerClientId: z.string().optional(),
    cwd: z.string().optional(),
    model: z.string().optional(),
    effort: z.string().optional(),
    collaborationMode: z
      .object({
        mode: NonEmptyStringSchema,
        settings: z
          .object({
            model: NonEmptyStringSchema,
            reasoningEffort: NullableStringSchema.optional(),
            developerInstructions: NullableStringSchema.optional()
          })
          .strict()
      })
      .strict()
      .optional(),
    isSteering: z.boolean().optional(),
    approvalPolicy: UnifiedApprovalPolicySchema.optional()
  })
  .strict();

const UnifiedCommandInterruptSchema = z
  .object({
    kind: z.literal("interrupt"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    ownerClientId: z.string().optional()
  })
  .strict();

const UnifiedCommandListModelsSchema = z
  .object({
    kind: z.literal("listModels"),
    provider: UnifiedProviderIdSchema,
    limit: z.number().int().positive().optional().default(200)
  })
  .strict();

const UnifiedCommandListCollaborationModesSchema = z
  .object({
    kind: z.literal("listCollaborationModes"),
    provider: UnifiedProviderIdSchema
  })
  .strict();

const UnifiedCommandSetCollaborationModeSchema = z
  .object({
    kind: z.literal("setCollaborationMode"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    ownerClientId: z.string().optional(),
    collaborationMode: z
      .object({
        mode: NonEmptyStringSchema,
        settings: z
          .object({
            model: NonEmptyStringSchema,
            reasoningEffort: NullableStringSchema.optional(),
            developerInstructions: NullableStringSchema.optional()
          })
          .strict()
      })
      .strict()
  })
  .strict();

const UnifiedCommandSubmitUserInputSchema = z
  .object({
    kind: z.literal("submitUserInput"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    ownerClientId: z.string().optional(),
    requestId: UnifiedUserInputRequestIdSchema,
    response: UnifiedThreadRequestResponseSchema
  })
  .strict();

const UnifiedCommandReadLiveStateSchema = z
  .object({
    kind: z.literal("readLiveState"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    itemLimit: z.number().int().positive().optional()
  })
  .strict();

const UnifiedCommandReadStreamEventsSchema = z
  .object({
    kind: z.literal("readStreamEvents"),
    provider: UnifiedProviderIdSchema,
    threadId: NonEmptyStringSchema,
    limit: z.number().int().positive().optional().default(80)
  })
  .strict();

const UnifiedCommandListProjectDirectoriesSchema = z
  .object({
    kind: z.literal("listProjectDirectories"),
    provider: UnifiedProviderIdSchema
  })
  .strict();

export const UnifiedCommandSchema = z.discriminatedUnion("kind", [
  UnifiedCommandListThreadsSchema,
  UnifiedCommandCreateThreadSchema,
  UnifiedCommandReadThreadSchema,
  UnifiedCommandSendMessageSchema,
  UnifiedCommandInterruptSchema,
  UnifiedCommandListModelsSchema,
  UnifiedCommandListCollaborationModesSchema,
  UnifiedCommandSetCollaborationModeSchema,
  UnifiedCommandSubmitUserInputSchema,
  UnifiedCommandReadLiveStateSchema,
  UnifiedCommandReadStreamEventsSchema,
  UnifiedCommandListProjectDirectoriesSchema
]);

export type UnifiedCommand = z.infer<typeof UnifiedCommandSchema>;
export type UnifiedCommandKind = UnifiedCommand["kind"];

export const UNIFIED_COMMAND_KINDS = [
  "listThreads",
  "createThread",
  "readThread",
  "sendMessage",
  "interrupt",
  "listModels",
  "listCollaborationModes",
  "setCollaborationMode",
  "submitUserInput",
  "readLiveState",
  "readStreamEvents",
  "listProjectDirectories"
] as const satisfies ReadonlyArray<UnifiedCommandKind>;

const UnifiedCommandResultListThreadsSchema = z
  .object({
    kind: z.literal("listThreads"),
    data: z.array(UnifiedThreadSummarySchema),
    nextCursor: z.union([z.string(), z.null()]).optional(),
    pages: z.number().int().nonnegative().optional(),
    truncated: z.boolean().optional()
  })
  .strict();

const UnifiedCommandResultCreateThreadSchema = z
  .object({
    kind: z.literal("createThread"),
    threadId: NonEmptyStringSchema,
    thread: UnifiedThreadSchema
  })
  .strict();

const UnifiedCommandResultReadThreadSchema = z
  .object({
    kind: z.literal("readThread"),
    thread: UnifiedThreadSchema,
    threadWindow: z.union([UnifiedThreadWindowSchema, z.null()]).optional()
  })
  .strict();

const UnifiedCommandResultSendMessageSchema = z
  .object({
    kind: z.literal("sendMessage")
  })
  .strict();

const UnifiedCommandResultInterruptSchema = z
  .object({
    kind: z.literal("interrupt")
  })
  .strict();

const UnifiedCommandResultListModelsSchema = z
  .object({
    kind: z.literal("listModels"),
    data: z.array(UnifiedModelSchema)
  })
  .strict();

const UnifiedCommandResultListCollaborationModesSchema = z
  .object({
    kind: z.literal("listCollaborationModes"),
    data: z.array(UnifiedCollaborationModeSchema)
  })
  .strict();

const UnifiedCommandResultSetCollaborationModeSchema = z
  .object({
    kind: z.literal("setCollaborationMode"),
    ownerClientId: z.string()
  })
  .strict();

const UnifiedCommandResultSubmitUserInputSchema = z
  .object({
    kind: z.literal("submitUserInput"),
    ownerClientId: z.string(),
    requestId: UnifiedUserInputRequestIdSchema
  })
  .strict();

const UnifiedCommandResultReadLiveStateSchema = z
  .object({
    kind: z.literal("readLiveState"),
    threadId: NonEmptyStringSchema,
    ownerClientId: z.union([z.string(), z.null()]),
    conversationState: z.union([UnifiedThreadSchema, z.null()]),
    conversationStateWindow: z
      .union([UnifiedThreadWindowSchema, z.null()])
      .optional(),
    liveStateError: z
      .union([
        z
          .object({
            kind: z.literal("reductionFailed"),
            message: z.string(),
            eventIndex: z.union([z.number().int().nonnegative(), z.null()]),
            patchIndex: z.union([z.number().int().nonnegative(), z.null()])
          })
          .strict(),
        z
          .object({
            kind: z.literal("parseFailed"),
            message: z.string(),
            eventIndex: z.union([z.number().int().nonnegative(), z.null()]),
            patchIndex: z.union([z.number().int().nonnegative(), z.null()])
          })
          .strict(),
        z.null()
      ])
      .optional()
  })
  .strict();

const UnifiedCommandResultReadStreamEventsSchema = z
  .object({
    kind: z.literal("readStreamEvents"),
    threadId: NonEmptyStringSchema,
    ownerClientId: z.union([z.string(), z.null()]),
    events: z.array(JsonValueSchema)
  })
  .strict();

const UnifiedCommandResultListProjectDirectoriesSchema = z
  .object({
    kind: z.literal("listProjectDirectories"),
    directories: z.array(z.string())
  })
  .strict();

export const UnifiedCommandResultSchema = z.discriminatedUnion("kind", [
  UnifiedCommandResultListThreadsSchema,
  UnifiedCommandResultCreateThreadSchema,
  UnifiedCommandResultReadThreadSchema,
  UnifiedCommandResultSendMessageSchema,
  UnifiedCommandResultInterruptSchema,
  UnifiedCommandResultListModelsSchema,
  UnifiedCommandResultListCollaborationModesSchema,
  UnifiedCommandResultSetCollaborationModeSchema,
  UnifiedCommandResultSubmitUserInputSchema,
  UnifiedCommandResultReadLiveStateSchema,
  UnifiedCommandResultReadStreamEventsSchema,
  UnifiedCommandResultListProjectDirectoriesSchema
]);

export type UnifiedCommandResult = z.infer<typeof UnifiedCommandResultSchema>;
export type UnifiedCommandResultKind = UnifiedCommandResult["kind"];

export const UnifiedCommandErrorSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: z.string(),
    details: z.union([JsonValueSchema, z.null()]).optional()
  })
  .strict();

export const UnifiedCommandResponseSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      result: UnifiedCommandResultSchema
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: UnifiedCommandErrorSchema
    })
    .strict()
]);
export type UnifiedCommandResponse = z.infer<typeof UnifiedCommandResponseSchema>;

const UnifiedEventProviderStateSchema = z
  .object({
    kind: z.literal("providerStateChanged"),
    provider: UnifiedProviderIdSchema,
    enabled: z.boolean(),
    connected: z.boolean(),
    lastError: NullableStringSchema.optional()
  })
  .strict();

const UnifiedEventThreadUpdatedSchema = z
  .object({
    kind: z.literal("threadUpdated"),
    threadId: NonEmptyStringSchema,
    provider: UnifiedProviderIdSchema,
    thread: UnifiedThreadSchema
  })
  .strict();

const UnifiedEventUserInputRequestedSchema = z
  .object({
    kind: z.literal("userInputRequested"),
    threadId: NonEmptyStringSchema,
    request: UnifiedThreadRequestSchema
  })
  .strict();

const UnifiedEventUserInputResolvedSchema = z
  .object({
    kind: z.literal("userInputResolved"),
    threadId: NonEmptyStringSchema,
    requestId: UnifiedUserInputRequestIdSchema
  })
  .strict();

const UnifiedEventErrorSchema = z
  .object({
    kind: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
    details: z.union([JsonValueSchema, z.null()]).optional()
  })
  .strict();

export const UnifiedEventSchema = z.discriminatedUnion("kind", [
  UnifiedEventProviderStateSchema,
  UnifiedEventThreadUpdatedSchema,
  UnifiedEventUserInputRequestedSchema,
  UnifiedEventUserInputResolvedSchema,
  UnifiedEventErrorSchema
]);

export type UnifiedEvent = z.infer<typeof UnifiedEventSchema>;
export type UnifiedEventKind = UnifiedEvent["kind"];

export const UNIFIED_EVENT_KINDS = [
  "providerStateChanged",
  "threadUpdated",
  "userInputRequested",
  "userInputResolved",
  "error"
] as const satisfies ReadonlyArray<UnifiedEventKind>;

export const UNIFIED_REALTIME_CLIENT_FRAME_EVENT = "unified-realtime-client-frame";
export const UNIFIED_REALTIME_SERVER_FRAME_EVENT = "unified-realtime-server-frame";
export const UNIFIED_BINARY_HTTP_CONTENT_TYPE =
  "application/vnd.farfield.unified+protobuf-gzip";
export const UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP =
  "protobuf-gzip-v1";

export const UnifiedRealtimeTransportCodecSchema = z.enum([
  UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP
]);
export type UnifiedRealtimeTransportCodec = z.infer<
  typeof UnifiedRealtimeTransportCodecSchema
>;

export const UnifiedRealtimeTabSchema = z.enum(["chat", "debug"]);
export type UnifiedRealtimeTab = z.infer<typeof UnifiedRealtimeTabSchema>;

const UnifiedRealtimeTimingMetricSchema = z
  .object({
    count: z.number().int().nonnegative(),
    slowCount: z.number().int().nonnegative(),
    lastMs: z.number().nonnegative(),
    avgMs: z.number().nonnegative(),
    maxMs: z.number().nonnegative(),
  })
  .strict();

const UnifiedRealtimeServerTimingsSchema = z
  .object({
    realtimeCoreBuild: UnifiedRealtimeTimingMetricSchema,
    realtimeCoreSidebarList: UnifiedRealtimeTimingMetricSchema,
    realtimeCoreRateLimits: UnifiedRealtimeTimingMetricSchema,
    realtimeCoreAgentsBuild: UnifiedRealtimeTimingMetricSchema,
    realtimeThreadBuild: UnifiedRealtimeTimingMetricSchema,
    codexThreadList: UnifiedRealtimeTimingMetricSchema,
    codexThreadRead: UnifiedRealtimeTimingMetricSchema,
    codexThreadRefresh: UnifiedRealtimeTimingMetricSchema,
    codexLiveStateRead: UnifiedRealtimeTimingMetricSchema,
  })
  .strict();

const UnifiedRealtimeHealthStateSchema = z
  .object({
    appReady: z.boolean(),
    ipcConnected: z.boolean(),
    ipcInitialized: z.boolean(),
    gitCommit: z.union([z.string(), z.null()]).optional(),
    lastError: z.union([z.string(), z.null()]),
    historyCount: z.number().int().nonnegative(),
    threadOwnerCount: z.number().int().nonnegative(),
    timings: UnifiedRealtimeServerTimingsSchema.optional(),
  })
  .strict();

const UnifiedRealtimeAgentCapabilitiesSchema = z
  .object({
    canListModels: z.boolean(),
    canListCollaborationModes: z.boolean(),
    canSetCollaborationMode: z.boolean(),
    canSubmitUserInput: z.boolean(),
    canReadLiveState: z.boolean(),
    canReadStreamEvents: z.boolean(),
    canListProjectDirectories: z.boolean()
  })
  .strict();

const UnifiedRealtimeAgentDescriptorSchema = z
  .object({
    id: UnifiedProviderIdSchema,
    label: z.string(),
    enabled: z.boolean(),
    connected: z.boolean(),
    features: z.record(
      UnifiedFeatureIdSchema,
      UnifiedFeatureAvailabilitySchema
    ),
    capabilities: UnifiedRealtimeAgentCapabilitiesSchema,
    projectDirectories: z.array(z.string())
  })
  .strict();

const UnifiedRealtimeAgentsStateSchema = z
  .object({
    agents: z.array(UnifiedRealtimeAgentDescriptorSchema),
    defaultAgentId: UnifiedProviderIdSchema
  })
  .strict();

const UnifiedRealtimeProviderErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: JsonValueSchema.optional()
  })
  .strict();

const UnifiedRealtimeSidebarErrorsSchema = z
  .object({
    codex: z.union([UnifiedRealtimeProviderErrorSchema, z.null()]),
    opencode: z.union([UnifiedRealtimeProviderErrorSchema, z.null()])
  })
  .strict();

const UnifiedRealtimeTraceSummarySchema = z
  .object({
    id: z.string(),
    label: z.string(),
    startedAt: z.string(),
    stoppedAt: z.union([z.string(), z.null()]),
    eventCount: z.number().int().nonnegative(),
    path: z.string()
  })
  .strict();

const UnifiedRealtimeTraceStatusSchema = z
  .object({
    active: z.union([UnifiedRealtimeTraceSummarySchema, z.null()]),
    recent: z.array(UnifiedRealtimeTraceSummarySchema)
  })
  .strict();

const UnifiedRealtimeHistoryEntrySchema = z
  .object({
    id: z.string(),
    at: z.string(),
    source: z.enum(["ipc", "app", "system"]),
    direction: z.enum(["in", "out", "system"]),
    meta: z.record(JsonValueSchema)
  })
  .strict();
export type UnifiedRealtimeHistoryEntry = z.infer<
  typeof UnifiedRealtimeHistoryEntrySchema
>;

export const UnifiedRealtimeCoreStateSchema = z
  .object({
    health: z.union([UnifiedRealtimeHealthStateSchema, z.null()]),
    agents: UnifiedRealtimeAgentsStateSchema,
    sidebar: z
      .object({
        rows: z.array(UnifiedThreadSummarySchema),
        cursors: z
          .object({
            codex: z.union([z.string(), z.null()]),
            opencode: z.union([z.string(), z.null()])
          })
          .strict(),
        errors: UnifiedRealtimeSidebarErrorsSchema,
        refreshing: z.boolean().optional()
      })
      .strict(),
    rateLimits: z.union([JsonValueSchema, z.null()]),
    traceStatus: z.union([UnifiedRealtimeTraceStatusSchema, z.null()]),
    history: z.array(UnifiedRealtimeHistoryEntrySchema)
  })
  .strict();
export type UnifiedRealtimeCoreState = z.infer<
  typeof UnifiedRealtimeCoreStateSchema
>;

const UnifiedRealtimeLiveStateErrorSchema = z.union([
  z
    .object({
      kind: z.literal("reductionFailed"),
      message: z.string(),
      eventIndex: z.union([z.number().int().nonnegative(), z.null()]),
      patchIndex: z.union([z.number().int().nonnegative(), z.null()])
    })
    .strict(),
  z
    .object({
      kind: z.literal("parseFailed"),
      message: z.string(),
      eventIndex: z.union([z.number().int().nonnegative(), z.null()]),
      patchIndex: z.union([z.number().int().nonnegative(), z.null()])
    })
    .strict(),
  z.null()
]);

export const UnifiedRealtimeThreadStateSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    readThreadWindow: z.union([UnifiedThreadWindowSchema, z.null()]),
    liveState: z
      .object({
        ownerClientId: z.union([z.string(), z.null()]),
        conversationStateWindow: z.union([UnifiedThreadWindowSchema, z.null()]),
        liveStateError: UnifiedRealtimeLiveStateErrorSchema
      })
      .strict(),
    streamEvents: z.array(JsonValueSchema)
  })
  .strict();
export type UnifiedRealtimeThreadState = z.infer<
  typeof UnifiedRealtimeThreadStateSchema
>;

export const UnifiedRealtimeSnapshotSchema = z
  .object({
    kind: z.literal("snapshot"),
    syncVersion: z.number().int().nonnegative(),
    core: UnifiedRealtimeCoreStateSchema,
    selectedThread: z.union([UnifiedRealtimeThreadStateSchema, z.null()])
  })
  .strict();

export const UnifiedRealtimeCoreDeltaSchema = z
  .object({
    kind: z.literal("coreDelta"),
    syncVersion: z.number().int().nonnegative(),
    core: UnifiedRealtimeCoreStateSchema
  })
  .strict();

export const UnifiedRealtimeThreadDeltaSchema = z
  .object({
    kind: z.literal("threadDelta"),
    syncVersion: z.number().int().nonnegative(),
    thread: UnifiedRealtimeThreadStateSchema
  })
  .strict();

export const UnifiedRealtimeDebugDeltaSchema = z
  .object({
    kind: z.literal("debugDelta"),
    syncVersion: z.number().int().nonnegative(),
    traceStatus: z.union([UnifiedRealtimeTraceStatusSchema, z.null()]),
    history: z.array(UnifiedRealtimeHistoryEntrySchema)
  })
  .strict();

const UnifiedRealtimeSyncErrorSchema = z
  .object({
    kind: z.literal("syncError"),
    syncVersion: z.number().int().nonnegative(),
    message: z.string(),
    code: z.string().optional(),
    details: z.union([JsonValueSchema, z.null()]).optional()
  })
  .strict();

export const UnifiedRealtimeServerMessageSchema = z.discriminatedUnion("kind", [
  UnifiedRealtimeSnapshotSchema,
  UnifiedRealtimeCoreDeltaSchema,
  UnifiedRealtimeThreadDeltaSchema,
  UnifiedRealtimeDebugDeltaSchema,
  UnifiedRealtimeSyncErrorSchema
]);
export type UnifiedRealtimeServerMessage = z.infer<
  typeof UnifiedRealtimeServerMessageSchema
>;
export type UnifiedRealtimeServerMessageKind =
  UnifiedRealtimeServerMessage["kind"];

const UnifiedRealtimeHelloMessageSchema = z
  .object({
    kind: z.literal("hello"),
    selectedThreadId: z.union([z.string(), z.null()]),
    activeTab: UnifiedRealtimeTabSchema,
    supportedCodecs: z.array(UnifiedRealtimeTransportCodecSchema).optional()
  })
  .strict();

const UnifiedRealtimeSelectionChangedMessageSchema = z
  .object({
    kind: z.literal("selectionChanged"),
    selectedThreadId: z.union([z.string(), z.null()])
  })
  .strict();

const UnifiedRealtimeActiveTabChangedMessageSchema = z
  .object({
    kind: z.literal("activeTabChanged"),
    activeTab: UnifiedRealtimeTabSchema
  })
  .strict();

const UnifiedRealtimeRequestSnapshotMessageSchema = z
  .object({
    kind: z.literal("requestSnapshot")
  })
  .strict();

export const UnifiedRealtimeClientMessageSchema = z.discriminatedUnion("kind", [
  UnifiedRealtimeHelloMessageSchema,
  UnifiedRealtimeSelectionChangedMessageSchema,
  UnifiedRealtimeActiveTabChangedMessageSchema,
  UnifiedRealtimeRequestSnapshotMessageSchema
]);
export type UnifiedRealtimeClientMessage = z.infer<
  typeof UnifiedRealtimeClientMessageSchema
>;
export type UnifiedRealtimeClientMessageKind =
  UnifiedRealtimeClientMessage["kind"];

export const UNIFIED_REALTIME_SERVER_MESSAGE_KINDS = [
  "snapshot",
  "coreDelta",
  "threadDelta",
  "debugDelta",
  "syncError"
] as const satisfies ReadonlyArray<UnifiedRealtimeServerMessageKind>;

export const UNIFIED_REALTIME_CLIENT_MESSAGE_KINDS = [
  "hello",
  "selectionChanged",
  "activeTabChanged",
  "requestSnapshot"
] as const satisfies ReadonlyArray<UnifiedRealtimeClientMessageKind>;

const UNIFIED_REALTIME_PROTOBUF_VERSION = 1;
const UNIFIED_REALTIME_PROTOBUF_CODEC_ID_PROTOBUF_GZIP = 1;
const PROTOBUF_WIRE_TYPE_VARINT = 0;
const PROTOBUF_WIRE_TYPE_LENGTH_DELIMITED = 2;
const PROTOBUF_FIELD_VERSION = 1;
const PROTOBUF_FIELD_CODEC = 2;
const PROTOBUF_FIELD_PAYLOAD = 3;
const UNIFIED_BINARY_VALUE_NULL = 0;
const UNIFIED_BINARY_VALUE_FALSE = 1;
const UNIFIED_BINARY_VALUE_TRUE = 2;
const UNIFIED_BINARY_VALUE_NUMBER = 3;
const UNIFIED_BINARY_VALUE_STRING = 4;
const UNIFIED_BINARY_VALUE_ARRAY = 5;
const UNIFIED_BINARY_VALUE_OBJECT = 6;
const UNIFIED_BINARY_VALUE_STRING_TABLE = 7;
const UNIFIED_BINARY_VALUE_STRING_REF = 8;

const UnifiedRealtimeProtobufFrameHeaderSchema = z
  .object({
    version: z.literal(UNIFIED_REALTIME_PROTOBUF_VERSION),
    codec: UnifiedRealtimeTransportCodecSchema,
    payloadLength: z.number().int().nonnegative()
  })
  .strict();

export function selectUnifiedRealtimeTransportCodec(
  supportedCodecs: readonly UnifiedRealtimeTransportCodec[]
): UnifiedRealtimeTransportCodec | null {
  return supportedCodecs.includes(
    UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP
  )
    ? UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP
    : null;
}

export function encodeUnifiedRealtimeServerMessageFrame(
  message: UnifiedRealtimeServerMessage
): Uint8Array {
  const parsedMessage = JsonValueSchema.parse(
    UnifiedRealtimeServerMessageSchema.parse(message)
  );
  return encodeUnifiedPayloadFrame(parsedMessage);
}

export function decodeUnifiedRealtimeServerMessageFrame(
  frame: Uint8Array | ArrayBuffer
): UnifiedRealtimeServerMessage {
  return UnifiedRealtimeServerMessageSchema.parse(
    decodeUnifiedPayloadFrame(frame)
  );
}

export function encodeUnifiedRealtimeClientMessageFrame(
  message: UnifiedRealtimeClientMessage
): Uint8Array {
  const parsedMessage = JsonValueSchema.parse(
    UnifiedRealtimeClientMessageSchema.parse(message)
  );
  return encodeUnifiedPayloadFrame(parsedMessage);
}

export function decodeUnifiedRealtimeClientMessageFrame(
  frame: Uint8Array | ArrayBuffer
): UnifiedRealtimeClientMessage {
  return UnifiedRealtimeClientMessageSchema.parse(
    decodeUnifiedPayloadFrame(frame)
  );
}

export function encodeUnifiedPayloadFrame(payload: JsonValue): Uint8Array {
  const parsedPayload = JsonValueSchema.parse(payload);
  const valuePayload = encodeUnifiedBinaryValue(parsedPayload);
  const compressedPayload = gzipSync(valuePayload, {
    level: 1
  });
  const headerBytes: number[] = [];

  writeProtobufVarintField(
    PROTOBUF_FIELD_VERSION,
    UNIFIED_REALTIME_PROTOBUF_VERSION,
    headerBytes
  );
  writeProtobufVarintField(
    PROTOBUF_FIELD_CODEC,
    UNIFIED_REALTIME_PROTOBUF_CODEC_ID_PROTOBUF_GZIP,
    headerBytes
  );
  writeProtobufLengthDelimitedHeader(
    PROTOBUF_FIELD_PAYLOAD,
    compressedPayload.length,
    headerBytes
  );

  const header = new Uint8Array(headerBytes);
  const frame = new Uint8Array(header.length + compressedPayload.length);
  frame.set(header, 0);
  frame.set(compressedPayload, header.length);
  return frame;
}

export function decodeUnifiedPayloadFrame(
  frame: Uint8Array | ArrayBuffer
): JsonValue {
  const decodedFrame = decodeUnifiedRealtimeProtobufFrame(frame);
  return JsonValueSchema.parse(decodeUnifiedBinaryValue(gunzipSync(decodedFrame.payload)));
}

function encodeUnifiedBinaryValue(value: JsonValue): Uint8Array {
  const stringTable = buildUnifiedBinaryStringTable(value);
  const bytes: number[] = [];
  if (stringTable.length > 0) {
    const stringIds = new Map<string, number>();
    for (let index = 0; index < stringTable.length; index += 1) {
      const tableValue = stringTable[index];
      if (tableValue !== undefined) {
        stringIds.set(tableValue, index);
      }
    }

    bytes.push(UNIFIED_BINARY_VALUE_STRING_TABLE);
    writeProtobufVarint(stringTable.length, bytes);
    for (const tableValue of stringTable) {
      writeUnifiedBinaryBytes(strToU8(tableValue), bytes);
    }
    writeUnifiedBinaryValueWithStringTable(value, bytes, stringIds);
  } else {
    writeUnifiedBinaryValue(value, bytes);
  }
  return new Uint8Array(bytes);
}

function buildUnifiedBinaryStringTable(value: JsonValue): string[] {
  const counts = new Map<string, number>();
  collectUnifiedBinaryStrings(value, counts);
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1 && textByteLength(entry[0]) > 0)
    .map((entry) => entry[0]);
}

function collectUnifiedBinaryStrings(
  value: JsonValue,
  counts: Map<string, number>
): void {
  const stringValue = z.string().safeParse(value);
  if (stringValue.success) {
    incrementUnifiedBinaryStringCount(counts, stringValue.data);
    return;
  }

  const arrayValue = z.array(JsonValueSchema).safeParse(value);
  if (arrayValue.success) {
    for (const item of arrayValue.data) {
      collectUnifiedBinaryStrings(item, counts);
    }
    return;
  }

  const objectValue = z.record(JsonValueSchema).safeParse(value);
  if (objectValue.success) {
    for (const [key, item] of Object.entries(objectValue.data)) {
      incrementUnifiedBinaryStringCount(counts, key);
      collectUnifiedBinaryStrings(item, counts);
    }
  }
}

function incrementUnifiedBinaryStringCount(
  counts: Map<string, number>,
  value: string
): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function writeUnifiedBinaryValue(value: JsonValue, bytes: number[]): void {
  const nullValue = z.null().safeParse(value);
  if (nullValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_NULL);
    return;
  }

  const booleanValue = z.boolean().safeParse(value);
  if (booleanValue.success) {
    bytes.push(
      booleanValue.data
        ? UNIFIED_BINARY_VALUE_TRUE
        : UNIFIED_BINARY_VALUE_FALSE
    );
    return;
  }

  const numberValue = z.number().safeParse(value);
  if (numberValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_NUMBER);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, numberValue.data);
    bytes.push(...new Uint8Array(buffer));
    return;
  }

  const stringValue = z.string().safeParse(value);
  if (stringValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_STRING);
    writeUnifiedBinaryBytes(strToU8(stringValue.data), bytes);
    return;
  }

  const arrayValue = z.array(JsonValueSchema).safeParse(value);
  if (arrayValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_ARRAY);
    writeProtobufVarint(arrayValue.data.length, bytes);
    for (const item of arrayValue.data) {
      writeUnifiedBinaryValue(item, bytes);
    }
    return;
  }

  const objectValue = z.record(JsonValueSchema).safeParse(value);
  if (objectValue.success) {
    const entries = Object.entries(objectValue.data);
    bytes.push(UNIFIED_BINARY_VALUE_OBJECT);
    writeProtobufVarint(entries.length, bytes);
    for (const [key, item] of entries) {
      writeUnifiedBinaryBytes(strToU8(key), bytes);
      writeUnifiedBinaryValue(item, bytes);
    }
    return;
  }

  JsonValueSchema.parse(value);
}

function writeUnifiedBinaryValueWithStringTable(
  value: JsonValue,
  bytes: number[],
  stringIds: Map<string, number>
): void {
  const nullValue = z.null().safeParse(value);
  if (nullValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_NULL);
    return;
  }

  const booleanValue = z.boolean().safeParse(value);
  if (booleanValue.success) {
    bytes.push(
      booleanValue.data
        ? UNIFIED_BINARY_VALUE_TRUE
        : UNIFIED_BINARY_VALUE_FALSE
    );
    return;
  }

  const numberValue = z.number().safeParse(value);
  if (numberValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_NUMBER);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, numberValue.data);
    bytes.push(...new Uint8Array(buffer));
    return;
  }

  const stringValue = z.string().safeParse(value);
  if (stringValue.success) {
    writeUnifiedBinaryStringToken(stringValue.data, bytes, stringIds);
    return;
  }

  const arrayValue = z.array(JsonValueSchema).safeParse(value);
  if (arrayValue.success) {
    bytes.push(UNIFIED_BINARY_VALUE_ARRAY);
    writeProtobufVarint(arrayValue.data.length, bytes);
    for (const item of arrayValue.data) {
      writeUnifiedBinaryValueWithStringTable(item, bytes, stringIds);
    }
    return;
  }

  const objectValue = z.record(JsonValueSchema).safeParse(value);
  if (objectValue.success) {
    const entries = Object.entries(objectValue.data);
    bytes.push(UNIFIED_BINARY_VALUE_OBJECT);
    writeProtobufVarint(entries.length, bytes);
    for (const [key, item] of entries) {
      writeUnifiedBinaryStringToken(key, bytes, stringIds);
      writeUnifiedBinaryValueWithStringTable(item, bytes, stringIds);
    }
    return;
  }

  JsonValueSchema.parse(value);
}

function writeUnifiedBinaryStringToken(
  value: string,
  bytes: number[],
  stringIds: Map<string, number>
): void {
  const stringId = stringIds.get(value);
  if (stringId !== undefined) {
    bytes.push(UNIFIED_BINARY_VALUE_STRING_REF);
    writeProtobufVarint(stringId, bytes);
    return;
  }

  bytes.push(UNIFIED_BINARY_VALUE_STRING);
  writeUnifiedBinaryBytes(strToU8(value), bytes);
}

function writeUnifiedBinaryBytes(value: Uint8Array, bytes: number[]): void {
  writeProtobufVarint(value.length, bytes);
  for (const byte of value) {
    bytes.push(byte);
  }
}

function decodeUnifiedBinaryValue(bytes: Uint8Array): JsonValue {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === UNIFIED_BINARY_VALUE_STRING_TABLE) {
    const tableResult = readUnifiedBinaryStringTable(view, bytes, 1);
    const result = readUnifiedBinaryValueWithStringTable(
      view,
      bytes,
      tableResult.next,
      tableResult.value
    );
    if (result.next !== bytes.length) {
      throw new Error("Unified binary payload has trailing bytes");
    }
    return result.value;
  }

  const result = readUnifiedBinaryValue(view, bytes, 0);
  if (result.next !== bytes.length) {
    throw new Error("Unified binary payload has trailing bytes");
  }
  return result.value;
}

function readUnifiedBinaryValue(
  view: DataView,
  bytes: Uint8Array,
  cursor: number
): { value: JsonValue; next: number } {
  if (cursor >= bytes.length) {
    throw new Error("Unexpected end of unified binary value");
  }

  const tag = bytes[cursor];
  const valueCursor = cursor + 1;

  if (tag === UNIFIED_BINARY_VALUE_NULL) {
    return { value: null, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_FALSE) {
    return { value: false, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_TRUE) {
    return { value: true, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_NUMBER) {
    const next = valueCursor + 8;
    if (next > bytes.length) {
      throw new Error("Unified binary number exceeds payload size");
    }
    return {
      value: view.getFloat64(valueCursor),
      next
    };
  }

  if (tag === UNIFIED_BINARY_VALUE_STRING) {
    const valueResult = readUnifiedBinaryBytes(bytes, valueCursor);
    return {
      value: strFromU8(valueResult.value),
      next: valueResult.next
    };
  }

  if (tag === UNIFIED_BINARY_VALUE_ARRAY) {
    const lengthResult = readProtobufVarint(view, valueCursor);
    const value: JsonValue[] = [];
    let next = lengthResult.next;
    for (let index = 0; index < lengthResult.value; index += 1) {
      const itemResult = readUnifiedBinaryValue(view, bytes, next);
      value.push(itemResult.value);
      next = itemResult.next;
    }
    return { value, next };
  }

  if (tag === UNIFIED_BINARY_VALUE_OBJECT) {
    const lengthResult = readProtobufVarint(view, valueCursor);
    const value: Record<string, JsonValue> = {};
    let next = lengthResult.next;
    for (let index = 0; index < lengthResult.value; index += 1) {
      const keyResult = readUnifiedBinaryBytes(bytes, next);
      const itemResult = readUnifiedBinaryValue(view, bytes, keyResult.next);
      value[strFromU8(keyResult.value)] = itemResult.value;
      next = itemResult.next;
    }
    return { value, next };
  }

  throw new Error(`Unsupported unified binary value tag ${tag}`);
}

function readUnifiedBinaryStringTable(
  view: DataView,
  bytes: Uint8Array,
  cursor: number
): { value: string[]; next: number } {
  const lengthResult = readProtobufVarint(view, cursor);
  const value: string[] = [];
  let next = lengthResult.next;
  for (let index = 0; index < lengthResult.value; index += 1) {
    const itemResult = readUnifiedBinaryBytes(bytes, next);
    value.push(strFromU8(itemResult.value));
    next = itemResult.next;
  }
  return { value, next };
}

function readUnifiedBinaryValueWithStringTable(
  view: DataView,
  bytes: Uint8Array,
  cursor: number,
  stringTable: readonly string[]
): { value: JsonValue; next: number } {
  if (cursor >= bytes.length) {
    throw new Error("Unexpected end of unified binary value");
  }

  const tag = bytes[cursor];
  const valueCursor = cursor + 1;

  if (tag === UNIFIED_BINARY_VALUE_NULL) {
    return { value: null, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_FALSE) {
    return { value: false, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_TRUE) {
    return { value: true, next: valueCursor };
  }

  if (tag === UNIFIED_BINARY_VALUE_NUMBER) {
    const next = valueCursor + 8;
    if (next > bytes.length) {
      throw new Error("Unified binary number exceeds payload size");
    }
    return {
      value: view.getFloat64(valueCursor),
      next
    };
  }

  if (
    tag === UNIFIED_BINARY_VALUE_STRING ||
    tag === UNIFIED_BINARY_VALUE_STRING_REF
  ) {
    return readUnifiedBinaryStringToken(
      view,
      bytes,
      cursor,
      stringTable
    );
  }

  if (tag === UNIFIED_BINARY_VALUE_ARRAY) {
    const lengthResult = readProtobufVarint(view, valueCursor);
    const value: JsonValue[] = [];
    let next = lengthResult.next;
    for (let index = 0; index < lengthResult.value; index += 1) {
      const itemResult = readUnifiedBinaryValueWithStringTable(
        view,
        bytes,
        next,
        stringTable
      );
      value.push(itemResult.value);
      next = itemResult.next;
    }
    return { value, next };
  }

  if (tag === UNIFIED_BINARY_VALUE_OBJECT) {
    const lengthResult = readProtobufVarint(view, valueCursor);
    const value: Record<string, JsonValue> = {};
    let next = lengthResult.next;
    for (let index = 0; index < lengthResult.value; index += 1) {
      const keyResult = readUnifiedBinaryStringToken(
        view,
        bytes,
        next,
        stringTable
      );
      const itemResult = readUnifiedBinaryValueWithStringTable(
        view,
        bytes,
        keyResult.next,
        stringTable
      );
      value[keyResult.value] = itemResult.value;
      next = itemResult.next;
    }
    return { value, next };
  }

  throw new Error(`Unsupported unified binary value tag ${tag}`);
}

function readUnifiedBinaryStringToken(
  view: DataView,
  bytes: Uint8Array,
  cursor: number,
  stringTable: readonly string[]
): { value: string; next: number } {
  if (cursor >= bytes.length) {
    throw new Error("Unexpected end of unified binary string token");
  }

  const tag = bytes[cursor];
  const valueCursor = cursor + 1;

  if (tag === UNIFIED_BINARY_VALUE_STRING) {
    const valueResult = readUnifiedBinaryBytes(bytes, valueCursor);
    return {
      value: strFromU8(valueResult.value),
      next: valueResult.next
    };
  }

  if (tag === UNIFIED_BINARY_VALUE_STRING_REF) {
    const valueResult = readProtobufVarint(view, valueCursor);
    const value = stringTable[valueResult.value];
    if (value === undefined) {
      throw new Error(`Unified binary string ref ${valueResult.value} is invalid`);
    }
    return {
      value,
      next: valueResult.next
    };
  }

  throw new Error(`Unsupported unified binary string token ${tag}`);
}

function readUnifiedBinaryBytes(
  bytes: Uint8Array,
  cursor: number
): { value: Uint8Array; next: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lengthResult = readProtobufVarint(view, cursor);
  const next = lengthResult.next + lengthResult.value;
  if (next > bytes.length) {
    throw new Error("Unified binary bytes exceed payload size");
  }
  return {
    value: bytes.subarray(lengthResult.next, next),
    next
  };
}

function decodeUnifiedRealtimeProtobufFrame(frame: Uint8Array | ArrayBuffer): {
  payload: Uint8Array;
} {
  const bytes = new Uint8Array(frame);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  let version: number | null = null;
  let codecId: number | null = null;
  let payload: Uint8Array | null = null;

  while (cursor < view.byteLength) {
    const keyResult = readProtobufVarint(view, cursor);
    cursor = keyResult.next;
    const fieldNumber = Math.floor(keyResult.value / 8);
    const wireType = keyResult.value % 8;

    if (fieldNumber === PROTOBUF_FIELD_VERSION) {
      if (wireType !== PROTOBUF_WIRE_TYPE_VARINT) {
        throw new Error("Invalid realtime protobuf version wire type");
      }
      if (version !== null) {
        throw new Error("Duplicate realtime protobuf version field");
      }
      const valueResult = readProtobufVarint(view, cursor);
      version = valueResult.value;
      cursor = valueResult.next;
      continue;
    }

    if (fieldNumber === PROTOBUF_FIELD_CODEC) {
      if (wireType !== PROTOBUF_WIRE_TYPE_VARINT) {
        throw new Error("Invalid realtime protobuf codec wire type");
      }
      if (codecId !== null) {
        throw new Error("Duplicate realtime protobuf codec field");
      }
      const valueResult = readProtobufVarint(view, cursor);
      codecId = valueResult.value;
      cursor = valueResult.next;
      continue;
    }

    if (fieldNumber === PROTOBUF_FIELD_PAYLOAD) {
      if (wireType !== PROTOBUF_WIRE_TYPE_LENGTH_DELIMITED) {
        throw new Error("Invalid realtime protobuf payload wire type");
      }
      if (payload !== null) {
        throw new Error("Duplicate realtime protobuf payload field");
      }
      const lengthResult = readProtobufVarint(view, cursor);
      cursor = lengthResult.next;
      const nextCursor = cursor + lengthResult.value;
      if (nextCursor > bytes.length) {
        throw new Error("Realtime protobuf payload length exceeds frame size");
      }
      payload = bytes.subarray(cursor, nextCursor);
      cursor = nextCursor;
      continue;
    }

    throw new Error(
      `Unsupported realtime protobuf field ${fieldNumber} with wire type ${wireType}`
    );
  }

  if (version === null) {
    throw new Error("Missing realtime protobuf version field");
  }
  if (codecId === null) {
    throw new Error("Missing realtime protobuf codec field");
  }
  if (payload === null) {
    throw new Error("Missing realtime protobuf payload field");
  }

  UnifiedRealtimeProtobufFrameHeaderSchema.parse({
    version,
    codec: decodeUnifiedRealtimeTransportCodec(codecId),
    payloadLength: payload.length
  });

  return { payload };
}

function decodeUnifiedRealtimeTransportCodec(
  codecId: number
): UnifiedRealtimeTransportCodec {
  if (codecId === UNIFIED_REALTIME_PROTOBUF_CODEC_ID_PROTOBUF_GZIP) {
    return UNIFIED_REALTIME_TRANSPORT_CODEC_PROTOBUF_GZIP;
  }
  throw new Error(`Unsupported realtime protobuf codec id ${codecId}`);
}

function writeProtobufVarintField(
  fieldNumber: number,
  value: number,
  bytes: number[]
): void {
  writeProtobufVarint(
    fieldNumber * 8 + PROTOBUF_WIRE_TYPE_VARINT,
    bytes
  );
  writeProtobufVarint(value, bytes);
}

function writeProtobufLengthDelimitedHeader(
  fieldNumber: number,
  length: number,
  bytes: number[]
): void {
  writeProtobufVarint(
    fieldNumber * 8 + PROTOBUF_WIRE_TYPE_LENGTH_DELIMITED,
    bytes
  );
  writeProtobufVarint(length, bytes);
}

function writeProtobufVarint(value: number, bytes: number[]): void {
  let remaining = value;
  while (remaining >= 128) {
    bytes.push((remaining % 128) + 128);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
}

function readProtobufVarint(
  view: DataView,
  cursor: number
): { value: number; next: number } {
  let value = 0;
  let multiplier = 1;
  let position = cursor;

  for (let byteCount = 0; byteCount < 10; byteCount += 1) {
    if (position >= view.byteLength) {
      throw new Error("Unexpected end of realtime protobuf varint");
    }
    const byte = view.getUint8(position);
    value += (byte % 128) * multiplier;
    position += 1;
    if (byte < 128) {
      return {
        value,
        next: position
      };
    }
    multiplier *= 128;
  }

  throw new Error("Realtime protobuf varint is too long");
}

type AssertTrue<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

const COMMAND_KIND_COVERAGE: Record<UnifiedCommandKind, true> = {
  listThreads: true,
  createThread: true,
  readThread: true,
  sendMessage: true,
  interrupt: true,
  listModels: true,
  listCollaborationModes: true,
  setCollaborationMode: true,
  submitUserInput: true,
  readLiveState: true,
  readStreamEvents: true,
  listProjectDirectories: true
};

const COMMAND_RESULT_KIND_COVERAGE: Record<UnifiedCommandResultKind, true> = {
  listThreads: true,
  createThread: true,
  readThread: true,
  sendMessage: true,
  interrupt: true,
  listModels: true,
  listCollaborationModes: true,
  setCollaborationMode: true,
  submitUserInput: true,
  readLiveState: true,
  readStreamEvents: true,
  listProjectDirectories: true
};

const ITEM_KIND_COVERAGE: Record<UnifiedItemKind, true> = {
  userMessage: true,
  steeringUserMessage: true,
  agentMessage: true,
  error: true,
  reasoning: true,
  plan: true,
  todoList: true,
  planImplementation: true,
  userInputResponse: true,
  commandExecution: true,
  fileChange: true,
  contextCompaction: true,
  webSearch: true,
  mcpToolCall: true,
  dynamicToolCall: true,
  collabAgentToolCall: true,
  imageView: true,
  enteredReviewMode: true,
  exitedReviewMode: true,
  remoteTaskCreated: true,
  modelChanged: true,
  forkedFromConversation: true,
  steered: true
};

const FEATURE_ID_COVERAGE: Record<UnifiedFeatureId, true> = {
  listThreads: true,
  createThread: true,
  readThread: true,
  sendMessage: true,
  interrupt: true,
  listModels: true,
  listCollaborationModes: true,
  setCollaborationMode: true,
  submitUserInput: true,
  readLiveState: true,
  readStreamEvents: true,
  listProjectDirectories: true
};

const EVENT_KIND_COVERAGE: Record<UnifiedEventKind, true> = {
  providerStateChanged: true,
  threadUpdated: true,
  userInputRequested: true,
  userInputResolved: true,
  error: true
};

type MissingCommandKinds = Exclude<UnifiedCommandKind, keyof typeof COMMAND_KIND_COVERAGE>;
type MissingCommandResultKinds = Exclude<UnifiedCommandResultKind, keyof typeof COMMAND_RESULT_KIND_COVERAGE>;
type MissingItemKinds = Exclude<UnifiedItemKind, keyof typeof ITEM_KIND_COVERAGE>;
type MissingFeatureIds = Exclude<UnifiedFeatureId, keyof typeof FEATURE_ID_COVERAGE>;
type MissingEventKinds = Exclude<UnifiedEventKind, keyof typeof EVENT_KIND_COVERAGE>;
type MissingRealtimeServerMessageKinds = Exclude<
  UnifiedRealtimeServerMessageKind,
  (typeof UNIFIED_REALTIME_SERVER_MESSAGE_KINDS)[number]
>;
type MissingRealtimeClientMessageKinds = Exclude<
  UnifiedRealtimeClientMessageKind,
  (typeof UNIFIED_REALTIME_CLIENT_MESSAGE_KINDS)[number]
>;

type _AssertNoMissingCommandKinds = AssertTrue<IsNever<MissingCommandKinds>>;
type _AssertNoMissingCommandResultKinds = AssertTrue<IsNever<MissingCommandResultKinds>>;
type _AssertNoMissingItemKinds = AssertTrue<IsNever<MissingItemKinds>>;
type _AssertNoMissingFeatureIds = AssertTrue<IsNever<MissingFeatureIds>>;
type _AssertNoMissingEventKinds = AssertTrue<IsNever<MissingEventKinds>>;
type _AssertNoMissingRealtimeServerMessageKinds = AssertTrue<
  IsNever<MissingRealtimeServerMessageKinds>
>;
type _AssertNoMissingRealtimeClientMessageKinds = AssertTrue<
  IsNever<MissingRealtimeClientMessageKinds>
>;

void (
  {
    commandKinds: UNIFIED_COMMAND_KINDS,
    itemKinds: UNIFIED_ITEM_KINDS,
    featureIds: UNIFIED_FEATURE_IDS,
    eventKinds: UNIFIED_EVENT_KINDS,
    commandCoverage: COMMAND_KIND_COVERAGE,
    commandResultCoverage: COMMAND_RESULT_KIND_COVERAGE,
    itemCoverage: ITEM_KIND_COVERAGE,
    featureCoverage: FEATURE_ID_COVERAGE,
    eventCoverage: EVENT_KIND_COVERAGE,
    realtimeServerKinds: UNIFIED_REALTIME_SERVER_MESSAGE_KINDS,
    realtimeClientKinds: UNIFIED_REALTIME_CLIENT_MESSAGE_KINDS
  }
);

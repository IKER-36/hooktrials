import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'passed', 'failed']);
export const resourceTypeEnum = pgEnum('resource_type', [
  'external_api',
  'internal_api',
  'http_route',
  'webhook_route',
  'webhook_destination',
]);
export const environmentEnum = pgEnum('integration_environment', ['test', 'staging', 'production']);
export const monitorMethodEnum = pgEnum('monitor_method', ['GET', 'HEAD', 'POST']);
export const monitorStateEnum = pgEnum('monitor_state', [
  'new',
  'healthy',
  'degraded',
  'down',
  'paused',
]);
export const monitorOutcomeEnum = pgEnum('monitor_outcome', ['healthy', 'degraded', 'down']);
export const incidentStatusEnum = pgEnum('incident_status', ['open', 'recovered']);
export const endpointModeEnum = pgEnum('endpoint_mode', ['trial', 'observe', 'protect']);
export const deliveryKindEnum = pgEnum('delivery_kind', ['forward', 'retry', 'replay']);
export const deliveryStateEnum = pgEnum('delivery_state', [
  'queued',
  'delivering',
  'succeeded',
  'failed',
  'retrying',
  'dead_letter',
]);
export const signatureProviderEnum = pgEnum('signature_provider', ['none', 'github', 'stripe']);
export const signatureStatusEnum = pgEnum('signature_status', [
  'not_configured',
  'valid',
  'invalid',
  'missing',
  'stale',
]);
export const alertEventEnum = pgEnum('alert_event', ['opened', 'recovered']);
export const alertStateEnum = pgEnum('alert_state', ['pending', 'sent', 'failed']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash'),
    displayName: varchar('display_name', { length: 80 }).notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    emailVerified: boolean('email_verified').notNull().default(false),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

export const scenarios = pgTable(
  'scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    definition: jsonb('definition').notNull(),
    builtIn: boolean('built_in').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('scenarios_user_id_idx').on(table.userId)],
);

export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id'),
    scenarioId: uuid('scenario_id').references(() => scenarios.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 80 }).notNull(),
    publicTokenHash: text('public_token_hash').notNull(),
    publicTokenPrefix: varchar('public_token_prefix', { length: 16 }).notNull(),
    encryptedToken: text('encrypted_token'),
    mode: endpointModeEnum('mode').notNull().default('trial'),
    environment: environmentEnum('environment').notNull().default('test'),
    encryptedDestinationUrl: text('encrypted_destination_url'),
    encryptedDestinationHeaders: text('encrypted_destination_headers'),
    displayDestinationHost: varchar('display_destination_host', { length: 255 }),
    destinationTimeoutMs: integer('destination_timeout_ms').notNull().default(10_000),
    retryMaxAttempts: integer('retry_max_attempts').notNull().default(5),
    retryBaseDelayMs: integer('retry_base_delay_ms').notNull().default(2_000),
    retryMaxDelayMs: integer('retry_max_delay_ms').notNull().default(300_000),
    encryptedContract: text('encrypted_contract'),
    signatureProvider: signatureProviderEnum('signature_provider').notNull().default('none'),
    encryptedSignatureSecret: text('encrypted_signature_secret'),
    signatureToleranceSeconds: integer('signature_tolerance_seconds').notNull().default(300),
    destinationExpectedMinStatus: integer('destination_expected_min_status').notNull().default(200),
    destinationExpectedMaxStatus: integer('destination_expected_max_status').notNull().default(299),
    allowPrivateNetworks: boolean('allow_private_networks').notNull().default(false),
    allowedPrivateCidrs: jsonb('allowed_private_cidrs').notNull().default([]),
    productionConfirmedAt: timestamp('production_confirmed_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('endpoints_public_token_hash_unique').on(table.publicTokenHash),
    uniqueIndex('endpoints_resource_id_unique').on(table.resourceId),
    index('endpoints_user_id_idx').on(table.userId),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    correlationKey: varchar('correlation_key', { length: 255 }).notNull(),
    bodyHash: varchar('body_hash', { length: 64 }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('events_endpoint_correlation_unique').on(table.endpointId, table.correlationKey),
    index('events_correlation_key_idx').on(table.correlationKey),
  ],
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    method: varchar('method', { length: 16 }).notNull(),
    path: text('path').notNull(),
    headers: jsonb('headers').notNull(),
    encryptedBody: text('encrypted_body').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    responseStatus: integer('response_status').notNull(),
    responseDelayMs: integer('response_delay_ms').notNull().default(0),
    contractResult: jsonb('contract_result').notNull().default({}),
    signatureProvider: signatureProviderEnum('signature_provider').notNull().default('none'),
    signatureStatus: signatureStatusEnum('signature_status').notNull().default('not_configured'),
  },
  (table) => [
    uniqueIndex('attempts_event_sequence_unique').on(table.eventId, table.sequence),
    index('attempts_received_at_idx').on(table.receivedAt),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    status: reportStatusEnum('status').notNull().default('pending'),
    score: integer('score'),
    result: jsonb('result'),
    publicTokenHash: text('public_token_hash'),
    publicExpiresAt: timestamp('public_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('reports_event_id_unique').on(table.eventId)],
);

export const integrationResources = pgTable(
  'integration_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: resourceTypeEnum('type').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    environment: environmentEnum('environment').notNull().default('test'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('integration_resources_user_id_idx').on(table.userId)],
);

export const monitors = pgTable(
  'monitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => integrationResources.id, { onDelete: 'cascade' }),
    encryptedUrl: text('encrypted_url').notNull(),
    displayHost: varchar('display_host', { length: 255 }).notNull(),
    method: monitorMethodEnum('method').notNull().default('GET'),
    encryptedHeaders: text('encrypted_headers'),
    intervalSeconds: integer('interval_seconds').notNull().default(300),
    timeoutMs: integer('timeout_ms').notNull().default(10_000),
    expectedMinStatus: integer('expected_min_status').notNull().default(200),
    expectedMaxStatus: integer('expected_max_status').notNull().default(299),
    expectedText: varchar('expected_text', { length: 256 }),
    expectedJsonPath: varchar('expected_json_path', { length: 255 }),
    consecutiveFailuresToOpen: integer('consecutive_failures_to_open').notNull().default(2),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    allowPrivateNetworks: boolean('allow_private_networks').notNull().default(false),
    allowedPrivateCidrs: jsonb('allowed_private_cidrs').notNull().default([]),
    state: monitorStateEnum('state').notNull().default('new'),
    publicStatusTokenHash: text('public_status_token_hash'),
    publicStatusEnabled: boolean('public_status_enabled').notNull().default(false),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }).notNull().defaultNow(),
    lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('monitors_resource_id_unique').on(table.resourceId),
    uniqueIndex('monitors_public_status_token_hash_unique').on(table.publicStatusTokenHash),
    index('monitors_next_check_at_idx').on(table.nextCheckAt),
  ],
);

export const monitorChecks = pgTable(
  'monitor_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    statusCode: integer('status_code'),
    latencyMs: integer('latency_ms'),
    responseBytes: integer('response_bytes').notNull().default(0),
    outcome: monitorOutcomeEnum('outcome').notNull(),
    errorCategory: varchar('error_category', { length: 32 }),
    contractResult: jsonb('contract_result').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('monitor_checks_monitor_id_idx').on(table.monitorId),
    index('monitor_checks_started_at_idx').on(table.startedAt),
  ],
);

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => integrationResources.id, { onDelete: 'cascade' }),
    status: incidentStatusEnum('status').notNull().default('open'),
    cause: varchar('cause', { length: 32 }).notNull(),
    summary: text('summary').notNull(),
    evidence: jsonb('evidence').notNull().default({}),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    recoveredAt: timestamp('recovered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('incidents_resource_id_idx').on(table.resourceId),
    index('incidents_status_idx').on(table.status),
  ],
);

export const destinationDeliveries = pgTable(
  'destination_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    inboundAttemptId: uuid('inbound_attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => integrationResources.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull().default(1),
    kind: deliveryKindEnum('kind').notNull().default('forward'),
    state: deliveryStateEnum('state').notNull().default('delivering'),
    statusCode: integer('status_code'),
    latencyMs: integer('latency_ms'),
    responseBytes: integer('response_bytes').notNull().default(0),
    errorCategory: varchar('error_category', { length: 32 }),
    errorMessage: varchar('error_message', { length: 512 }),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    replayOfDeliveryId: uuid('replay_of_delivery_id'),
    auditMetadata: jsonb('audit_metadata').notNull().default({}),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('destination_deliveries_event_id_idx').on(table.eventId),
    index('destination_deliveries_attempt_id_idx').on(table.inboundAttemptId),
    index('destination_deliveries_resource_id_idx').on(table.resourceId),
    index('destination_deliveries_state_idx').on(table.state),
  ],
);

export const alertChannels = pgTable(
  'alert_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedUrl: text('encrypted_url').notNull(),
    displayHost: varchar('display_host', { length: 255 }).notNull(),
    encryptedHeaders: text('encrypted_headers'),
    active: boolean('active').notNull().default(true),
    allowPrivateNetworks: boolean('allow_private_networks').notNull().default(false),
    allowedPrivateCidrs: jsonb('allowed_private_cidrs').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('alert_channels_user_id_unique').on(table.userId)],
);

export const alertDeliveries = pgTable(
  'alert_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => alertChannels.id, { onDelete: 'cascade' }),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    event: alertEventEnum('event').notNull(),
    state: alertStateEnum('state').notNull().default('pending'),
    statusCode: integer('status_code'),
    errorCategory: varchar('error_category', { length: 32 }),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('alert_deliveries_incident_event_unique').on(table.incidentId, table.event),
    index('alert_deliveries_state_idx').on(table.state),
  ],
);

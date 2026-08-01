/**
 * The public, redacted API contract.
 *
 * This document intentionally describes the stable integration and automation surface rather
 * than mirroring every browser-only route. Session-authenticated dashboard routes are included
 * where they help a self-hosted operator discover the product; payloads, secrets and destination
 * URLs are never represented as example values.
 */
export function buildOpenApiDocument(apiOrigin: string): Record<string, unknown> {
  const server = apiOrigin.replace(/\/$/, '');
  const json = (schema: Record<string, unknown>, description: string) => ({
    required: true,
    content: { 'application/json': { schema } },
    description,
  });
  const pathParameter = (name: string, description: string) => ({
    name,
    in: 'path',
    required: true,
    description,
    schema: { type: 'string' },
  });
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const response = (description: string, schema?: Record<string, unknown>) => ({
    description,
    ...(schema ? { content: { 'application/json': { schema } } } : {}),
  });

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'HookTrials API',
      version: '0.33.2',
      description:
        'A redacted contract for integration setup, synthetic reliability checks and evidence export. Payload bodies, captured headers, credentials and destination URLs are never returned by the automation surface.',
      license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' },
    },
    servers: [{ url: server, description: 'Configured HookTrials API origin' }],
    externalDocs: {
      description: 'End-user API and CI guidance',
      url: 'https://github.com/IKER-36/hooktrials/blob/main/docs/api-keys.md',
    },
    tags: [
      { name: 'System', description: 'Health and installation discovery.' },
      { name: 'Authentication', description: 'Session creation for the dashboard.' },
      { name: 'Routes', description: 'Trial and live endpoint inventory.' },
      { name: 'Monitoring', description: 'Active monitor inventory and checks.' },
      { name: 'Automation', description: 'Scoped CI operations using API keys.' },
      { name: 'Evidence', description: 'Redacted reliability evidence.' },
      { name: 'Public status', description: 'Payload-free public service health.' },
    ],
    paths: {
      '/openapi.json': {
        get: {
          operationId: 'getOpenApiDocument',
          tags: ['System'],
          summary: 'Download this API contract',
          responses: { '200': response('OpenAPI 3.1 document') },
        },
      },
      '/healthz': {
        get: {
          operationId: 'getHealth',
          tags: ['System'],
          summary: 'Check API availability',
          responses: {
            '200': response('The API is ready', {
              type: 'object',
              required: ['service', 'status', 'timestamp'],
              properties: {
                service: { type: 'string', example: 'api' },
                status: { type: 'string', enum: ['ok'] },
                timestamp: { type: 'string', format: 'date-time' },
              },
            }),
          },
        },
      },
      '/v1/setup': {
        get: {
          operationId: 'getSetup',
          tags: ['System'],
          summary: 'Discover installation mode and registration state',
          responses: { '200': response('Installation discovery', ref('Setup')) },
        },
      },
      '/v1/auth/register': {
        post: {
          operationId: 'registerAccount',
          tags: ['Authentication'],
          summary: 'Create the first or an open-registration account',
          requestBody: json(ref('RegisterRequest'), 'Display name, email and password.'),
          responses: {
            '201': response('Account created', ref('AuthResponse')),
            '403': response('Registration is closed', ref('Error')),
            '409': response('The email is already registered', ref('Error')),
          },
        },
      },
      '/v1/auth/login': {
        post: {
          operationId: 'loginAccount',
          tags: ['Authentication'],
          summary: 'Create a dashboard session',
          requestBody: json(ref('LoginRequest'), 'Account credentials.'),
          responses: {
            '200': response('Session created', ref('AuthResponse')),
            '401': response('Credentials rejected', ref('Error')),
          },
        },
      },
      '/v1/endpoints': {
        get: {
          operationId: 'listEndpoints',
          tags: ['Routes'],
          summary: 'List routes visible to the current session',
          security: [{ cookieSession: [] }],
          responses: { '200': response('Route inventory', { type: 'object' }) },
        },
        post: {
          operationId: 'createEndpoint',
          tags: ['Routes'],
          summary: 'Create a Trial, Observe or Protect route',
          security: [{ cookieSession: [] }],
          requestBody: json(ref('EndpointRequest'), 'Route configuration.'),
          responses: {
            '201': response('Route created', ref('Endpoint')),
            '400': response('Invalid route configuration', ref('Error')),
          },
        },
      },
      '/v1/endpoints/{endpointId}/test-event': {
        post: {
          operationId: 'sendSyntheticEndpointEvent',
          tags: ['Routes'],
          summary: 'Send one synthetic event through a route',
          security: [{ cookieSession: [] }],
          parameters: [pathParameter('endpointId', 'Route identifier.')],
          requestBody: json(
            { type: 'object', properties: { confirm: { type: 'boolean', const: true } } },
            'Explicit confirmation that the request is synthetic.',
          ),
          responses: {
            '202': response('Event accepted', ref('AutomationResult')),
            '404': response('Route not found', ref('Error')),
          },
        },
      },
      '/v1/monitors': {
        get: {
          operationId: 'listMonitors',
          tags: ['Monitoring'],
          summary: 'List active monitors visible to the current session',
          security: [{ cookieSession: [] }],
          responses: { '200': response('Monitor inventory', { type: 'object' }) },
        },
        post: {
          operationId: 'createMonitor',
          tags: ['Monitoring'],
          summary: 'Create an HTTP, HTTPS or ICMP monitor',
          security: [{ cookieSession: [] }],
          requestBody: json(ref('MonitorRequest'), 'Monitor configuration.'),
          responses: {
            '201': response('Monitor created', { type: 'object' }),
            '400': response('Invalid monitor or blocked target', ref('Error')),
          },
        },
      },
      '/v1/monitors/{monitorId}/run': {
        post: {
          operationId: 'runMonitorNow',
          tags: ['Monitoring'],
          summary: 'Run one immediate health check',
          security: [{ cookieSession: [] }],
          parameters: [pathParameter('monitorId', 'Monitor identifier.')],
          responses: {
            '202': response('Check queued', { type: 'object' }),
            '404': response('Monitor not found', ref('Error')),
          },
        },
      },
      '/v1/automation/endpoints/{endpointId}/test-event': {
        post: {
          operationId: 'runAutomationEvent',
          tags: ['Automation'],
          summary: 'Run one synthetic check with a scoped write key',
          description:
            'This operation never creates a route and never accepts an arbitrary destination. The endpoint must already exist and the key must have the write scope.',
          security: [{ apiKey: ['write'] }],
          parameters: [
            pathParameter('endpointId', 'Existing Observe or Protect route identifier.'),
          ],
          requestBody: json(
            {
              type: 'object',
              required: ['confirm'],
              properties: { confirm: { type: 'boolean', const: true } },
            },
            'Explicit synthetic-run confirmation.',
          ),
          responses: {
            '202': response('Synthetic event accepted', ref('AutomationResult')),
            '401': response('API key missing or revoked', ref('Error')),
            '403': response('The key lacks the write scope', ref('Error')),
          },
        },
      },
      '/v1/automation/events/{eventId}/export': {
        get: {
          operationId: 'exportAutomationEvidence',
          tags: ['Automation', 'Evidence'],
          summary: 'Export redacted evidence for one event',
          security: [{ apiKey: ['read'] }],
          parameters: [
            pathParameter('eventId', 'Recorded event identifier.'),
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['json', 'markdown'], default: 'json' },
            },
          ],
          responses: {
            '200': response('Redacted JSON or Markdown evidence'),
            '401': response('API key missing or revoked', ref('Error')),
            '403': response('The key lacks the read scope', ref('Error')),
            '404': response('Event not found or expired', ref('Error')),
          },
        },
      },
      '/v1/evidence': {
        get: {
          operationId: 'listEvidence',
          tags: ['Evidence'],
          summary: 'List redacted evidence for the current session',
          security: [{ cookieSession: [] }],
          responses: { '200': response('Evidence inventory', { type: 'object' }) },
        },
      },
      '/v1/status/{token}': {
        get: {
          operationId: 'getPublicStatus',
          tags: ['Public status'],
          summary: 'Read a public status page',
          parameters: [pathParameter('token', 'Opaque public status token.')],
          responses: {
            '200': response('Selected monitor health and incident summary', { type: 'object' }),
            '404': response('Status page disabled, revoked or unknown', ref('Error')),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'htk_…',
          description: 'Scoped API key created under Resources → API keys. Secrets are shown once.',
        },
        cookieSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'hooktrials_session',
          description: 'Dashboard session cookie. Prefer scoped API keys for CI.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', example: 'validation_error' },
            message: { type: 'string' },
          },
        },
        Setup: {
          type: 'object',
          required: ['deploymentMode', 'registrationOpen', 'setupRequired', 'publicOrigin'],
          properties: {
            deploymentMode: { type: 'string', enum: ['cloud', 'selfhost'] },
            registrationOpen: { type: 'boolean' },
            setupRequired: { type: 'boolean' },
            publicOrigin: { type: 'string', format: 'uri' },
            externalAccess: { type: 'boolean' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['displayName', 'email', 'password'],
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 80 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12, writeOnly: true },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', writeOnly: true },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { type: 'object' },
            verificationRequired: { type: 'boolean' },
          },
        },
        EndpointRequest: {
          type: 'object',
          required: ['name', 'mode'],
          properties: {
            name: { type: 'string', maxLength: 80 },
            mode: { type: 'string', enum: ['trial', 'observe', 'protect'] },
            scenarioId: { type: 'string' },
            destinationUrl: { type: 'string', format: 'uri', writeOnly: true },
            deliveryPolicy: { ...ref('DeliveryPolicyRequest'), writeOnly: true },
          },
        },
        DeliveryPolicyRequest: {
          type: 'object',
          required: ['destinations'],
          description:
            'Protect-mode routing policy. Destination URLs and headers are accepted on write and never returned.',
          properties: {
            strategy: { type: 'string', enum: ['single', 'fanout', 'failover'], default: 'single' },
            idempotencyScope: {
              type: 'string',
              enum: ['destination', 'event'],
              default: 'destination',
            },
            destinations: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'object',
                required: ['name', 'url'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string', minLength: 2, maxLength: 80 },
                  url: { type: 'string', format: 'uri', writeOnly: true },
                  headers: { type: 'object', writeOnly: true },
                  timeoutMs: { type: 'integer', minimum: 1000, maximum: 30000 },
                  expectedMinStatus: { type: 'integer', minimum: 100, maximum: 599 },
                  expectedMaxStatus: { type: 'integer', minimum: 100, maximum: 599 },
                  active: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        Endpoint: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            mode: { type: 'string', enum: ['trial', 'observe', 'protect'] },
            status: { type: 'string' },
            ingestUrl: { type: 'string', format: 'uri' },
          },
        },
        MonitorRequest: {
          type: 'object',
          required: ['name', 'resourceType', 'protocol', 'url'],
          properties: {
            name: { type: 'string', maxLength: 80 },
            resourceType: {
              type: 'string',
              enum: [
                'external_api',
                'internal_api',
                'http_route',
                'webhook_destination',
                'icmp_host',
              ],
            },
            protocol: { type: 'string', enum: ['http', 'icmp'] },
            environment: { type: 'string', enum: ['test', 'staging', 'production'] },
            url: {
              type: 'string',
              description: 'HTTP(S) URL or hostname checked by the monitor.',
            },
            method: { type: 'string', enum: ['GET', 'HEAD', 'POST'] },
            intervalSeconds: { type: 'integer', enum: [60, 300, 900] },
            timeoutMs: { type: 'integer', minimum: 1000, maximum: 30000 },
            expectedMinStatus: { type: 'integer', minimum: 100, maximum: 599 },
            expectedMaxStatus: { type: 'integer', minimum: 100, maximum: 599 },
            expectedText: { type: 'string', maxLength: 256 },
            expectedJsonPath: { type: 'string', example: '$.data.ready' },
            sloTarget: {
              type: 'number',
              minimum: 90,
              maximum: 100,
              description: 'Availability objective as a percentage.',
              example: 99.9,
            },
            sloWindowDays: {
              type: 'integer',
              minimum: 1,
              maximum: 30,
              description: 'Rolling error-budget window in days.',
              example: 7,
            },
          },
        },
        AutomationResult: {
          type: 'object',
          required: ['accepted', 'statusCode', 'latencyMs', 'destinationTriggered'],
          properties: {
            accepted: { type: 'boolean' },
            eventId: { type: ['string', 'null'] },
            correlationKey: { type: 'string' },
            mode: { type: 'string', enum: ['observe', 'protect'] },
            statusCode: { type: 'integer' },
            latencyMs: { type: 'integer' },
            destinationTriggered: { type: 'boolean' },
          },
        },
      },
    },
  };
}

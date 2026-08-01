import { parse as parseYaml } from 'yaml';

export type ImportMonitorMethod = 'GET' | 'HEAD' | 'POST';

export interface OpenApiImportedOperation {
  id: string;
  method: ImportMonitorMethod | string;
  path: string;
  name: string;
  summary: string;
  operationId: string;
  tags: string[];
  url: string | null;
  expectedMinStatus: number;
  expectedMaxStatus: number;
  requiresPostConfirmation: boolean;
  skipReason?: string;
}

export interface OpenApiImportResult {
  title: string;
  version: string;
  baseUrl: string;
  operations: OpenApiImportedOperation[];
  warnings: string[];
}

const supportedMethods = new Set(['get', 'head', 'post']);
const knownMethods = new Set(['get', 'head', 'post', 'put', 'patch', 'delete', 'options', 'trace']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function resolveServerUrl(value: unknown): string {
  const server = asRecord(value);
  if (!server) return '';
  let url = text(server.url);
  const variables = asRecord(server.variables);
  if (!url || !variables) return url;
  for (const [name, rawVariable] of Object.entries(variables)) {
    const variable = asRecord(rawVariable);
    const defaultValue = text(variable?.default);
    if (defaultValue) url = url.replaceAll(`{${name}}`, defaultValue);
  }
  return url;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    return '';
  }
  return parsed.toString().replace(/\/$/, '');
}

function operationUrl(baseUrl: string, path: string): string | null {
  if (!baseUrl || /\{[^}]+\}/.test(path)) return null;
  try {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = path.replace(/^\//, '');
    const url = new URL(normalizedPath, base);
    return url.toString();
  } catch {
    return null;
  }
}

function expectedStatusRange(operation: Record<string, unknown>): [number, number] {
  const responses = asRecord(operation.responses);
  const successCodes = Object.keys(responses ?? {})
    .map((code) => code.toLowerCase())
    .filter((code) => /^2\d\d$/.test(code) || code === '2xx')
    .map((code) => (code === '2xx' ? [200, 299] : [Number(code), Number(code)]));
  if (!successCodes.length) return [200, 299];
  const ranges = successCodes.flat();
  return [Math.min(...ranges), Math.max(...ranges)];
}

function operationName(method: string, path: string, operationId: string, summary: string): string {
  const candidate = operationId || summary || `${method} ${path}`;
  return candidate.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function skipReasonForPath(path: string): string | undefined {
  if (!path.startsWith('/')) return 'Path must start with /.';
  if (/\{[^}]+\}/.test(path)) return 'Path parameters need a concrete value before monitoring.';
  return undefined;
}

export function parseOpenApiDocument(source: string, baseUrlOverride = ''): OpenApiImportResult {
  if (source.length > 1_000_000) throw new Error('The OpenAPI document is larger than 1 MB.');
  let document: unknown;
  try {
    document = parseYaml(source);
  } catch {
    throw new Error('The document is not valid JSON or YAML.');
  }
  const root = asRecord(document);
  if (!root) throw new Error('The document must contain an OpenAPI object.');
  const openapi = text(root.openapi);
  if (!openapi.startsWith('3.')) {
    if (text(root.swagger))
      throw new Error('Swagger 2.0 is not supported yet. Export an OpenAPI 3.x document.');
    throw new Error('Only OpenAPI 3.0 and 3.1 documents are supported.');
  }
  const paths = asRecord(root.paths);
  if (!paths) throw new Error('The document does not contain a valid paths object.');

  const serverList = Array.isArray(root.servers) ? root.servers : [];
  const detectedBase = normalizeBaseUrl(resolveServerUrl(serverList[0]));
  const baseUrl = normalizeBaseUrl(baseUrlOverride) || detectedBase;
  const warnings: string[] = [];
  if (!baseUrl) warnings.push('Add a public HTTP(S) server URL before importing monitors.');
  if (
    detectedBase &&
    !normalizeBaseUrl(baseUrlOverride) &&
    /\{[^}]+\}/.test(resolveServerUrl(serverList[0]))
  ) {
    warnings.push('The first server contains variables without defaults; add a concrete base URL.');
  }

  const operations: OpenApiImportedOperation[] = [];
  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = asRecord(rawPathItem);
    if (!pathItem) {
      operations.push({
        id: `${path}:invalid`,
        method: 'UNKNOWN',
        path,
        name: path,
        summary: '',
        operationId: '',
        tags: [],
        url: null,
        expectedMinStatus: 200,
        expectedMaxStatus: 299,
        requiresPostConfirmation: false,
        skipReason: 'Path item is not an object.',
      });
      continue;
    }
    for (const [rawMethod, rawOperation] of Object.entries(pathItem)) {
      const method = rawMethod.toLowerCase();
      if (!knownMethods.has(method)) continue;
      const operation = asRecord(rawOperation);
      const id = `${method}:${path}`;
      const operationId = text(operation?.operationId);
      const summary = text(operation?.summary, text(operation?.description));
      const status = expectedStatusRange(operation ?? {});
      const tags = Array.isArray(operation?.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 4)
        : [];
      const skipReason = !operation
        ? 'This operation uses an external reference and could not be expanded.'
        : !supportedMethods.has(method)
          ? `HTTP ${method.toUpperCase()} is not a safe monitor method.`
          : skipReasonForPath(path);
      const monitorMethod = method.toUpperCase();
      operations.push({
        id,
        method: monitorMethod,
        path,
        name: operationName(monitorMethod, path, operationId, summary),
        summary,
        operationId,
        tags,
        url: skipReason ? null : operationUrl(baseUrl, path),
        expectedMinStatus: status[0],
        expectedMaxStatus: status[1],
        requiresPostConfirmation: method === 'post',
        skipReason:
          skipReason ??
          (!operationUrl(baseUrl, path) ? 'Add a valid server URL first.' : undefined),
      });
    }
  }

  const unresolved = operations.filter((operation) => operation.skipReason).length;
  if (unresolved) {
    warnings.push(
      `${unresolved} operation${unresolved === 1 ? '' : 's'} cannot be imported as a monitor.`,
    );
  }
  return {
    title: text(asRecord(root.info)?.title, 'Untitled API'),
    version: text(asRecord(root.info)?.version, 'Unversioned'),
    baseUrl,
    operations: operations.sort((left, right) =>
      `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`),
    ),
    warnings,
  };
}

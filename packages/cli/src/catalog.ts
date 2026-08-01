export interface OpenApiOperation {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  tags: string[];
}

export interface OpenApiDocument {
  openapi: string;
  info: { title?: string; version?: string };
  paths: Record<
    string,
    Record<string, { operationId?: string; summary?: string; tags?: string[] }>
  >;
  [key: string]: unknown;
}

export async function fetchOpenApiDocument(
  apiOrigin: string,
  fetcher: typeof fetch = fetch,
): Promise<OpenApiDocument> {
  const response = await fetcher(`${apiOrigin.replace(/\/$/, '')}/openapi.json`, {
    headers: { accept: 'application/json' },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(`OpenAPI request failed with HTTP ${response.status}`);
  if (!isOpenApiDocument(body)) throw new Error('The API returned an invalid OpenAPI document');
  return body;
}

export function listOpenApiOperations(document: OpenApiDocument): OpenApiOperation[] {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  return Object.entries(document.paths)
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method, operation]) => methods.has(method) && Boolean(operation.operationId))
        .map(([method, operation]) => ({
          method: method.toUpperCase(),
          path,
          operationId: operation.operationId!,
          summary: operation.summary ?? '',
          tags: operation.tags ?? [],
        })),
    )
    .sort((left, right) =>
      `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`),
    );
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.openapi === 'string' &&
    candidate.openapi.startsWith('3.') &&
    typeof candidate.paths === 'object' &&
    candidate.paths !== null
  );
}

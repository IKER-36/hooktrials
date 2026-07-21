export type Locale = 'en' | 'es';

export const es: Record<string, string> = {
  'ONE WEBHOOK CHANNEL': 'UN CANAL WEBHOOK',
  'EMPTY BODY': 'CUERPO VACÍO',
  'Body hash': 'Hash del cuerpo',
  'See the complete retry cycle': 'Ver el ciclo completo de reintentos',
  'Resume the endpoint before running the demo.':
    'Reanuda el endpoint antes de ejecutar la demostración.',
  Impact: 'Impacto',
  'Recorded window': 'Ventana registrada',
  'Open HookTrials': 'Abrir HookTrials',
  'Integration reliability evidence': 'Evidencia de fiabilidad de la integración',
  'Monitor catalogue': 'Catálogo de monitores',
  'Expected result': 'Resultado esperado',
  'Run your first trial': 'Ejecuta tu primera prueba',
  'Watch the retries unfold here, live.': 'Observa aquí los reintentos en directo.',
  'Send the test manually with curl': 'Envía la prueba manualmente con curl',
  'Waiting for the first delivery.': 'Esperando la primera entrega.',
  'Demo complete. Event': 'Demostración completada. El evento',
  'is now in the timeline below.': 'ya aparece en la cronología inferior.',
  'Keeping the same': 'Mantener el mismo',
  'groups every delivery into one retry timeline.':
    'agrupa cada entrega en una única cronología de reintentos.',
  'START HERE': 'EMPIEZA AQUÍ',
  RAW: 'SIN PROCESAR',
  '01 Provider → HookTrials': '01 Proveedor → HookTrials',
  '02 Validation': '02 Validación',
  '04 HookTrials → Provider': '04 HookTrials → Proveedor',
  '· environment:': '· entorno:',
  'LOCAL ONLY': 'SOLO LOCAL',
  'Payload inspector': 'Inspector de payload',
  'Basic inspection': 'Inspección básica',
  'Accept one delivery successfully and inspect its headers, body and metadata.':
    'Acepta correctamente una entrega e inspecciona sus headers, cuerpo y metadatos.',
  'Learn what HookTrials captures': 'Descubre qué captura HookTrials',
  'Retry recovery': 'Recuperación con reintentos',
  'Temporary outage': 'Caída temporal',
  'Return two server errors before recovering on the third delivery.':
    'Devuelve dos errores del servidor antes de recuperarse en la tercera entrega.',
  'Prove that retries eventually recover': 'Demuestra que los reintentos terminan recuperándose',
  'Rate-limit handling': 'Gestión del límite de peticiones',
  'Rate limited': 'Limitado por tasa',
  'Return 429 with Retry-After, then accept the next delivery.':
    'Devuelve 429 con Retry-After y acepta la siguiente entrega.',
  'Check whether retry guidance is respected': 'Comprueba si se respetan las pautas de reintento',
  'Worst-day sequence': 'Secuencia del peor día',
  'Unstable endpoint': 'Endpoint inestable',
  'Walk through an error, a delayed outage, throttling and final recovery.':
    'Recorre un error, una caída con retraso, limitación y recuperación final.',
  'Show the complete retry timeline': 'Muestra la cronología completa de reintentos',
  'Pick what you want to demonstrate. We configure the endpoint name and deterministic response sequence for you.':
    'Elige qué quieres demostrar. Configuramos por ti el nombre del endpoint y la secuencia determinista de respuestas.',
  'A custom cascading-outage recipe is added to the scenario library.':
    'Se añade a la biblioteca una receta personalizada de caída en cascada.',
  'Provider retries become one 500 → 503 → 429 → 200 timeline.':
    'Los reintentos del proveedor forman una cronología 500 → 503 → 429 → 200.',
  'One request is proxied synchronously and its destination failure is recorded.':
    'Una petición se reenvía de forma síncrona y se registra el fallo de destino.',
  'The event is accepted first, retried durably and recovered without data loss.':
    'El evento se acepta primero, se reintenta de forma duradera y se recupera sin perder datos.',
  'HTTP and ICMP checks fill every health state and a public status page.':
    'Las comprobaciones HTTP e ICMP cubren todos los estados de salud y una página pública.',
  'The lab creates isolated Trial, Observe and Protect routes, a synthetic destination, one custom scenario, five monitored integrations, a multi-monitor public status page, a recoverable dead letter, incident and alert evidence, plus one expiring report. Cleanup matches the private run ID and your account before removing anything.':
    'El laboratorio crea rutas aisladas de Trial, Observe y Protect, un destino sintético, un escenario personalizado, cinco integraciones monitorizadas, una página pública de estado con varios monitores, una entrega recuperable en dead-letter, evidencia de incidentes y alertas y un informe temporal. La limpieza valida el ID privado de ejecución y tu cuenta antes de eliminar nada.',
  'Open public status page': 'Abrir página pública de estado',
  'Recovery queue': 'Cola de recuperación',
  'A separate delivery exhausts its retry budget and enters dead-letter.':
    'Una entrega independiente agota sus reintentos y entra en dead letter.',
  'Open and recovered incidents, retries and safe alert audit share one queue.':
    'Incidentes abiertos y recuperados, reintentos y alertas auditadas comparten una cola.',
  'A redacted, expiring report proves the recovered Trial sequence.':
    'Un informe redactado y temporal demuestra la secuencia de Prueba recuperada.',
  'An existing Demo Lab workspace was recovered. Reset it safely before running a new journey.':
    'Se recuperó un espacio existente de Demo Lab. Restablécelo de forma segura antes de iniciar otro recorrido.',
  'Creating isolated, synthetic demo resources…':
    'Creando recursos de demostración sintéticos y aislados…',
  'The Trial event did not produce a complete timeline.':
    'El evento de Prueba no generó una cronología completa.',
  'The monitor catalogue did not produce every expected health state.':
    'El catálogo de monitores no generó todos los estados de salud esperados.',
  'Full workspace ready. Every module now contains safe, inspectable evidence.':
    'Espacio completo listo. Todos los módulos contienen evidencias seguras e inspeccionables.',
  'HookTrials receives a webhook and returns controlled responses. The sender performs the retries; HookTrials captures every attempt and explains what happened.':
    'HookTrials recibe un webhook y devuelve respuestas controladas. El emisor realiza los reintentos; HookTrials captura cada intento y explica qué ocurrió.',
  'Demo · deterministic provider trial': 'Demo · prueba determinista del proveedor',
  'Demo · synthetic destination': 'Demo · destino sintético',
  'Demo · Observe delivery failure': 'Demo · fallo de entrega en Observe',
  'Demo · GitHub protected recovery': 'Demo · recuperación protegida de GitHub',
  'Demo · protected dead-letter': 'Demo · dead-letter protegido',
  'DEMO DATA': 'DATOS DEMO',
  synthetic: 'sintéticas',
  'Open Webhook Hub': 'Abrir el concentrador de webhooks',
  'Open failure scenarios': 'Abrir escenarios de fallo',
  'Inspect monitoring': 'Inspeccionar monitorización',
  'Demo resources removed. Your other endpoints and monitors were not touched.':
    'Recursos demo eliminados. Tus demás endpoints y monitores no se han modificado.',
  'Enter the URL again to rotate or change alert configuration.':
    'Vuelve a introducir la URL para rotar o cambiar la configuración de alertas.',
  'Alert channel saved. Send a test before relying on it.':
    'Canal de alertas guardado. Envía una prueba antes de confiar en él.',
  'Anyone with the link can view redacted delivery evidence for 24 hours. Payloads, captured headers, signing secrets, authentication data and destination URLs are excluded. Creating a new link replaces the previous one.':
    'Cualquiera con el enlace puede ver durante 24 horas evidencias redactadas de la entrega. Se excluyen payloads, headers capturados, secretos de firma, autenticación y URLs de destino. Crear un enlace nuevo sustituye al anterior.',
  'The demo delivery could not reach this endpoint. Check that it is publicly reachable.':
    'La entrega demo no pudo alcanzar este endpoint. Comprueba que sea accesible públicamente.',
  'A destination URL is required for Observe mode.':
    'Se necesita una URL de destino para el modo Observar.',
  'Destination headers must be a JSON object.': 'Los headers de destino deben ser un objeto JSON.',
  'Enter the provider signing secret before enabling verification.':
    'Introduce el secreto de firma del proveedor antes de activar la verificación.',
  'Preset applied. Enter the provider signing secret, review the contract, then save.':
    'Preset aplicado. Introduce el secreto de firma, revisa el contrato y guarda.',
  'Contract starter applied. Header presence will be verified; native signature verification currently supports Stripe and GitHub.':
    'Plantilla de contrato aplicada. Se verificará la presencia de headers; la firma nativa admite Stripe y GitHub.',
  'Protect mode is not enabled on this build yet.':
    'El modo Proteger aún no está habilitado en esta compilación.',
  'That delivery no longer exists.': 'Esa entrega ya no existe.',
  'That endpoint no longer exists.': 'Ese endpoint ya no existe.',
  'That event is no longer available. It may have expired.':
    'Ese evento ya no está disponible. Puede haber caducado.',
  'This origin is not allowed to call the API.': 'Este origen no puede llamar a la API.',
  'This permanently removes the endpoint and every captured event and attempt. Providers pointing at its URL will start receiving 404.':
    'Esto elimina permanentemente el endpoint y todos los eventos e intentos capturados. Los proveedores que usen su URL empezarán a recibir 404.',
  'Scenario deleted.': 'Escenario eliminado.',
  'HookTrials home': 'Inicio de HookTrials',
  'Loading HookTrials': 'Cargando HookTrials',
  'Restoring session…': 'Restaurando sesión…',
  Dashboard: 'Panel',
  Overview: 'Resumen',
  'Control plane': 'Plano de control',
  'Control plane · selected route': 'Plano de control · ruta seleccionada',
  'Live operations': 'Operaciones en vivo',
  Product: 'Producto',
  'Production workspace': 'Espacio productivo',
  Lab: 'Laboratorio',
  Monitoring: 'Monitorización',
  'Reliability Lab': 'Laboratorio de fiabilidad',
  'Reliability Lab · guided demo': 'Laboratorio de fiabilidad · demo guiada',
  'Trial endpoints': 'Endpoints de prueba',
  'Failure scenarios': 'Escenarios de fallo',
  'Guided demo': 'Demo guiada',
  Documentation: 'Documentación',
  'Current module': 'Módulo actual',
  'Exercise failure and retry behaviour with synthetic traffic, completely separate from your live webhook routes.':
    'Ejercita fallos y reintentos con tráfico sintético, completamente separado de tus rutas webhook reales.',
  'trial endpoints': 'endpoints de prueba',
  'Your trial endpoints': 'Tus endpoints de prueba',
  'Live Webhooks': 'Webhooks reales',
  'Webhook Hub & live traffic': 'Concentrador de webhooks y tráfico real',
  'Concentrate real providers, inspect every request and control delivery.':
    'Concentra proveedores reales, inspecciona cada petición y controla la entrega.',
  'Webhook Hub places HookTrials between a provider and your real backend. One public ingestion URL captures, validates and forwards every request while preserving an operational trail.':
    'El concentrador sitúa HookTrials entre un proveedor y tu backend real. Una URL pública captura, valida y reenvía cada petición mientras conserva una trazabilidad operativa.',
  'Choose the provider and enter the current public webhook destination.':
    'Elige el proveedor e introduce el destino público actual del webhook.',
  'Use Observe for synchronous forwarding or Protect for durable acceptance and retries.':
    'Usa Observar para el reenvío síncrono o Proteger para la aceptación duradera y los reintentos.',
  'Add the Stripe or GitHub signing secret when native verification is required.':
    'Añade el secreto de firma de Stripe o GitHub cuando necesites verificación nativa.',
  'Copy the generated HookTrials URL into the provider webhook settings.':
    'Copia la URL generada por HookTrials en la configuración de webhooks del proveedor.',
  'Send a provider test, then open the live inspector to verify both sides.':
    'Envía una prueba desde el proveedor y abre el inspector en directo para verificar ambos lados.',
  'Real webhook traffic is centralized without losing visibility, validation or recovery evidence.':
    'El tráfico webhook real queda centralizado sin perder visibilidad, validación ni evidencias de recuperación.',
  'The provider must call the HookTrials URL; traffic cannot be intercepted passively.':
    'El proveedor debe llamar a la URL de HookTrials; el tráfico no puede interceptarse de forma pasiva.',
  'Cloud destinations must use public HTTPS and the final backend should be idempotent.':
    'Los destinos de Cloud deben usar HTTPS público y el backend final debe ser idempotente.',
  'Observe returns the destination response; Protect returns 202 and delivers asynchronously.':
    'Observar devuelve la respuesta del destino; Proteger devuelve 202 y realiza la entrega de forma asíncrona.',
  'Live traffic': 'Tráfico real',
  'Webhook Hub': 'Concentrador de webhooks',
  'Put HookTrials between every provider and your backend. Inspect the complete request, validate it and forward it with an auditable delivery trail.':
    'Sitúa HookTrials entre cada proveedor y tu backend. Inspecciona la petición completa, valídala y reenvíala con una trazabilidad auditable.',
  'Live webhook summary': 'Resumen de webhooks reales',
  'live routes': 'rutas activas',
  protected: 'protegidas',
  'Webhook traffic flow': 'Flujo de tráfico webhook',
  'Provider sends': 'El proveedor envía',
  'Stripe, GitHub, Shopify, Slack or any service':
    'Stripe, GitHub, Shopify, Slack o cualquier servicio',
  'HookTrials intercepts': 'HookTrials intercepta',
  'Capture, signature, contract and delivery evidence':
    'Captura, firma, contrato y evidencia de entrega',
  'Your backend receives': 'Tu backend recibe',
  'Forward once or deliver durably with retries': 'Reenvío único o entrega duradera con reintentos',
  'New live connection': 'Nueva conexión real',
  'Connect a real webhook': 'Conectar un webhook real',
  'HookTrials gives you one public URL. Replace the destination in your provider and all traffic will pass through the reliability hub.':
    'HookTrials te proporciona una URL pública. Sustituye el destino en tu proveedor y todo el tráfico pasará por el concentrador de fiabilidad.',
  Provider: 'Proveedor',
  Generic: 'Genérico',
  'Any HTTPS webhook provider': 'Cualquier proveedor de webhooks HTTPS',
  'Native Stripe-Signature verification': 'Verificación nativa de Stripe-Signature',
  'Topic and delivery header contract': 'Contrato de headers de tema y entrega',
  'Timestamp and signature header contract': 'Contrato de headers de fecha y firma',
  'Connection name': 'Nombre de la conexión',
  'Your current webhook destination': 'Tu destino webhook actual',
  'Encrypted at rest and never returned to the browser.':
    'Cifrado en reposo y nunca devuelto al navegador.',
  'Delivery strategy': 'Estrategia de entrega',
  'Forward synchronously and return your backend response to the provider.':
    'Reenvía de forma síncrona y devuelve al proveedor la respuesta de tu backend.',
  'Accept first, queue durably and retry safely if your backend is down.':
    'Acepta primero, encola de forma duradera y reintenta de forma segura si tu backend está caído.',
  'Stripe endpoint signing secret (optional now)':
    'Secreto de firma del endpoint de Stripe (opcional ahora)',
  'GitHub webhook secret (optional now)': 'Secreto del webhook de GitHub (opcional ahora)',
  'At least 8 characters': 'Al menos 8 caracteres',
  'Write-only and encrypted. You can add it after the provider has accepted the new HookTrials URL.':
    'Cifrado y de solo escritura. Puedes añadirlo después de que el proveedor acepte la nueva URL de HookTrials.',
  'Finish signature verification': 'Completar la verificación de firma',
  'After registering the HookTrials URL, paste the provider signing secret here. Incoming traffic remains visible, but it is not cryptographically verified until this step is complete.':
    'Después de registrar la URL de HookTrials, pega aquí el secreto de firma del proveedor. El tráfico entrante seguirá siendo visible, pero no se verificará criptográficamente hasta completar este paso.',
  'Enable signature verification': 'Activar verificación de firma',
  'Enabling…': 'Activando…',
  'I understand that this route becomes part of the production delivery path and my destination must handle idempotency.':
    'Entiendo que esta ruta pasa a formar parte del flujo de entrega de producción y que mi destino debe gestionar la idempotencia.',
  'Hosted limit reached — remove an endpoint first.':
    'Límite de Cloud alcanzado: elimina primero un endpoint.',
  'Creating secure route…': 'Creando ruta segura…',
  'Create live connection': 'Crear conexión real',
  Activation: 'Activación',
  'Your route is ready': 'Tu ruta está lista',
  'ready to receive': 'lista para recibir',
  'Open the webhook settings in': 'Abre la configuración de webhooks en',
  'your provider': 'tu proveedor',
  'Replace the current URL with the HookTrials URL above.':
    'Sustituye la URL actual por la URL de HookTrials mostrada arriba.',
  'Send a test event and open the connection to inspect the complete journey.':
    'Envía un evento de prueba y abre la conexión para inspeccionar el recorrido completo.',
  'Delete endpoint': 'Eliminar endpoint',
  'What happens next': 'Qué ocurre después',
  'Public HookTrials URL': 'URL pública de HookTrials',
  'Create the route': 'Crea la ruta',
  'Choose a provider, your real destination and a delivery strategy.':
    'Elige un proveedor, tu destino real y una estrategia de entrega.',
  'Copy one public URL': 'Copia una URL pública',
  'Paste it into the provider instead of your current backend URL.':
    'Pégala en el proveedor en lugar de la URL actual de tu backend.',
  'Watch real traffic': 'Observa el tráfico real',
  'Inspect requests, validation, destination responses, retries and recovery.':
    'Inspecciona peticiones, validación, respuestas del destino, reintentos y recuperación.',
  'Open live inspector': 'Abrir inspector en directo',
  'Payloads and secrets are encrypted at rest. Private network destinations remain blocked in HookTrials Cloud.':
    'Los payloads y secretos están cifrados en reposo. Los destinos de redes privadas permanecen bloqueados en HookTrials Cloud.',
  Concentrator: 'Concentrador',
  'Live connections': 'Conexiones reales',
  'One control plane for every provider and backend.':
    'Un único plano de control para todos los proveedores y backends.',
  'No live routes yet.': 'Todavía no hay rutas reales.',
  'Create the first connection above. Trial endpoints remain separate and safe.':
    'Crea arriba la primera conexión. Los endpoints de prueba permanecen separados y seguros.',
  LIVE: 'ACTIVA',
  Inspect: 'Inspeccionar',
  Endpoints: 'Endpoints',
  'Scenario Studio': 'Estudio de escenarios',
  Monitor: 'Monitorización',
  Operations: 'Operaciones',
  'Demo Lab': 'Laboratorio demo',
  Docs: 'Documentación',
  'Help & docs': 'Ayuda y documentación',
  'Log out': 'Cerrar sesión',
  'Open product tour': 'Abrir tour del producto',
  'Product tour': 'Tour del producto',
  'Search routes, monitoring, recovery…': 'Buscar rutas, monitorización, recuperación…',
  'Integration workspace': 'Espacio de integraciones',
  'Control Center': 'Centro de control',
  'Integration reliability, now': 'Fiabilidad de integraciones, ahora',
  'Control surface': 'Superficie de control',
  'Integration readiness': 'Preparación de la integración',
  'Production readiness': 'Preparación para producción',
  'Production baseline proven': 'Base de producción demostrada',
  'Highest-impact next step': 'Siguiente paso de mayor impacto',
  'Every point comes from configuration or recorded evidence, never a hidden grade.':
    'Cada punto procede de la configuración o de evidencias registradas, nunca de una nota oculta.',
  'What is proven — and what is missing': 'Qué está demostrado y qué falta',
  'Current checks show no reliability penalty.':
    'Las comprobaciones actuales no muestran penalizaciones de fiabilidad.',
  'Endpoints online': 'Endpoints activos',
  'Active endpoint': 'Endpoint activo',
  'Events retained': 'Eventos conservados',
  'Attempts observed': 'Intentos observados',
  'Recovered / 24h': 'Recuperados / 24 h',
  'Recoveries 24h': 'Recuperaciones 24 h',
  'Unresolved DLQ': 'DLQ sin resolver',
  'Recent outgoing notifications': 'Notificaciones salientes recientes',
  'Recent checks': 'Comprobaciones recientes',
  'Your webhook lab': 'Tu laboratorio de webhooks',
  'Your endpoints': 'Tus endpoints',
  'New trial': 'Nueva prueba',
  'Create an endpoint': 'Crear un endpoint',
  'Create endpoint': 'Crear endpoint',
  'Create a trial endpoint.': 'Crea un endpoint de prueba.',
  'Create your first trial endpoint with the form on this page.':
    'Crea tu primer endpoint de prueba con el formulario de esta página.',
  'Choose a deterministic failure scenario.': 'Elige un escenario de fallo determinista.',
  'Copy the generated webhook URL.': 'Copia la URL de webhook generada.',
  'Point a provider at it — or send a test curl.':
    'Conecta un proveedor o envía un curl de prueba.',
  'Open the resulting timeline to inspect payload, headers, delays and score.':
    'Abre la cronología resultante para revisar payload, headers, retrasos y puntuación.',
  'Endpoint metrics': 'Métricas del endpoint',
  'No endpoints yet.': 'Todavía no hay endpoints.',
  'Failure scenario': 'Escenario de fallo',
  'The selected scenario decides each HTTP response.':
    'El escenario seleccionado determina cada respuesta HTTP.',
  'Use synthetic payloads whenever possible.': 'Usa payloads sintéticos siempre que sea posible.',
  'Copy URL': 'Copiar URL',
  'Copy curl': 'Copiar curl',
  'Copy body': 'Copiar cuerpo',
  Copy: 'Copiar',
  Copied: 'Copiado',
  'Copy failed': 'Error al copiar',
  Pause: 'Pausar',
  Resume: 'Reanudar',
  Delete: 'Eliminar',
  Edit: 'Editar',
  'Close form': 'Cerrar formulario',
  'New monitor': 'Nuevo monitor',
  'Create first monitor': 'Crear primer monitor',
  'Integration health': 'Salud de integraciones',
  'Know what failed, where it failed and when it recovered.':
    'Descubre qué falló, dónde falló y cuándo se recuperó.',
  Resources: 'Recursos',
  Healthy: 'Saludable',
  Degraded: 'Degradado',
  Down: 'Caído',
  'All integrations': 'Todas las integraciones',
  'Unified inventory': 'Inventario unificado',
  'Active checks + real webhook traffic': 'Comprobaciones activas + tráfico real de webhooks',
  Integration: 'Integración',
  Type: 'Tipo',
  Environment: 'Entorno',
  Mode: 'Modo',
  Status: 'Estado',
  Score: 'Puntuación',
  Latency: 'Latencia',
  'Latest issue': 'Último problema',
  'Passive signals': 'Señales pasivas',
  'Managed webhook routes': 'Rutas de webhook gestionadas',
  'Waiting for real traffic': 'Esperando tráfico real',
  'Open journey →': 'Abrir recorrido →',
  'Add your first integration': 'Añade tu primera integración',
  'Monitor an API, HTTP route or webhook destination. HookTrials checks availability, latency and response contracts without storing full response bodies.':
    'Monitoriza una API, una ruta HTTP o un destino webhook. HookTrials comprueba disponibilidad, latencia y contratos de respuesta sin guardar cuerpos completos.',
  'Monitored integrations': 'Integraciones monitorizadas',
  'Inspect monitor': 'Inspeccionar monitor',
  'Run now': 'Ejecutar ahora',
  'Queued…': 'Encolado…',
  'First check queued.': 'Primera comprobación encolada.',
  'Worker will run it shortly. Use Run now to prioritize it.':
    'El worker la ejecutará en breve. Usa Ejecutar ahora para priorizarla.',
  'No open incident. Latest evidence passes configured expectations.':
    'No hay incidentes abiertos. La última evidencia cumple las expectativas configuradas.',
  'Availability 1h': 'Disponibilidad 1 h',
  'Availability 24h': 'Disponibilidad 24 h',
  'Average latency': 'Latencia media',
  'p95 latency': 'Latencia p95',
  'Checks 24h': 'Comprobaciones 24 h',
  'Public communication': 'Comunicación pública',
  'Status pages': 'Páginas de estado',
  'Publish a branded, read-only view containing only the monitors you choose.':
    'Publica una vista personalizada y de solo lectura con los monitores que elijas.',
  'New status page': 'Nueva página de estado',
  'Create a monitor before publishing a status page.':
    'Crea un monitor antes de publicar una página de estado.',
  'No custom status page yet. Create one to share selected service health.':
    'Aún no hay una página de estado personalizada. Crea una para compartir la salud de los servicios elegidos.',
  'Service status': 'Estado del servicio',
  'All systems operational': 'Todos los sistemas operativos',
  'Live availability and incident history.': 'Disponibilidad e historial de incidentes en directo.',
  Open: 'Abrir',
  'Copy link': 'Copiar enlace',
  Rotate: 'Rotar',
  'Internal name': 'Nombre interno',
  'Public headline': 'Titular público',
  Description: 'Descripción',
  'Accent color': 'Color de acento',
  'Public page enabled': 'Página pública activada',
  'Monitors shown publicly': 'Monitores mostrados públicamente',
  Cancel: 'Cancelar',
  'Save status page': 'Guardar página de estado',
  'Saving…': 'Guardando…',
  'Choose at least one monitor.': 'Elige al menos un monitor.',
  'Rotate this public link? The previous URL will stop working.':
    '¿Rotar este enlace público? La URL anterior dejará de funcionar.',
  'Public status': 'Estado público',
  'Share availability without exposing credentials':
    'Comparte disponibilidad sin exponer credenciales',
  'Create public status link': 'Crear enlace de estado público',
  'Disable public status': 'Desactivar estado público',
  'Copy status link': 'Copiar enlace de estado',
  'Public link created. Creating another link rotates this one.':
    'Enlace público creado. Crear otro enlace rotará este.',
  'Public status disabled. Previous links no longer work.':
    'Estado público desactivado. Los enlaces anteriores ya no funcionan.',
  'Edit integration': 'Editar integración',
  'New integration': 'Nueva integración',
  'Update active monitoring': 'Actualizar monitorización activa',
  'Configure active monitoring': 'Configurar monitorización activa',
  'Secrets encrypted at rest': 'Secretos cifrados en reposo',
  Name: 'Nombre',
  'Check type': 'Tipo de comprobación',
  'HTTP / HTTPS': 'HTTP / HTTPS',
  'ICMP ping': 'Ping ICMP',
  'Resource type': 'Tipo de recurso',
  'External API': 'API externa',
  'Internal API': 'API interna',
  'HTTP route': 'Ruta HTTP',
  'Webhook destination': 'Destino webhook',
  'ICMP host': 'Host ICMP',
  Test: 'Pruebas',
  Staging: 'Preproducción',
  Production: 'Producción',
  'Hostname or IP': 'Hostname o IP',
  'Target URL': 'URL de destino',
  'Cloud permits publicly routable hosts only. ICMP must be enabled by the target network.':
    'Cloud sólo permite hosts enrutables públicamente. La red de destino debe permitir ICMP.',
  'Cloud permits public HTTPS targets only. Query values remain encrypted and are hidden from UI.':
    'Cloud sólo permite destinos HTTPS públicos. Los valores de query permanecen cifrados y ocultos en la interfaz.',
  Frequency: 'Frecuencia',
  'Every minute': 'Cada minuto',
  'Every 5 minutes': 'Cada 5 minutos',
  'Every 15 minutes': 'Cada 15 minutos',
  'Timeout (ms)': 'Tiempo límite (ms)',
  'Failures before Down': 'Fallos antes de marcar Caído',
  Method: 'Método',
  'Expected status from': 'Estado esperado desde',
  'Expected status to': 'Estado esperado hasta',
  'Expected text (optional)': 'Texto esperado (opcional)',
  'JSON path (optional)': 'Ruta JSON (opcional)',
  'Authentication headers (optional JSON)': 'Headers de autenticación (JSON opcional)',
  'Values are write-only after creation and never returned by API.':
    'Los valores son de sólo escritura tras crearse y la API nunca los devuelve.',
  'Remove stored authentication headers': 'Eliminar headers de autenticación guardados',
  'Monitor explicitly allowed private network':
    'Monitorizar una red privada permitida explícitamente',
  'Allowed CIDRs': 'CIDR permitidos',
  'HTTP and private destinations become available only inside these ranges.':
    'Los destinos HTTP y privados sólo están disponibles dentro de estos rangos.',
  'Validating target…': 'Validando destino…',
  'Save changes': 'Guardar cambios',
  'Create monitor': 'Crear monitor',
  'Headers must be a JSON object.': 'Los headers deben ser un objeto JSON.',
  'Delete monitor': 'Eliminar monitor',
  'This permanently removes its checks, metrics and incident history. It does not affect the monitored service.':
    'Esto elimina permanentemente sus comprobaciones, métricas e historial de incidentes. No afecta al servicio monitorizado.',
  'Scenario library': 'Biblioteca de escenarios',
  'Deterministic testing': 'Pruebas deterministas',
  'Failure orchestration': 'Orquestación de fallos',
  'Start from a test template': 'Empieza con una plantilla de prueba',
  'Expected responses': 'Respuestas esperadas',
  'Response sequence': 'Secuencia de respuestas',
  'Repeat final response': 'Repetir respuesta final',
  'Last response repeats for further retries.':
    'La última respuesta se repite para los reintentos posteriores.',
  'Each delivery advances one step for the same event ID.':
    'Cada entrega avanza un paso para el mismo ID de evento.',
  'Every retry keeps the same event ID and becomes another attempt.':
    'Cada reintento conserva el mismo ID de evento y se convierte en otro intento.',
  'Response delay': 'Retraso de respuesta',
  'Body format': 'Formato del cuerpo',
  Body: 'Cuerpo',
  Headers: 'Headers',
  'Any method': 'Cualquier método',
  'Save scenario': 'Guardar escenario',
  'Delete scenario': 'Eliminar escenario',
  'Operations summary': 'Resumen de operaciones',
  'Recovery control': 'Control de recuperación',
  'Dead-letter inbox': 'Bandeja de dead letters',
  'Unresolved dead letters': 'Dead letters sin resolver',
  'Deliveries needing a decision': 'Entregas que requieren una decisión',
  'No unresolved dead letters.': 'No hay dead letters sin resolver.',
  'Open Operations': 'Abrir Operaciones',
  'Incident timeline': 'Cronología de incidentes',
  'What failed and recovered': 'Qué falló y se recuperó',
  'No incident evidence yet.': 'Todavía no hay evidencias de incidentes.',
  'Outgoing incident alerts': 'Alertas salientes de incidentes',
  'Alert audit': 'Auditoría de alertas',
  'Configure the channel below, then send a test.':
    'Configura el canal y después envía una prueba.',
  'Demo journey progress': 'Progreso del recorrido demo',
  'Guided demonstration': 'Demostración guiada',
  'Use it step by step': 'Úsalo paso a paso',
  'Run full proof': 'Ejecutar prueba completa',
  'Payload used by the demo': 'Payload usado por la demo',
  'ISOLATED · USER OWNED · SAFE TO CLEAN': 'AISLADO · PROPIEDAD DEL USUARIO · SEGURO DE LIMPIAR',
  'Demo alerts audited': 'Alertas demo auditadas',
  'Product documentation': 'Documentación del producto',
  'Product guide': 'Guía del producto',
  'Technical docs': 'Documentación técnica',
  'Quick start': 'Inicio rápido',
  'How it works': 'Cómo funciona',
  'If the result looks wrong': 'Si el resultado parece incorrecto',
  'Dashboard sections': 'Secciones del panel',
  'Open the full guide': 'Abrir la guía completa',
  'Open Scenario Studio': 'Abrir Estudio de escenarios',
  'Open inventory': 'Abrir inventario',
  'Open operations': 'Abrir operaciones',
  'See reliability at a glance': 'Consulta la fiabilidad de un vistazo',
  'Connect real traffic safely': 'Conecta tráfico real con seguridad',
  'Webhook Hub creates the public provider URL, encrypted destination, validation and Observe or Protect delivery strategy as one live connection.':
    'El Concentrador de webhooks crea la URL pública del proveedor, el destino cifrado, la validación y la estrategia Observar o Proteger como una única conexión real.',
  'Live connections stay in Product and never appear inside the synthetic Trial inventory.':
    'Las conexiones reales permanecen en Producto y nunca aparecen en el inventario sintético de Prueba.',
  'Build a deterministic trial': 'Crea una prueba determinista',
  'Trial endpoints receive synthetic traffic and return controlled failures without forwarding requests into your real delivery path.':
    'Los endpoints de prueba reciben tráfico sintético y devuelven fallos controlados sin reenviar peticiones a tu ruta de entrega real.',
  'The Lab stays isolated from Product while preserving the same request and retry evidence.':
    'El Laboratorio permanece aislado de Producto y conserva las mismas evidencias de peticiones y reintentos.',
  'Create a safe webhook route': 'Crea una ruta webhook segura',
  'Design the failure you need to prove': 'Diseña el fallo que necesitas demostrar',
  'Measure APIs and destinations': 'Mide APIs y destinos',
  'Recover from one queue': 'Recupérate desde una única cola',
  'Explore the whole product safely': 'Explora todo el producto con seguridad',
  'Keep the operating guide beside the product': 'Mantén la guía operativa junto al producto',
  'Close product tour': 'Cerrar tour del producto',
  'Previous step': 'Paso anterior',
  Next: 'Siguiente',
  Finish: 'Finalizar',
  'Tour controls': 'Controles del tour',
  'Public service status': 'Estado público del servicio',
  'Published monitors': 'Monitores publicados',
  'Hosted on CubePath': 'Alojado en CubePath',
  'Hosted on': 'Alojado en',
  'Status page unavailable': 'Página de estado no disponible',
  'The link may have been rotated or disabled by its owner.':
    'El propietario puede haber rotado o desactivado el enlace.',
  'Loading public status': 'Cargando estado público',
  'Latest checks': 'Últimas comprobaciones',
  'Updates every 30 seconds': 'Se actualiza cada 30 segundos',
  'No public check evidence yet.': 'Todavía no hay evidencias públicas de comprobaciones.',
  'Recent check outcomes': 'Resultados de comprobaciones recientes',
  'Incident history': 'Historial de incidentes',
  'No incident recorded in the shared history.':
    'No hay incidentes registrados en el historial compartido.',
  'Evidence generated by HookTrials': 'Evidencia generada por HookTrials',
  'Open-source reliability control plane': 'Plano de control de fiabilidad open source',
  Evidence: 'Evidencia',
  'Redacted evidence': 'Evidencia redactada',
  'Redacted evidence · read only': 'Evidencia redactada · sólo lectura',
  'Evidence link unavailable.': 'Enlace de evidencia no disponible.',
  'It expired, was revoked or never existed.': 'Ha caducado, fue revocado o nunca existió.',
  'Loading verified evidence…': 'Cargando evidencia verificada…',
  'No payload, secret headers, credentials or destination URL.':
    'Sin payload, headers secretos, credenciales ni URL de destino.',
  Attempts: 'Intentos',
  Attempt: 'Intento',
  'Selected attempt': 'Intento seleccionado',
  'Inbound attempts': 'Intentos entrantes',
  'Destination deliveries': 'Entregas al destino',
  'End-to-end timeline': 'Cronología de extremo a extremo',
  'Event inspector': 'Inspector de eventos',
  'Close inspector': 'Cerrar inspector',
  'Loading event': 'Cargando evento',
  'Loading events': 'Cargando eventos',
  'No headers captured.': 'No se capturaron headers.',
  'This attempt carried no payload.': 'Este intento no contenía payload.',
  'Payload values and secret headers stay inside the authenticated inspector.':
    'Los valores del payload y los headers secretos permanecen dentro del inspector autenticado.',
  Signature: 'Firma',
  Contract: 'Contrato',
  'Contract evidence': 'Evidencia del contrato',
  'Integrity gate': 'Control de integridad',
  'Reliability Replay': 'Replay de fiabilidad',
  'Evidence-based runbook': 'Runbook basado en evidencias',
  'Explainable reliability score': 'Puntuación de fiabilidad explicable',
  'Explainable score': 'Puntuación explicable',
  'Resilience score': 'Puntuación de resiliencia',
  'Resilience report': 'Informe de resiliencia',
  'Report pending — it is generated in background.':
    'Informe pendiente: se genera en segundo plano.',
  Configuration: 'Configuración',
  'Route control': 'Control de ruta',
  Trial: 'Prueba',
  Observe: 'Observar',
  Protect: 'Proteger',
  'Return deterministic failures. Nothing reaches your backend.':
    'Devuelve fallos deterministas. Nada llega a tu backend.',
  'Forward once, mirror the result and diagnose each side.':
    'Reenvía una vez, refleja el resultado y diagnostica ambos lados.',
  'Durable queue, retries and dead-letter recovery.':
    'Cola duradera, reintentos y recuperación de dead letters.',
  'Durable recovery': 'Recuperación duradera',
  'Retry timelines': 'Cronologías de reintentos',
  'Protected recoveries': 'Recuperaciones protegidas',
  'Signature and inbound contract': 'Firma y contrato entrante',
  'Provider presets': 'Preajustes de proveedor',
  'Provider → validation → destination': 'Proveedor → validación → destino',
  'Existing workspace recovered': 'Espacio existente recuperado',
  'Before production needs them to.': 'Antes de que producción los necesite.',
  'Break it. Observe it. Recover it.': 'Rómpelo. Obsérvalo. Recupéralo.',
  'Start testing': 'Empezar pruebas',
  'Create your account': 'Crea tu cuenta',
  'Start testing in less than a minute.': 'Empieza a probar en menos de un minuto.',
  'Display name': 'Nombre visible',
  Email: 'Correo electrónico',
  Password: 'Contraseña',
  'At least 12 characters.': 'Al menos 12 caracteres.',
  'Create account': 'Crear cuenta',
  'Already have an account?': '¿Ya tienes una cuenta?',
  'Log in': 'Iniciar sesión',
  'Welcome back': 'Bienvenido de nuevo',
  'Continue to your reliability workspace.': 'Continúa a tu espacio de fiabilidad.',
  "Don't have an account?": '¿No tienes una cuenta?',
  'Sign up': 'Regístrate',
  'Owner access · registration closed': 'Acceso del propietario · registro cerrado',
  'Self-host ready': 'Listo para self-hosting',
  'Source code · AGPL-3.0': 'Código fuente · AGPL-3.0',
  'Powered by HookTrials': 'Con tecnología HookTrials',
  'Something went wrong. Please try again.': 'Algo ha ido mal. Inténtalo de nuevo.',
  'Network error. Check your connection and try again.':
    'Error de red. Comprueba la conexión e inténtalo de nuevo.',
  'An account already exists for this email.': 'Ya existe una cuenta con este correo.',
  'Registration is closed on this installation.': 'El registro está cerrado en esta instalación.',
  'Email or password is incorrect.': 'El correo o la contraseña no son correctos.',
  'Your session has expired. Log in again to continue.':
    'Tu sesión ha caducado. Inicia sesión de nuevo.',
  'You have reached the hosted endpoint limit.': 'Has alcanzado el límite de endpoints alojados.',
  'That scenario is no longer available.': 'Ese escenario ya no está disponible.',
  'That custom scenario no longer exists.': 'Ese escenario personalizado ya no existe.',
  'Move endpoints away from this scenario before deleting it.':
    'Cambia los endpoints de escenario antes de eliminarlo.',
  'That monitor no longer exists.': 'Ese monitor ya no existe.',
  'Resume this monitor before running an immediate check.':
    'Reanuda este monitor antes de ejecutar una comprobación inmediata.',
  'A Demo Lab workspace already exists. Reset it before starting another run.':
    'Ya existe un espacio de Demo Lab. Restablécelo antes de iniciar otra ejecución.',
  'Target blocked by outbound network safety policy.':
    'Destino bloqueado por la política de seguridad de red saliente.',
  'Add a destination URL before enabling Observe or Protect.':
    'Añade una URL de destino antes de activar Observar o Proteger.',
  'Confirm the production traffic impact before saving.':
    'Confirma el impacto sobre el tráfico de producción antes de guardar.',
  'Only failed or dead-letter deliveries can be retried.':
    'Sólo se pueden reintentar entregas fallidas o en dead letter.',
  'Enter a signing secret before enabling this provider preset.':
    'Introduce un secreto de firma antes de activar este proveedor.',
  'Destination status minimum cannot exceed maximum.':
    'El estado mínimo del destino no puede superar al máximo.',
  'Configure an outgoing alert channel first.': 'Configura primero un canal de alertas salientes.',
  'This evidence link expired, was revoked or does not exist.':
    'Este enlace de evidencia caducó, fue revocado o no existe.',
  'This public status page was disabled or its link was rotated.':
    'Esta página pública fue desactivada o su enlace se rotó.',
  'You can publish up to 10 status pages.': 'Puedes publicar hasta 10 páginas de estado.',
  'Please check the entered information.': 'Revisa la información introducida.',
  'The server hit an unexpected error. Try again in a moment.':
    'El servidor encontró un error inesperado. Inténtalo de nuevo en unos instantes.',
  'The request could not be completed.': 'No se pudo completar la solicitud.',
  'Dismiss error': 'Descartar error',
  Language: 'Idioma',
  'Collapse sidebar': 'Contraer menú lateral',
  'Expand sidebar': 'Expandir menú lateral',
  'API online': 'API en línea',
  'External webhooks ready': 'Webhooks externos listos',
  'Local-only endpoints': 'Endpoints sólo locales',
  'external webhooks ready': 'webhooks externos listos',
  'local-only endpoints': 'endpoints sólo locales',
  'systems nominal': 'sistemas nominales',
  'Light mode': 'Modo claro',
  'Dark mode': 'Modo oscuro',
  Scenarios: 'Escenarios',
  'Initial setup': 'Configuración inicial',
  'Create owner account': 'Crear cuenta propietaria',
  'Start your first trial': 'Inicia tu primera prueba',
  'Build integrations that recover.': 'Crea integraciones que se recuperan.',
  'Integration reliability platform': 'Plataforma de fiabilidad de integraciones',
  'Test failure paths, protect webhook delivery and monitor every dependency from one calm operational workspace.':
    'Prueba rutas de fallo, protege la entrega de webhooks y monitoriza cada dependencia desde un único espacio operativo.',
  'This first account controls your self-hosted installation.':
    'Esta primera cuenta controla tu instalación self-hosted.',
  'Free hosted sandbox. No credit card.': 'Sandbox alojado gratuito. Sin tarjeta de crédito.',
  'Create an account on this installation.': 'Crea una cuenta en esta instalación.',
  'Continue to your webhook labs.': 'Continúa a tus laboratorios de webhooks.',
  'Please wait…': 'Espera…',
  'New to HookTrials?': '¿Eres nuevo en HookTrials?',
  'A synthetic event is delivered to your private URL.':
    'Se entrega un evento sintético a tu URL privada.',
  'The Control Center combines active routes, monitor health, incidents, dead letters and recent recoveries. Start here when you need to know what needs attention.':
    'El Centro de control combina rutas activas, salud de monitores, incidentes, dead letters y recuperaciones recientes. Empieza aquí para saber qué requiere atención.',
  'Production Readiness turns configuration and recorded evidence into one transparent checklist.':
    'La Preparación para producción convierte la configuración y la evidencia registrada en una lista transparente.',
  'Every route starts in Trial. Copy its private ingestion URL, choose a deterministic scenario and only move to Observe or Protect when a destination is ready.':
    'Cada ruta empieza en Prueba. Copia su URL privada, elige un escenario determinista y pasa a Observar o Proteger sólo cuando el destino esté listo.',
  'Trial returns controlled failures. Observe forwards once. Protect persists first and retries safely.':
    'Prueba devuelve fallos controlados. Observar reenvía una vez. Proteger persiste primero y reintenta con seguridad.',
  'Use built-in recipes or create an exact sequence of status codes, delays, headers and response bodies. Repeating the same test produces the same evidence.':
    'Usa recetas incluidas o crea una secuencia exacta de estados, retrasos, headers y cuerpos. Repetir la misma prueba produce la misma evidencia.',
  'The sender performs the retry; HookTrials correlates every attempt using the same event ID.':
    'El emisor realiza el reintento; HookTrials correlaciona cada intento con el mismo ID de evento.',
  'Active checks track availability, latency and contracts. Degradation opens an incident; recovery closes it and preserves the measured history.':
    'Las comprobaciones activas miden disponibilidad, latencia y contratos. La degradación abre un incidente y la recuperación lo cierra conservando el historial.',
  'Every score deduction links to concrete check or incident evidence—never a hidden grade.':
    'Cada deducción enlaza a una comprobación o incidente concreto, nunca a una nota oculta.',
  'Triage incidents, retry or replay dead letters and audit outgoing notifications without searching across separate tools.':
    'Clasifica incidentes, reintenta o reproduce dead letters y audita notificaciones sin buscar en herramientas separadas.',
  'Manual recovery always requires confirmation and records who requested it.':
    'La recuperación manual siempre requiere confirmación y registra quién la solicitó.',
  'Demo Lab creates isolated synthetic resources across Trial, Observe, Protect, Monitor, Operations and Evidence. It never replaces your real resources.':
    'Demo Lab crea recursos sintéticos aislados en Prueba, Observar, Proteger, Monitorización, Operaciones y Evidencia. Nunca sustituye tus recursos reales.',
  'Use it to learn, then reset only its user-owned workspace when you are finished.':
    'Úsalo para aprender y después restablece únicamente su espacio propiedad del usuario.',
  'Docs explains what each module does, when to use it, the exact workflow and what to check when a result is unexpected.':
    'La documentación explica qué hace cada módulo, cuándo usarlo, el flujo exacto y qué revisar ante un resultado inesperado.',
  'You can reopen this tour or Docs at any time from the sidebar.':
    'Puedes volver a abrir este tour o la documentación desde la barra lateral.',
  'Choose a deterministic response sequence, then point your webhook provider at the generated URL.':
    'Elige una secuencia de respuesta determinista y conecta tu proveedor webhook a la URL generada.',
  'Endpoint name': 'Nombre del endpoint',
  'Creating…': 'Creando…',
  'Hosted limit reached — delete an endpoint to create a new one.':
    'Límite de alojamiento alcanzado: elimina un endpoint para crear otro.',
  LISTENING: 'ESCUCHANDO',
  PAUSED: 'PAUSADO',
  'Create your first endpoint': 'Crea tu primer endpoint',
  'Manage endpoints': 'Gestionar endpoints',
  'Loading scenarios': 'Cargando escenarios',
  'Model the exact response sequence your webhook sender must survive.':
    'Modela la secuencia exacta de respuestas que tu emisor webhook debe superar.',
  'New scenario': 'Nuevo escenario',
  'New recipe': 'Nueva receta',
  'Edit recipe': 'Editar receta',
  'Reference recipe': 'Receta de referencia',
  'BUILT-IN': 'INCLUIDO',
  CUSTOM: 'PERSONALIZADO',
  STEPS: 'PASOS',
  'Built-ins are protected. Duplicate this recipe to customize it safely.':
    'Las recetas incluidas están protegidas. Duplícala para personalizarla de forma segura.',
  'Duplicate to edit': 'Duplicar para editar',
  'Built-in copied. Give it a name and customize the sequence.':
    'Receta incluida copiada. Ponle un nombre y personaliza la secuencia.',
  'Scenario name': 'Nombre del escenario',
  '+ Add step': '+ Añadir paso',
  'HTTP status': 'Estado HTTP',
  'Delay (ms)': 'Retraso (ms)',
  'Response headers (JSON)': 'Headers de respuesta (JSON)',
  'Response body (optional)': 'Cuerpo de respuesta (opcional)',
  '↑ Earlier': '↑ Antes',
  '↓ Later': '↓ Después',
  Remove: 'Eliminar',
  'Later retries keep receiving the final step. Disabled means HookTrials returns 410.':
    'Los reintentos posteriores siguen recibiendo el último paso. Desactivado significa que HookTrials devuelve 410.',
  'Create scenario': 'Crear escenario',
  'Custom scenario created.': 'Escenario personalizado creado.',
  'Scenario updated.': 'Escenario actualizado.',
  'Triage incidents, recover dead letters and verify alert delivery from one queue.':
    'Clasifica incidentes, recupera dead letters y verifica alertas desde una única cola.',
  'Refresh evidence': 'Actualizar evidencia',
  'Recovered 24h': 'Recuperados 24 h',
  'Show resolved': 'Mostrar resueltos',
  'Open incidents': 'Incidentes abiertos',
  'Open journey': 'Abrir recorrido',
  Retry: 'Reintentar',
  Replay: 'Reproducir',
  'Confirm retry': 'Confirmar reintento',
  'Confirm replay': 'Confirmar reproducción',
  'Retry continues recovery from this dead-letter delivery and records your user ID, source delivery and request time.':
    'Reintentar continúa la recuperación desde esta dead letter y registra tu usuario, entrega de origen y hora.',
  'Replay creates a clearly labelled new delivery and records your user ID, source delivery and request time.':
    'Reproducir crea una entrega nueva claramente etiquetada y registra tu usuario, origen y hora.',
  'One click fills every HookTrials module with a realistic, synthetic reliability workspace.':
    'Un clic llena todos los módulos de HookTrials con un espacio sintético y realista.',
  'Ready to prove it': 'Listo para demostrarlo',
  'Run full demo': 'Ejecutar demo completa',
  'Running real checks…': 'Ejecutando comprobaciones reales…',
  'Running reliability journey…': 'Ejecutando recorrido de fiabilidad…',
  'Checking demo workspace…': 'Comprobando espacio demo…',
  'Journey complete': 'Recorrido completado',
  'Journey verified': 'Recorrido verificado',
  'Reset demo workspace': 'Restablecer espacio demo',
  'Clean only this demo run': 'Limpiar sólo esta demo',
  'Cleaning…': 'Limpiando…',
  'The lab creates two endpoints, one custom scenario, four monitored integrations, a recoverable dead letter, incident and alert evidence, plus one expiring report. Cleanup matches the private run ID and your account before removing anything.':
    'El laboratorio crea dos endpoints, un escenario, cuatro integraciones monitorizadas, una dead letter recuperable, evidencias de incidente y alerta y un informe temporal. La limpieza valida el ID privado y tu cuenta.',
  'Your browser can be closed safely. HookTrials remembers the private run and keeps cleanup scoped to your account.':
    'Puedes cerrar el navegador. HookTrials recuerda la ejecución privada y limita la limpieza a tu cuenta.',
  'Inspect timelines': 'Inspeccionar cronologías',
  'Open redacted evidence': 'Abrir evidencia redactada',
  'Overview & Readiness': 'Resumen y preparación',
  'Endpoints & route modes': 'Endpoints y modos de ruta',
  'Security & data handling': 'Seguridad y tratamiento de datos',
  'Search product documentation': 'Buscar en la documentación',
  'What every module does, when to use it and how to verify the result.':
    'Qué hace cada módulo, cuándo usarlo y cómo verificar el resultado.',
  'No guide matches “': 'Ninguna guía coincide con «',
  'Attempt comparison': 'Comparación de intentos',
  Response: 'Respuesta',
  Delay: 'Retraso',
  Payload: 'Payload',
  Signal: 'Señal',
  'First attempt': 'Primer intento',
  'Compare attempt 01 →': 'Comparar intento 01 →',
  'Webhook journey': 'Recorrido del webhook',
  Received: 'Recibido',
  Responded: 'Respondido',
  Failed: 'Fallido',
  Passed: 'Superado',
  'Route accepted the inbound delivery': 'La ruta aceptó la entrega entrante',
  'Duplicate correlated to the existing event; no second downstream delivery created':
    'Duplicado correlacionado con el evento existente; no se creó una segunda entrega',
  'Retry from dead-letter': 'Reintentar desde dead letter',
  'Replay event': 'Reproducir evento',
  'Sensitive headers are redacted before reaching the browser.':
    'Los headers sensibles se redactan antes de llegar al navegador.',
  'Create 24h share link': 'Crear enlace de 24 h',
  'Create a public evidence link?': '¿Crear un enlace público de evidencia?',
  'This requeues the original protected event and starts a fresh bounded retry cycle. Audit metadata records who requested it.':
    'Esto vuelve a encolar el evento protegido e inicia un nuevo ciclo acotado. La auditoría registra quién lo solicitó.',
  'This sends the original encrypted payload to the current destination again. The action is explicitly labelled REPLAY and audit metadata is recorded.':
    'Esto vuelve a enviar el payload cifrado al destino actual. La acción se etiqueta como REPLAY y queda auditada.',
  'Retry delivery': 'Reintentar entrega',
  'Payloads, headers, secrets, credentials and destination URLs are intentionally excluded.':
    'Los payloads, headers, secretos, credenciales y URLs de destino se excluyen intencionadamente.',
  'Alert URL': 'URL de alerta',
  'Channel active': 'Canal activo',
  'Allow explicit private CIDRs': 'Permitir CIDR privados explícitos',
  'Allowed private CIDRs for this alert channel': 'CIDR privados permitidos para este canal',
  'Headers (optional, write-only JSON)': 'Headers (JSON opcional de sólo escritura)',
  'Save channel': 'Guardar canal',
  'Update channel': 'Actualizar canal',
  'Send test alert': 'Enviar alerta de prueba',
  'Sending…': 'Enviando…',
  'Not configured': 'No configurado',
  'HookTrials sends a redacted JSON notification when an incident opens or recovers. This channel is separate from managed webhook destinations.':
    'HookTrials envía una notificación JSON redactada cuando un incidente abre o se recupera. Este canal es independiente de los destinos webhook.',
  'Destination URL': 'URL de destino',
  'Destination timeout (ms)': 'Tiempo límite del destino (ms)',
  'Maximum attempts': 'Máximo de intentos',
  'Initial retry delay (ms)': 'Retraso inicial de reintento (ms)',
  'Maximum retry delay (ms)': 'Retraso máximo de reintento (ms)',
  'Destination-only headers (optional JSON)': 'Headers sólo para el destino (JSON opcional)',
  'Healthy destination status from': 'Estado saludable del destino desde',
  'Healthy destination status to': 'Estado saludable del destino hasta',
  'Provider signature preset': 'Preajuste de firma del proveedor',
  'Signing secret': 'Secreto de firma',
  'Stripe timestamp tolerance (seconds)': 'Tolerancia temporal de Stripe (segundos)',
  'Expected inbound method': 'Método entrante esperado',
  'Required headers (optional JSON)': 'Headers requeridos (JSON opcional)',
  'Required JSON paths (optional JSON)': 'Rutas JSON requeridas (JSON opcional)',
  'An empty expected value requires presence only. Values are encrypted and write-only.':
    'Un valor esperado vacío sólo exige presencia. Los valores están cifrados y son de sólo escritura.',
  'Remove the current encrypted contract': 'Eliminar el contrato cifrado actual',
  'Allow this route to reach explicit private CIDRs':
    'Permitir que esta ruta alcance CIDR privados explícitos',
  'Allowed private CIDRs for this route': 'CIDR privados permitidos para esta ruta',
  'I understand that production provider traffic will be forwarded through HookTrials and its response will come from my destination.':
    'Entiendo que el tráfico del proveedor en producción pasará por HookTrials y la respuesta vendrá de mi destino.',
  'Save route control': 'Guardar control de ruta',
  'Route configuration saved.': 'Configuración de ruta guardada.',
  'Stored encrypted. Query values and credentials are never returned to the browser.':
    'Se guarda cifrado. Los valores de query y credenciales nunca vuelven al navegador.',
  'Write-only. These override matching provider headers.':
    'Sólo escritura. Sustituyen los headers coincidentes del proveedor.',
  'Contract active': 'Contrato activo',
  'No contract': 'Sin contrato',
  'Secret encrypted': 'Secreto cifrado',
  'No signing secret': 'Sin secreto de firma',
  'Public status enabled': 'Estado público activado',
  'Publishes the integration name, monitored host, health metrics, recent checks and incident summaries. Authentication headers and response bodies are never included.':
    'Publica nombre de integración, host, métricas, comprobaciones e incidentes. Nunca incluye headers de autenticación ni cuerpos.',
  'Rotate public link': 'Rotar enlace público',
  'Create public status': 'Crear estado público',
  Disable: 'Desactivar',
  'Open →': 'Abrir →',
  'Working…': 'Procesando…',
  'Auto-refreshes every 10s': 'Se actualiza cada 10 s',
  'Network check': 'Comprobación de red',
  'Contract passed': 'Contrato superado',
  'Host reachable': 'Host accesible',
  'Latest incident recovered': 'Último incidente recuperado',
  'No deductions': 'Sin deducciones',
  'auth configured': 'autenticación configurada',
  'No active incident. Latest evidence is within the configured reliability boundaries.':
    'No hay incidentes activos. La última evidencia está dentro de los límites configurados.',
  'Create a Trial route or Monitor resource to establish your first reliability baseline.':
    'Crea una ruta de Prueba o un monitor para establecer tu primera base de fiabilidad.',
  'Repeat the recovery trial after meaningful integration changes.':
    'Repite la prueba de recuperación tras cambios relevantes en la integración.',
  'Understand current risk and the next highest-impact action.':
    'Comprende el riesgo actual y la siguiente acción de mayor impacto.',
  'Overview combines route state, active monitoring, incidents, recovery evidence and Production Readiness for the selected endpoint.':
    'Resumen combina el estado de rutas, monitorización activa, incidentes, evidencias de recuperación y preparación del endpoint seleccionado.',
  'Choose the endpoint from the selector at the top of the page.':
    'Elige el endpoint en el selector de la parte superior.',
  'Read the Control Center for cross-product health and operational work.':
    'Consulta el Centro de control para ver la salud global y el trabajo operativo.',
  'Use Production Readiness to find the first unproven reliability control.':
    'Usa Preparación para producción para localizar el primer control sin demostrar.',
  'Open a retry timeline to inspect Reliability Replay and individual attempts.':
    'Abre una cronología de reintentos para revisar el Replay de fiabilidad y cada intento.',
  'You leave with an evidence-backed next action, not a generic score.':
    'Obtienes una siguiente acción basada en evidencias, no una puntuación genérica.',
  'A new endpoint has little evidence until it receives traffic.':
    'Un endpoint nuevo tiene pocas evidencias hasta que recibe tráfico.',
  'A local-only self-hosted URL cannot be reached by a cloud provider; configure HTTPS first.':
    'Un proveedor cloud no puede alcanzar una URL local self-hosted; configura HTTPS primero.',
  'Receive, observe or protect webhook traffic with one stable URL.':
    'Recibe, observa o protege tráfico webhook con una única URL estable.',
  'An endpoint is the private ingestion URL used by a provider. Its route mode controls whether HookTrials simulates, forwards or durably delivers the request.':
    'Un endpoint es la URL privada usada por un proveedor. Su modo controla si HookTrials simula, reenvía o entrega la solicitud de forma duradera.',
  'Create an endpoint from a template or choose a scenario manually.':
    'Crea un endpoint desde una plantilla o elige un escenario manualmente.',
  'Copy the ingestion URL and send only synthetic data while testing.':
    'Copia la URL de ingesta y envía sólo datos sintéticos durante las pruebas.',
  'Use Trial for deterministic responses and retry verification.':
    'Usa Prueba para respuestas deterministas y verificar reintentos.',
  'Configure a destination before selecting Observe or Protect.':
    'Configura un destino antes de seleccionar Observar o Proteger.',
  'Add a contract and GitHub or Stripe signature verification where appropriate.':
    'Añade un contrato y verificación de firma GitHub o Stripe cuando corresponda.',
  'The same endpoint can mature from a safe trial into an observable or protected route.':
    'El mismo endpoint puede evolucionar de una prueba segura a una ruta observable o protegida.',
  '401 means the configured provider signature did not verify.':
    '401 significa que la firma del proveedor no se verificó.',
  '422 means the inbound method, headers or JSON contract did not match.':
    '422 significa que el método, headers o contrato JSON entrante no coincidieron.',
  'Protect returns 202 because delivery continues asynchronously.':
    'Proteger devuelve 202 porque la entrega continúa de forma asíncrona.',
  'Create exact, repeatable failure sequences.': 'Crea secuencias de fallo exactas y repetibles.',
  'A scenario defines the response HookTrials returns for each correlated attempt: status, delay, headers and optional body.':
    'Un escenario define la respuesta de HookTrials para cada intento correlacionado: estado, retraso, headers y cuerpo opcional.',
  'Copy a built-in scenario or create a new recipe.':
    'Copia un escenario incluido o crea una receta nueva.',
  'Add and reorder steps for the expected retry sequence.':
    'Añade y reordena pasos para la secuencia de reintentos esperada.',
  'Use Retry-After on 429 or 503 responses when you want to test compliance.':
    'Usa Retry-After en respuestas 429 o 503 para probar su cumplimiento.',
  'Save the scenario, then assign it to a Trial endpoint.':
    'Guarda el escenario y asígnalo a un endpoint de Prueba.',
  'Every run is deterministic, making regressions and CI evidence reproducible.':
    'Cada ejecución es determinista, haciendo reproducibles las regresiones y evidencias de CI.',
  'Reuse the same payload id to correlate attempts into one timeline.':
    'Reutiliza el mismo ID de payload para correlacionar intentos en una cronología.',
  'A built-in scenario is read-only; copy it before editing.':
    'Un escenario incluido es de sólo lectura; cópialo antes de editar.',
  'Measure availability, latency, contracts and incident recovery.':
    'Mide disponibilidad, latencia, contratos y recuperación de incidentes.',
  'Monitors run active HTTP checks against an API, route or webhook destination and retain evidence for explainable health scores.':
    'Los monitores ejecutan comprobaciones HTTP o ICMP y conservan evidencias para puntuaciones explicables.',
  'Create a monitor with a public URL, or explicitly allow a trusted private network.':
    'Crea un monitor con URL pública o permite explícitamente una red privada de confianza.',
  'Define the expected status and optional response contract.':
    'Define el estado esperado y un contrato de respuesta opcional.',
  'Run it immediately, then leave the schedule active.':
    'Ejecútalo inmediatamente y deja activa la programación.',
  'Inspect availability, p95 latency, recent checks and incident history.':
    'Revisa disponibilidad, latencia p95, comprobaciones e historial de incidentes.',
  'Create a revocable public status page when health should be shared.':
    'Crea una página de estado pública revocable cuando necesites compartir la salud.',
  'Degradation and recovery become measured incidents with a retained history.':
    'La degradación y recuperación se convierten en incidentes medidos con historial.',
  'DNS, private-network and redirect blocks are intentional SSRF protections.':
    'Los bloqueos de DNS, redes privadas y redirecciones son protecciones SSRF intencionadas.',
  'A contract can degrade a monitor even when the HTTP status is 200.':
    'Un contrato puede degradar un monitor aunque el estado HTTP sea 200.',
  'Triage incidents, dead letters and outgoing alerts.':
    'Clasifica incidentes, dead letters y alertas salientes.',
  'Operations is the recovery queue for failures that need an operator decision or a proof that automation recovered correctly.':
    'Operaciones es la cola de recuperación para fallos que requieren una decisión o demostrar que la automatización se recuperó.',
  'Review open incidents and the recorded failure cause.':
    'Revisa incidentes abiertos y la causa registrada.',
  'Inspect unresolved dead letters before choosing Retry or Replay.':
    'Inspecciona dead letters sin resolver antes de Reintentar o Reproducir.',
  'Confirm the action; HookTrials records the requester and source delivery.':
    'Confirma la acción; HookTrials registra solicitante y entrega de origen.',
  'Configure an alert webhook and use the audit log to verify delivery.':
    'Configura un webhook de alertas y usa la auditoría para verificar la entrega.',
  'Recovery actions and notifications remain attributable and auditable.':
    'Las acciones de recuperación y notificaciones permanecen atribuibles y auditables.',
  'Retry continues the same recovery chain; Replay creates a labelled new delivery.':
    'Reintentar continúa la misma cadena; Reproducir crea una entrega nueva etiquetada.',
  'A failed alert never changes the underlying incident state.':
    'Una alerta fallida nunca cambia el estado del incidente subyacente.',
  'Learn every module with isolated synthetic resources.':
    'Aprende cada módulo con recursos sintéticos aislados.',
  'Demo Lab exercises the complete control loop without modifying normal resources or consuming the regular endpoint quota.':
    'Demo Lab ejercita el ciclo completo sin modificar recursos normales ni consumir la cuota habitual.',
  'Run the full demo and keep the page open while eight stages complete.':
    'Ejecuta la demo completa y mantén la página abierta durante sus ocho etapas.',
  'Open Overview, Monitor and Operations to inspect the generated evidence.':
    'Abre Resumen, Monitorización y Operaciones para revisar las evidencias generadas.',
  'Return to Demo Lab when you want to reset all demo-owned runs.':
    'Vuelve a Demo Lab para restablecer todas las ejecuciones demo.',
  'You see a realistic populated product while all data remains synthetic and user-owned.':
    'Ves un producto poblado y realista con datos sintéticos propiedad del usuario.',
  'An existing demo is recovered after reload; reset it before starting another run.':
    'Una demo existente se recupera al recargar; restablécela antes de iniciar otra.',
  'Never use Demo Lab as a substitute for validating a real integration.':
    'No uses Demo Lab como sustituto de validar una integración real.',
  'Know what is stored, exposed and deliberately blocked.':
    'Conoce qué se almacena, expone y bloquea deliberadamente.',
  'HookTrials treats every inbound payload and outbound destination as untrusted. Secrets and bodies have stricter handling than operational metadata.':
    'HookTrials trata cada payload entrante y destino saliente como no confiable. Secretos y cuerpos reciben un tratamiento más estricto.',
  'Use synthetic payloads in Cloud and keep retention short.':
    'Usa payloads sintéticos en Cloud y una retención corta.',
  'Store signing and destination secrets through write-only fields.':
    'Guarda secretos de firma y destino mediante campos de sólo escritura.',
  'Share only redacted evidence or a payload-free public status page.':
    'Comparte sólo evidencia redactada o páginas públicas sin payload.',
  'Review private-network allowances before enabling them.':
    'Revisa los permisos de red privada antes de activarlos.',
  'Testing remains useful without turning the hosted sandbox into a secrets vault.':
    'Las pruebas siguen siendo útiles sin convertir el sandbox en un almacén de secretos.',
  'Destination URLs and secret headers are encrypted and never returned to the browser.':
    'Las URLs de destino y headers secretos se cifran y nunca vuelven al navegador.',
  'Revoking a public link invalidates its opaque token immediately.':
    'Revocar un enlace público invalida inmediatamente su token opaco.',
  test: 'pruebas',
  staging: 'preproducción',
  production: 'producción',
  trial: 'prueba',
  observe: 'observar',
  protect: 'proteger',
  monitor: 'monitor',
  monitors: 'monitores',
  webhook: 'webhook',
  'external api': 'api externa',
  'internal api': 'api interna',
  'http route': 'ruta http',
  'webhook destination': 'destino webhook',
  'icmp host': 'host icmp',
  public: 'pública',
  disabled: 'desactivada',
  retained: 'conservados',
  refreshed: 'actualizada',
  opened: 'abierto',
  open: 'abierto',
  recovered: 'recuperado',
  every: 'cada',
  None: 'Ninguno',
  'no destination': 'sin destino',
  'Monitor summary': 'Resumen de monitorización',
  'evidence deductions': 'deducciones basadas en evidencias',
  'evidence-based deductions': 'deducciones basadas en evidencias',
  'Expected response text was not found': 'No se encontró el texto esperado en la respuesta',
  'Availability below 100%': 'Disponibilidad inferior al 100 %',
  'p95 latency approaches timeout': 'La latencia p95 se acerca al tiempo límite',
  'Response contract failures': 'Fallos del contrato de respuesta',
  'DNS or TLS failures': 'Fallos de DNS o TLS',
  'Open incident': 'Incidente abierto',
  'Destination delivery failures': 'Fallos de entrega al destino',
  'Retries required': 'Reintentos necesarios',
  'Dead-letter deliveries': 'Entregas en dead letter',
  'Invalid or missing signatures': 'Firmas inválidas o ausentes',
  'Inbound contract failures': 'Fallos del contrato entrante',
  'Route is active': 'La ruta está activa',
  'Resume the route before sending provider traffic.':
    'Reanuda la ruta antes de enviar tráfico del proveedor.',
  'Public HTTPS ingestion is reachable': 'La ingesta HTTPS pública es accesible',
  'Configure a public HTTPS domain or reverse proxy.':
    'Configura un dominio HTTPS público o un proxy inverso.',
  'Inbound contract is enforced': 'El contrato entrante se aplica',
  'Define the expected method, headers and payload fields.':
    'Define el método, headers y campos de payload esperados.',
  'Provider signature is verified': 'La firma del proveedor está verificada',
  'Enable the GitHub or Stripe signature preset and add its secret.':
    'Activa el preajuste de firma GitHub o Stripe y añade su secreto.',
  'A destination is configured': 'Hay un destino configurado',
  'Add the backend destination that should receive valid events.':
    'Añade el destino backend que debe recibir los eventos válidos.',
  'Durable protection is enabled': 'La protección duradera está activada',
  'Enable Protect mode to accept first and retry safely.':
    'Activa el modo Proteger para aceptar primero y reintentar con seguridad.',
  'Real or synthetic traffic was observed': 'Se observó tráfico real o sintético',
  'Send a synthetic event or run a deterministic trial.':
    'Envía un evento sintético o ejecuta una prueba determinista.',
  'Recovery was demonstrated': 'La recuperación fue demostrada',
  'Run a failure-to-recovery scenario and inspect its timeline.':
    'Ejecuta un escenario de fallo a recuperación y revisa su cronología.',
  'Evidence report was generated': 'Se generó un informe de evidencias',
  'Complete a trial and wait for its background evidence report.':
    'Completa una prueba y espera a su informe en segundo plano.',
  'No incident is currently open': 'No hay incidentes abiertos actualmente',
  'Resolve the active incident and verify recovery.':
    'Resuelve el incidente activo y verifica la recuperación.',
  'points proven': 'puntos demostrados',
  of: 'de',
  'reliability controls proven.': 'controles de fiabilidad demostrados.',
  starting: 'inicial',
  developing: 'en desarrollo',
  'production ready': 'listo para producción',
  Retention: 'Retención',
  'Real-time': 'Tiempo real',
  'Cloud providers cannot reach this URL. Configure an HTTPS proxy or public domain before using a real integration.':
    'Los proveedores cloud no pueden alcanzar esta URL. Configura un proxy HTTPS o dominio público antes de usar una integración real.',
  'Open setup guide →': 'Abrir guía de configuración →',
  'Destination:': 'Destino:',
  '· URL encrypted': '· URL cifrada',
  'Native signature verification · add your whsec_ secret':
    'Verificación de firma nativa · añade tu secreto whsec_',
  'Native X-Hub-Signature-256 verification': 'Verificación nativa X-Hub-Signature-256',
  'Control Center & Readiness': 'Centro de control y preparación',
  'Control Center combines route state, active monitoring, incidents, recovery evidence and Production Readiness for the selected endpoint.':
    'El Centro de control combina estado de rutas, monitorización activa, incidentes, evidencias de recuperación y preparación para producción del endpoint seleccionado.',
  'Test deterministic failure behaviour in an isolated laboratory.':
    'Prueba un comportamiento de fallo determinista en un laboratorio aislado.',
  'Trial endpoints are isolated receivers for synthetic traffic. They return deterministic scenario responses without forwarding requests to a real backend.':
    'Los endpoints de prueba son receptores aislados para tráfico sintético. Devuelven respuestas deterministas sin reenviar peticiones a un backend real.',
  'Inspect the correlated retry timeline and compare every attempt.':
    'Inspecciona la cronología correlacionada de reintentos y compara cada intento.',
  'Move to Webhook Hub when the integration is ready for Observe or Protect.':
    'Pasa al Concentrador de webhooks cuando la integración esté lista para Observar o Proteger.',
  'Failure behaviour is proven without mixing laboratory traffic with live connections.':
    'El comportamiento ante fallos se demuestra sin mezclar tráfico de laboratorio con conexiones reales.',
  'Reuse the same event identifier so sender retries stay in one timeline.':
    'Reutiliza el mismo identificador de evento para mantener los reintentos del emisor en una cronología.',
  'Real provider traffic belongs in Webhook Hub, not in a Trial endpoint.':
    'El tráfico real de proveedores pertenece al Concentrador de webhooks, no a un endpoint de prueba.',
  'Guided Demo Lab': 'Laboratorio demo guiado',
  'Open Control Center, Monitoring and Operations to inspect the generated evidence.':
    'Abre Centro de control, Monitorización y Operaciones para inspeccionar las evidencias generadas.',
  'Contract starter · HMAC header presence captured':
    'Contrato inicial · presencia del header HMAC capturada',
  'Contract starter · signing headers captured': 'Contrato inicial · headers de firma capturados',
  '(leave blank to keep current)': '(déjalo vacío para conservar el actual)',
  '(leave blank to keep)': '(déjalo vacío para conservar el actual)',
  'Encrypted · unchanged': 'Cifrado · sin cambios',
  'Latest check': 'Última comprobación',
  'Destination recovered. Protected event delivered successfully with no data loss.':
    'Destino recuperado. El evento protegido se entregó correctamente sin pérdida de datos.',
  'mode:': 'modo:',
  'environment:': 'entorno:',
};

export const phrasePatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^(\d+) of (\d+)$/, (m) => `${m[1]} de ${m[2]}`],
  [
    /^(\d+) trial endpoints?( · unlimited)?$/,
    (m) => `${m[1]} endpoint${m[1] === '1' ? '' : 's'} de prueba${m[2] ? ' · ilimitados' : ''}`,
  ],
  [/^every (\d+)m$/, (m) => `cada ${m[1]} min`],
  [
    /^(\d+) monitors? · (public|disabled)$/,
    (m) =>
      `${m[1]} monitor${m[1] === '1' ? '' : 'es'} · ${m[2] === 'public' ? 'pública' : 'desactivada'}`,
  ],
  [/^Latest check (.+)$/, (m) => `Última comprobación ${m[1]}`],
  [/^Opened (.+)$/, (m) => `Abierto ${m[1]}`],
  [/^opened (.+)$/, (m) => `abierto ${m[1]}`],
  [/^recovered (.+)$/, (m) => `recuperado ${m[1]}`],
  [/^(.+ · ht_[^·]+ · )created (.+)$/, (m) => `${m[1]}creado ${m[2]}`],
  [/^(\d+) retained$/, (m) => `${m[1]} conservados`],
  [
    /^(\d+) of (\d+) reliability controls proven\.$/,
    (m) => `${m[1]} de ${m[2]} controles de fiabilidad demostrados.`,
  ],
  [/^(\d+) points proven$/, (m) => `${m[1]} puntos demostrados`],
  [/^(\d+) evidence deductions?$/, (m) => `${m[1]} deducciones basadas en evidencias`],
  [
    /^delivery exhausted (\d+) attempts and entered dead-letter\. No event was lost\.$/,
    (m) => `La entrega agotó ${m[1]} intentos y entró en dead letter. No se perdió ningún evento.`,
  ],
  [
    /^(.+) is down after (\d+) consecutive failed checks\. Cause: (.+)\.$/,
    (m) => `${m[1]} está caído tras ${m[2]} comprobaciones fallidas consecutivas. Causa: ${m[3]}.`,
  ],
  [
    /^destination failed; retry (\d+\/\d+) scheduled in (\d+) ms\. Event is protected\.$/,
    (m) =>
      `El destino falló; reintento ${m[1]} programado en ${m[2]} ms. El evento está protegido.`,
  ],
  [
    /^(.+) receives provider traffic, but its destination delivery failed \((.+)\)\.$/,
    (m) => `${m[1]} recibe tráfico del proveedor, pero su entrega al destino falló (${m[2]}).`,
  ],
  [/^Delete “(.+)”\?$/, (m) => `¿Eliminar «${m[1]}»?`],
  [/^Delete status page “(.+)”\?$/, (m) => `¿Eliminar la página de estado «${m[1]}»?`],
  [
    /^Current target: (.+)\. Leave blank to keep it unchanged\.$/,
    (m) => `Destino actual: ${m[1]}. Déjalo vacío para conservarlo.`,
  ],
  [
    /^(healthy|degraded|down|paused|new)$/i,
    (m) =>
      ({
        healthy: 'saludable',
        degraded: 'degradado',
        down: 'caído',
        paused: 'pausado',
        new: 'nuevo',
      })[m[1]!.toLowerCase()]!,
  ],
];

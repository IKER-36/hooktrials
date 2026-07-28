# Delivery Control Plane

Protect mode separates receiving provider traffic from delivering it to a destination. The
delivery control in Route configuration gives operators a safe stop without losing the inbound
event.

## Pause outbound delivery

Open a protected route in **Webhook Hub**, expand **Route control** and switch **Outbound delivery**
to **Paused safely**. HookTrials continues to:

- accept and encrypt the inbound request;
- preserve its event ID and attempt history;
- create a queued delivery record;
- return an accepted response to the provider.

The worker does not send queued deliveries while the route is paused. New provider retries are
correlated to the same event and do not create a second downstream delivery.

Switch delivery back on to release queued work. The worker scheduler picks up eligible records and
continues the configured retry policy. Use Operations and the event inspector to follow every
delivery state.

## API and safety

The setting is available on the authenticated endpoint update API:

```http
PATCH /v1/endpoints/{endpointId}
Content-Type: application/json

{"deliveryPaused":true}
```

The flag is only effective for Protect routes. Trial and Observe routes remain unchanged. The
setting is stored with the endpoint, survives restarts and never exposes destination credentials.

Pause before changing a destination, investigating a provider incident or replaying a large
recovery queue. Resume only after the destination and retry policy have been checked.

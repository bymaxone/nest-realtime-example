/**
 * @fileoverview The frozen catalogue of application event names.
 * @layer domain
 *
 * These are the only realtime event names the example itself emits. A unit test
 * asserts the set never intersects the library's reserved names, so demos and
 * client listeners stay unambiguous.
 */

/** Every realtime event name the application emits. */
export const APP_EVENT_NAMES = Object.freeze({
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_SHIPPED: 'order.shipped',
  DEPLOYMENT_QUEUED: 'deployment.queued',
  DEPLOYMENT_RUNNING: 'deployment.running',
  DEPLOYMENT_SUCCEEDED: 'deployment.succeeded',
} as const);

/** Union of application event name values. */
export type AppEventName = (typeof APP_EVENT_NAMES)[keyof typeof APP_EVENT_NAMES];

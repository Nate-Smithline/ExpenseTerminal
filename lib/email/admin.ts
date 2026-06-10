/** Internal address for new signups, demo requests, and similar admin alerts. */
export const ADMIN_NOTIFY_EMAIL =
  process.env.SIGNUP_NOTIFY_TO ||
  process.env.REQUEST_DEMO_TO ||
  "expenseterminal@outlook.com";

import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** Crash reporting is opt-in via env — unset locally/CI, real in production once a DSN is provisioned. */
export const isMonitoringConfigured = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };

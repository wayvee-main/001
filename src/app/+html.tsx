import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { ROLES } from '@/lib/tokens';

const serviceWorkerRegistration = `
  if ('serviceWorker' in navigator) {
    var wayveeHadController = Boolean(navigator.serviceWorker.controller);
    var wayveeRefreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!wayveeHadController || wayveeRefreshing) return;
      wayveeRefreshing = true;
      window.location.reload();
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(function (registration) {
          var lastUpdateCheck = 0;
          var checkForUpdate = function () {
            var now = Date.now();
            if (now - lastUpdateCheck < 60000) return;
            lastUpdateCheck = now;
            registration.update().catch(function () {});
          };

          checkForUpdate();
          window.addEventListener('focus', checkForUpdate);
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') checkForUpdate();
          });
        })
        .catch(function (error) {
          console.warn('Wayvee service worker registration failed:', error);
        });
    });
  }
`;

/** Web-only document shell used for every statically rendered route. */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta
          name="description"
          content="The Bay, minus the guesswork. Eat well, catch what's on, and get there fast."
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={ROLES.bg.light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={ROLES.bg.dark} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background-color:${ROLES.bg.light};}@media (prefers-color-scheme: dark){html,body{background-color:${ROLES.bg.dark};}}`,
          }}
        />
        <meta name="apple-mobile-web-app-title" content="Wayvee" />
        {/* Ticketmaster affiliate program (via Impact) — verifies wayvee.app. Impact's
            tool requires a literal `value` attribute, not the standard `content`. */}
        <meta name="impact-site-verification" {...({ value: 'ffb3f194-b4b7-41ea-aea4-f1b8b525b7e5' } as Record<string, string>)} />
        {/* TicketNetwork affiliate program (via Impact) — separate application, separate token. */}
        <meta name="impact-site-verification" {...({ value: 'ba3c1869-316d-4612-969d-9a7f1245f747' } as Record<string, string>)} />
        <title>Wayvee — Oakland city guide</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistration }} />
      </head>
      <body>
        {/* Ticketmaster + TicketNetwork affiliate programs (via Impact), content-
            verification method — kept out of the visible layout but present in every
            route's static HTML, since the app root below is auth-gated and won't
            render for a logged-out crawler. See also the impact-site-verification
            meta tags above. */}
        <p aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          Impact-Site-Verification: ffb3f194-b4b7-41ea-aea4-f1b8b525b7e5
        </p>
        <p aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
          Impact-Site-Verification: ba3c1869-316d-4612-969d-9a7f1245f747
        </p>
        {children}
      </body>
    </html>
  );
}

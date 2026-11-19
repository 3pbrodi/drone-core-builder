# Komponentenladen: unabhängiger öffentlicher Rückfallweg —2026-11-20

Der vorherige VITE_URL-Fix deckte nicht alle Vorschaufehler ab. Die konkrete angemeldete Lovable-Sitzung konnte von hier nicht ausgelesen werden: Editor403, abgeleitete private Vorschau401. Der Screenshot allein belegt keinen bestimmten HTTP-Status. Deshalb wird keine vollständige Live-Lovable-Prüfung behauptet.

Gesichert geprüft: dieselbe öffentliche DroneCores-Schnittstelle liefert ohne Schlüssel15 veröffentlichte Motoren mit121 Feldbelegen, queryVersion1/statusready und Access-Control-Allow-Origin:*; auch andere Kategorien antworten. Fehlerpfade der Website: generische Supabase-Auth-Konfiguration konnte die Kataloganfragen auf einen anderen Dienst umlenken; Fehler der Vorschau-Serverfunktionen hatten keinen Browser-Rückfallweg. Die bisherigen Tests mit gesundem Loopback-Server deckten diesen zweiten Pfad nicht ab.

## Änderung

- Außerhalb isolierter Tests verwendet der Katalog seinen bestehenden öffentlichen DroneCores-Endpunkt. Allgemeine SUPABASE_URL/VITE_SUPABASE_URL sind keine Katalog-Umschaltung. Explizite CATALOGUE_RUNTIME_URL/VITE_CATALOGUE_RUNTIME_URL behalten Vorrang.
- Die vorhandenen Serverabfragen bleiben erhalten. Schlagen sie fehl oder melden unavailable, liest der Browser dieselbe geprüfte öffentliche API direkt: identische Kategorie, Seite, ausgewählte IDs, Provenienz und Kompatibilitätsbelege. Auch die Bestätigung gewählter Produkt-IDs nutzt diesen Rückfallweg. Kein Schreib-/Import-/Freigabe-RPC und keine Umgehung nativer Veröffentlichungsregeln.
- Keine Auth-Cookies, Bearer- oder API-Schlüssel im Browser-Rückfalltransport; CORS-GET mit credentials:omit. Öffentliche Antwort muss die bestehende Queryversion, Produkte, Pagination und Evidenzstruktur liefern. HTTP-/Netzwerk-/Formatfehler bleiben Fehler mit ungefährlichen Hinweisen; kein Wechsel auf Demo- oder ungeprüfte Daten.
- Testisolation bleibt erhalten. Vite transportiert CATALOGUE_LOCAL_ONLY als öffentlichen booleschen String an den Browser; ein lokaler Browser kann keine impliziten Produktionsdaten laden. Erfolgreiches Nachladen beseitigt einen veralteten initialen Fehlerhinweis.

## Verifikation

Sieben gezielte Endpoint-/Fallback-/Isolationsfälle bestanden, ebenso finale Typprüfung und Build des isolierten Feature-Standes. Fehlerantworten/ungültige Versionen bleiben gesperrt. Native Datenbank-/Schemaänderungen:0.

Browserprüfung mit lokal gespiegelten **tatsächlich öffentlich gelesenen15Motoren**, ohne Netzwerkzugriff aus der Test-Website auf Produktion:

1. Unabhängige Auth-Konfiguration und gezielt geblockte echte `/_serverFn/`-API-Anfragen: alle15Produkte laden direkt öffentlich; SKU-Suche, native veröffentlichte ID als Auswahl bestätigt, alle15 beim erneuten mobilen Öffnen vorhanden. Receipt `qa/catalogue-runtime-fallback-20261120.json`.
2. Server-Endpunkt liefert absichtlich503, initiale nichtleere ID-Abfrage scheitert: öffentlicher Browser-Zugriff stellt alle15Produkte und Auswahl wieder her; veralteter initialer Fehlerhinweis verschwindet. Receipt `qa/catalogue-initial-server-failure-20261120.json`.

Der erste Browser-Harness fing versehentlich auch JavaScript-Module ab; der Matcher wurde auf echte `/_serverFn/`-API-Pfade begrenzt. Der erste503-Aufbau mit leerer ID-Liste erzeugte zurecht keinen initialen Fehler; der Test wurde auf eine echte Produkt-ID umgestellt. Diese beiden ungültigen Aufbauten zählen nicht als bestandene Prüfungen. Eine neue Konfigurationstypisierung wurde vor dem abschließenden erfolgreichen Typ-/Buildlauf korrigiert.

## Wiederholung

Unit-Regression: `node --import tsx --test tests/catalogue-public-fallback.test.ts tests/catalogue-preview-endpoint.test.ts`.

`tests/integration/catalogue-public-mirror-fixture.mjs` erwartet als Argument einen zuvor separat lesend erfassten öffentlichen Runtime-Snapshot und spiegelt ihn nur auf127.0.0.1:4389. Dev-Server auf4390 mit CATALOGUE_LOCAL_ONLY=true, VITE_CATALOGUE_RUNTIME_URL=http://127.0.0.1:4389/functions/v1/catalogue-runtime und einer davon unabhängigen lokalen VITE_SUPABASE_URL starten; Server-URL/Secret nicht voraussetzen. Für Test1 CATALOGUE_RUNTIME_URL entfernen; `tests/integration/catalogue-public-fallback-browser.mjs` mit CATALOGUE_TEST_SNAPSHOT und lokalem PLAYWRIGHT_MODULE starten. Er blockiert echte Vorschau-RPCs und sämtlichen externen Browserverkehr. Für Test2 CATALOGUE_RUNTIME_URL=http://127.0.0.1:4389/offline verwenden und initial eine im Snapshot enthaltene Produkt-ID aufrufen.

Keine Produktionsdaten, Schemata, Händlerbeobachtungen oder Bilder geändert; keine Website öffentlich deployt. Feature-Branch gemäß bestehender Nutzeranweisung synchronisieren. Angemeldete Lovable-Vorschau bleibt ohne zugängliche Vorschau-Adresse/Sitzung nicht direkt prüfbar.

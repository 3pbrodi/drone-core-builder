# Konfigurator: kombinierbare Produktfilter — 2026-11-19

Die bestehende Komponentenauswahl bietet eine Preisspanne mit zwei Reglergriffen, Kompatibilitäts- und3D-Schalter, Markenauswahl und passende technische Filter je Kategorie. Preisgrenzen/Marken stammen aus der gesamten geöffneten Kategorie, nicht nur der ersten50Treffer. Die bestehenden paginierten Kategorieabfragen werden vollständig gelesen; danach kombinieren sich lokale Filter/Suche ohne erneute Anfragen. Die Anzeige bleibt in50er-Schritten nachladbar. Veraltete und ausverkaufte Produkte bleiben gemäß bestehender Richtlinie auswählbar.

Kompatibilität verwendet unverändert den gemeinsamen Prüfer und Quellenbelege: bestätigte Konflikte werden ausgeblendet, unbekannte Kompatibilität wird nicht als verifiziert ausgegeben und bleibt sichtbar. Für Propeller sind Blattzahl und Durchmesser verfügbar; Blattzahl wird nur aus expliziten Blade-Angaben der vorhandenen Beschreibung gelesen, nicht aus mehrdeutigen Modell-/SKU-Zahlen geraten. Fehlende/widersprüchliche Angaben bleiben „Not specified“. Andere Kategorien verwenden bereits vorhandene strukturierte Werte, etwa KV, Strombelastbarkeit, Akkukapazität und Protokoll.

Der Nutzer bestätigte „Nur Produkte mit3D-Vorschau filtern“. Aktuell sind keine echten Produkt-3D-Vorschauen registriert; deshalb liefert der eingeschaltete Filter korrekt null Treffer und erläutert dies. Referenzbilder zählen nicht als3D-Modell. Es wurden weder3D-Modelle noch neue Produktbilder erfunden oder eingebunden.

Der Dialog bleibt mobil scrollbar; Suche/Filter/Resultate zeigen Lade-, Fehler-, Leer- und Trefferzustände. Escape schließt, Tab bleibt im Dialog, Fokus kehrt beim Schließen zurück. Filter werden beim Öffnen einer Kategorie zurückgesetzt. Bestehende Auswahl wird vor Übernahme weiterhin serverseitig nach ID nachgeprüft.

## Verifikation

- Typprüfung `node_modules/.bin/tsc --noEmit`: bestanden.
- `CATALOGUE_LOCAL_ONLY=true node --import tsx --test tests/component-product-filters.test.ts`: Filter-/31-Seiten-1501-Produkte-/Abbruch-/Fehlerfälle bestanden. Separater Abgleich der tatsächlich vorhandenen133öffentlichen Snapshotprodukte mit exakten Kategoriepreisgrenzen bestanden; dieser Zusatztest wird ohne den lokalen QA-Snapshot übersprungen.
- `node_modules/.bin/vite build`: bestanden.
- Chromium gegen isolierte Loopback-Fixture: Preisgrenzen, Marke erst auf zweiter Seite, kombinierte Suche/Blattzahl/Marke, Kompatibilität (Konflikt verborgen/unbekannt erhalten),3D ohne falsche Treffer, Rücksetzen,50→60Nachladen, Auswahl und bestehender Rahmen, leere Kategorie,390px ohne horizontalen Überlauf sowie Escape/Fokus geprüft. Receipt: `qa/component-product-filters-browser-20261119.json`, Ansicht: `qa/component-product-filters-mobile-20261119.png`.
- Im ersten Browsertest war nur die unmittelbare Dialogzählung nach asynchroner Auswahl zu früh. Die Auswahl-/Navigationsfortsetzung bestand mit Warten auf den geschlossenen Dialog; keine Anwendungsänderung dafür. Der dauerhafte Test enthält dieses korrekte Warten. Kein wiederholter vollständiger Filter-Testlauf.

## Browserprüfung reproduzieren

`tests/integration/component-product-filters-fixture.mjs` mit Node starten. Website mit `CATALOGUE_LOCAL_ONLY=true`, `CATALOGUE_DATABASE_ENABLED=true`, `CATALOGUE_RUNTIME_URL=http://127.0.0.1:4289/query`, `SUPABASE_URL=http://127.0.0.1:4289`, `SUPABASE_SECRET_KEY=local-fixture`, `VITE_SUPABASE_URL=http://127.0.0.1:4289`, `VITE_SUPABASE_PUBLISHABLE_KEY=local-fixture` auf127.0.0.1:4190 starten. Das sind ausschließlich synthetische lokale Testwerte. Danach `tests/integration/component-product-filters-browser.mjs` mit Node ausführen; `PLAYWRIGHT_MODULE` kann auf ein lokal installiertes Playwright-Modul verweisen, `CHROMIUM_EXECUTABLE` auf Chromium. Browser blockiert externe Anfragen. Kein Produktions-/Stagingzugriff, keine Migration, kein Deployment, Push oder Merge.

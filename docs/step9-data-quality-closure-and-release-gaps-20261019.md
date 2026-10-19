# DroneCores – Nächster Schritt: Datenqualität und Freigabesicherheit, 19.10.2026

**STATUS: technische Datenrecherche und QA-Freigabevorbereitung; KEIN öffentlicher Produktrelease.** Dies ist eine Fortsetzung des kontrollierten Step-8-Audits, aktuell ausschließlich Branch `qa/step9-data-quality-release-20261019`. Production-Projekt `rtwreynffguvqdcogahx` wurde **nur lesend** untersucht.

## Wichtigstes Ergebnis: „modellverifiziert“ bedeutet nicht „Bildrechte geklärt“

Am 19.10.2026 ergab die direkte Abfrage der existierenden Production-Tabellen:

- **25** Katalogprodukte, **24** öffentlich wählbar, **24** öffentliche Laufzeitprodukte, **25** Händlerangebote.
- **25** Datensätze in `catalogue_product_images`, davon **24** auf `verification_status='verified'` und `exact_model_verified=true`.
- **24/24** „verifizierte“ veröffentlichte Fotos **ohne eingetragenen Lizenznamen und ohne Lizenz-URL**. Diese technische Modellzuordnung ist **keine urheberrechtliche Nutzungsfreigabe**. Die URLs zeigen u.a. auf CNHL, iFlight, GEPRC, HQProp, Foxeer, TBS und externe Händler-CDNs. Vollständige **24-Einzelbild-Rechteprüfliste**: `qa/step9-24-production-image-rights-review.json`.
- **1 von 25** Händlerangeboten mit >7 Tage altem `last_checked_at`: Tattu R-Line V5 1550mAh 6S 150C bei La Caméra Embarquée, **46,90 EUR**, geprüft am **28.09.2026**; in DB steht **unverified**, also nicht zu einem aktuell verifizierten Angebot umdeuten. Die übrigen 24 Offer-Zeilen sind weniger als 24 Stunden alt laut Snapshot-Abfrage.
- Die internen Tabellen `catalogue_product_images`, `catalogue_offers`, `catalogue_import_rows` haben RLS und **keine SELECT-Berechtigung** für `anon`/`authenticated`; die ausdrücklich öffentliche Tabelle ist `catalogue_public_runtime_products`.

### Vorbereitete Korrektur (nicht deployed)

1. Die `catalogue-image-refresh`-Edge-Function konnte bisher im `apply`-Modus allein aufgrund abrufbarer Hersteller-`og:image`-/JSON-LD-Daten eine öffentlich angezeigte Produktabbildung auf `verified` setzen, **ohne Lizenzbeleg**. Die neue QA-Version sperrt `apply` mit HTTP **409** und einem klaren Grund. `dry_run` für Quellenrecherche bleibt verfügbar. **Noch nicht in Production deployed.**
2. Neue **nicht angewendete** Migration `supabase/migrations/20261019230000_catalogue_runtime_licensed_images_and_fresh_offers.sql`: ein BEFORE-INSERT/UPDATE-Trigger direkt auf der **öffentlichen Snapshot-Tabelle** schwärzt `image_url`, `image_alt` und `image_source_url`, wenn die entsprechende genaue Bild-URL keinen nichtleeren Lizenznamen und HTTPS-Lizenzbeleg besitzt. Er entfernt bei einem **neuen Snapshot** auch mehr als 24 Stunden alte, fehlende oder zukünftige Preis-/Bestandsbeobachtungen. Diese Lösung ist mit unterschiedlichen `catalogue_runtime_products`-View-Spaltenständen kompatibel, anders als der erste abgewiesene SQL-View-Neuentwurf. Die auslösende Migration führt eine Neuberechnung bestehender Snapshot-Zeilen durch, deshalb **nur nach ausdrücklicher Website-Änderungsfreigabe** anwenden.
3. Wichtige Grenze: Bei ausbleibendem Trigger-/Cron-Refresh kann die 24h-Frist nachträglich verstreichen. Vor einem Production-Rollout ist zusätzlich die Laufzeitprüfung auf frische Angebote bzw. ein geplanter Neuberechnungstakt zu definieren und zu testen.
4. Die lizenzierte neutrale UI-Alternative existiert bereits: `ImageOff` aus `lucide-react`, **ISC** (https://lucide.dev/license). Die jeweiligen Lizenz-/Copyright-Hinweise müssen mitgeführt werden. Kein fremdes Bild wurde heruntergeladen, kopiert oder als kommerziell freigegeben behauptet. Nutzerzustimmung zur Verwendung des neutralen Icons **an Stelle der bisherigen 24 Fotos** fehlt noch.

## Erste acht Quellfamilien mit gezielt verbesserten Nachweisen

`qa/step9-eight-source-backed-handoff.json` dokumentiert **41 einzeln belegte Hersteller-/Händler-Recherchebehauptungen** zu acht Modellfamilien. Diese Quellenbelege sind *inhaltlich unterstützt*, aber noch **nicht als formale menschliche Review-`verified`-Einträge** in Supabase bestätigt.

| Produkt | Belegte Kerndaten | Veröffentlichungsblocker |
| --- | --- | --- |
| CNHL Black Series V2 1300mAh **3S XT60 Einzelakku** | Hersteller SKU `1301303BK`, 1300mAh, **3 Zellen**, XT60; 113g ca. | Rotorama-Variante nicht bis SKU bestätigt, 14,39 EUR zuletzt auslesbar, Lagerstatus weiterhin unklar, Bildrechte/Review |
| HQProp ETHIX P2 Pickle **4 Propeller** | 5,1×2,9×3, 2CW+2CCW, `EthixP2-PK-PC`, GTIN nicht Hersteller-SKU | RCTech 2,99 EUR/in stock zuletzt gemessen, Neuprüfung & manueller Abgleich und Bildrechte |
| TBS Crossfire Nano RX **SE** | Antenne Immortal-T V2, CRSF, 868–915MHz, 3,3–8,4V | Nicht mit normalem Nano RX für 27,90 EUR verwechseln; Händler SE 29,90 EUR zuletzt in stock, Review |
| TBS Lucid **6S 60A 4in1 ESC** | 3–6 **Zellen**, 4×60A, 8-Pin **JST-SH 1.0mm** lt. Herstellerhandbuch Seite 6 (DShot ist Signalprotokoll) | RCTech Detailseite **in stock**, RCTech Kategorienliste für **dieselbe 6S** **ausverkauft**. => **Widersprüchlich, STOP**; 8S nicht austauschen |
| SpeedyBee Bee35 3,5 Zoll Frame | Modellfamilie 3,5 Zoll; Hersteller Spezifikationen 153mm Radstand, 12×12 Motorlochabstand | Bee35 vs Bee35 Pro/LED und O4P-SE-Optionen; Varianten-SKU und EU-Angebot offen |
| SpeedyBee 1404 4600KV Motor | Hersteller Modellname, 1404 und 4600KV | Herstellerseite mischt **V2/V3** sowie **1/4 Stück**; kein eindeutig ausgewähltes Produkt, Befestigungslochbild fehlt |
| HQProp Direct Drive 6x3B **CCW** | 6 Zoll, Steigung 3, 2 Blätter, **ein** CCW | Hersteller kategorisiert als **Airplane Prop**; kein Quad-Set, nicht als MultiRotor-Propeller freigeben |
| Foxeer Mini Standard Razer **1200TVL** | Hersteller-Tabelle: **CVBS Analog**, **4,5–25 V**, 1200TVL, ca. 22×22mm | 4:3/16:9 und 1,8/2,1mm Objektiv auswählbar; SKU `HS1236` nicht als konkrete Auswahl interpretieren, Hersteller „out of stock“, kein geprüftes EU-Angebot |

Relevante Hersteller-/Händlerquellen:
- https://chinahobbyline.com/de/products/cnhl-black-series-1300mah-11-1v-3s-130c-lipo-battery-with-xt60-plug
- https://www.hqprop.com/ethix-p2-pickle-prop-2cw2ccw-poly-carbonate-p0459.html
- https://www.team-blacksheep.com/products/prod:crossfire_nano_se
- https://www.team-blacksheep.com/products/prod:lucid_4in1
- https://www.flyingtech.co.uk/wp-content/uploads/2024/07/tbs-lucid-manual.pdf (Handbuch Seite 6, Pin-/Steckerdiagramm)
- https://www.speedybee.com/speedybee-bee35-3-5-inch-frame/
- https://www.speedybee.com/speedybee-1404-4600kv-motor-bee25-2-5-inch-fpv/
- https://www.hqprop.com/direct-drive-prop-6x3b-ccw-p0267.html
- https://www.foxeer.com/1200tvl-foxeer-mini-standard-razer-fpv-camera-pal-ntsc-switchable-4ms-latency-g-266
- https://www.rctech.de/flugelektronik/regler-esc
- https://www.rctech.de/tbs-lucid-60a-6s-4-in-1-esc

## Importbasis und Verbesserung am Herstellerparser

Aus den unveränderlichen **171 ursprünglichen Quellzeilen** werden **37** ausgewogene Quellfälle über acht Kategorien bearbeitet. Frühere Fälle: **4** deutlich falsch kategorisierte Zubehörteile (2 Akku-Haltepads, 1 Ersatz-Motorlager-Set, 1 einzelner Frame-Arm) ausgeschlossen; **33** potenzielle komplette Komponenten, **31** Quelldatensätze mit fehlenden Pflichtfeldern. Bereits in einer isolierten Supabase-Instanz nach **24 Migrationen** mit **37/37 `needs_review`**, 0 veröffentlichten Produkten, 0 Angeboten und 0 Fotos getestet: https://github.com/3pbrodi/drone-core-builder/actions/runs/39311228978.

Der neue `src/lib/catalogue-source-title.ts` ignoriert generische `SHOP`-Überschriften und wählt relevante Produkt-`h1`-Überschriften anhand unterscheidbarer Modell-/Variantenmarker. Der unabhängige Abruf der 37 echten Herstellerseiten lieferte **36/37 plausible Modellfamilien-Titelübereinstimmungen** gegenüber **13/37 zuvor**. Der verbleibende Foxeer-Fall #72 trägt einen kürzeren Hersteller-Titel als der Langtitel aus dem Import, obwohl die offizielle technische Tabelle reale Daten liefert. Ein plausibler Titel bleibt ausdrücklich **nur eine Research-/Reviewer-Hilfe**, keine eigenständige Produktverifikation.

`src/lib/catalogue-evidence-reconciliation.ts` sperrt bereits im QA-Test:
- falsche Hersteller-/Händler-SKU oder GTIN;
- falsche Paketgröße oder Variante (3S/6S, Nano/SE, 6S/8S, V2/V3);
- Preis 0/fehlend, nicht HTTPS, ungesicherte Suchindex-Daten;
- Beobachtungen älter als 24h oder zukünftige Zeitstempel;
- echte **Kategorie-/Detailseiten-Lagerkonflikte**, z. B. Lucid 6S.

**Wichtig:** Diese neuen TypeScript-Freigabeprüfungen sind noch **nicht** in Production eingeführt. Der SQL-Publikationsgate aus dem separaten Schritt 7 ist ebenfalls nur QA-geprüft, nicht deployed.

## Was noch verbindlich erforderlich ist, bevor wir Produkte veröffentlichen

1. **Eigentümerentscheidung für Bildrechte:** Dürfen wir die 24 bisher sichtbaren Fotos ohne nachgewiesene Rechte vorsorglich durch die vorhandenen neutralen Lucide-Icons ersetzen? Ja/Nein. Produktdaten und Händlerlinks bleiben in der Datenbank erhalten. Für echte Fotos benötigen wir schriftliche Nutzungsrechte pro Bild bzw. Rechteinhaber.
2. **Fachliche Datenabnahme:** Unabhängige Bestätigung jeder genauen Variante, der 13 ursprünglichen technischen Pflichtfelder plus zusätzlicher Quellenwerte (z. B. Foxeer CVBS/4,5–25V) und dokumentierte Quellen-/Prüferangaben. Keine `verified`-Flags durch Suche oder Parser allein.
3. **Händlerangebote:** Frischer exakter EU/EUR-Live-Preis und Lagerstatus mit Zeitstempel, Pack-/GTIN-/SKU-Abgleich. Lucid-6S-Konflikt auflösen; CNHL-Stock nachweislich prüfen. Unvollständige Händler bleiben `HOLD`. Die eine alte, unverified Tattu-Angebotszeile nur nach frischer Händlerprüfung aktualisieren.
4. **SQL- und Frontend-Freigabetest:** Ergänzten Release-Gate, Bildrechte-Fallback und Preisfrische in vollständig wegwerfbarer Supabase-/Frontend-Vorschau prüfen. Anschließend separater Production-Migrationsreview inklusive bewusstem optischem Wechsel bei 24 Bildkarten.
5. **Explizite Veröffentlichungsfreigabe:** Danach gezielt 1–3 vollständig abgenommene Produkte veröffentlichen, Runtime-Kategorien/Kompatibilität/Preis/Stock gegen Baseline testen und erst danach neue Chargen aufnehmen.

**Stand:** Qualitätsaudit und technische Schutzmechanismen wesentlich verbessert; es wäre fachlich falsch, die derzeitigen 33 Forschungsmodelle oder die acht nachrecherchierten Familien als vollständig und rechtlich verifiziert bzw. veröffentlichungsreif darzustellen.

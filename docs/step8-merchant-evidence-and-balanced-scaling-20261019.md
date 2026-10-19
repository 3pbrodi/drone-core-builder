# DroneCores – Schritt 8: Echte Produktdaten systematisch skalieren, ohne ungeprüfte Veröffentlichungen

**Stand: 19.10.2026.** Ein ausschließlich vorbereitender QA-Schritt, keine Production-Datenbankänderung, keine Website-Veröffentlichung, kein Merge nach `feature`/`main`. Aufgebaut auf dem bestehenden gestapelten Draft-PR #12.

## Ergebnis A – Vier erste Produkte: präzisere Live-Händlerprüfung

Der neue Quellcode `src/lib/catalogue-merchant-evidence.ts` trennt bei **Rotorama/CNHL** und **RCTech/HQProp** Originalmodell, Händler-Artikelkennung, GTIN und Packungsgröße vom Shop-HTML. Statt über die gesamte Webseite beliebige „Auf Lager“-Wörter und Preise zu kombinieren, liest er Preis und Lagerhinweise aus dem sichtbaren Teil der **exakten** Produktseite und verweigert das Ergebnis bei Unsicherheit. Unter anderem werden falsche 4S-/6S-Akkus, 100C statt 130C, HQProp P3 statt P2, eine Zweier- statt Viererpackung sowie widersprüchliche Lagerangaben explizit abgewiesen. Technische Einheitentests (13 Parser- und 3 kanonische Review-Packet-Tests) bestanden.

### Direkter GitHub-Runner-Abruf, 19.10.2026, ca. 18:57 UTC

| Geprüftes exaktes Produkt | Händler | Angezeigter EUR-Preis | Ausgelesener Bestand | Verifizierter Datenbankeintrag? |
| --- | --- | ---: | --- | --- |
| CNHL Black 1300 mAh **3S 130C XT60 Einzelakku** | Rotorama | **14,39 €** | **unbekannt** | nein |
| HQProp ETHIX P2 Pickle **4er-Pack** | RCTech | **2,99 €** | in stock | nein |
| TBS Crossfire Nano RX **SE** mit Immortal-T | RCTech | **29,90 €** | in stock | nein |
| TBS Lucid 60A **6S** 4-in-1 ESC | RCTech | **59,90 €** | in stock | nein |

Der direkte HTTP-Check lieferte vier HTTP-200-Antworten mit exakt zugeordneten Produktidentitäten. **3/4** Angebote lieferten sowohl Preis als auch Bestand. Der CNHL-Preis konnte verbessert ausgelesen werden, sein Lagerstatus jedoch nicht. Das ist absichtlich kein „in stock“ durch Annahme. Webindex-Seiten listen CNHL teils als lieferbar, aber dieser sekundäre Hinweis ersetzt keine eindeutige frische direkte Beobachtung.

**Zeitkritisch:** Diese Momentaufnahmen dürfen bei der geplanten Publikationsregel nicht älter als 24 Stunden sein. Sie sind keine formale menschliche Quellen-/Produkt-/Variantengenehmigung, wurden weder als `verified` gespeichert noch in die Produktionsdatenbank übertragen.

## Ergebnis B – Vollständig korrekte SQL-Einheiten für die erste Viererfreigabe

`qa/step8-four-canonical-review-packets.json` enthält die vier Hersteller-Identitäten und **13 Pflichtfeld-Nachweise**, mit URLs und der erforderlichen menschlichen Reviewer-Abnahme. Insbesondere:

- Akku: `batteryMah = 1300 mAh`, `voltage = 3` **Zellen**, nicht 11,1 Volt.
- ESC: `minVoltage=3`, `maxVoltage=6` **Zellen**, nicht 11,1 und 22,2 Volt. `escInput = 8-pin JST-SH 1.0mm` nach Herstellerhandbuch; DShot ist kein Stecker.
- HQProp: echte SKU `EthixP2-PK-PC`, getrennt von der 13-stelligen GTIN; exakt vier Propeller.
- TBS Nano: die **SE** mit Immortal-T-Antenne, nicht der in Production vorhandene normale Nano-Empfänger.

Sämtliche Herstellerfelder stehen auf `pending_human_review`. Alle Medienfreigaben, Händlerangebote und Eigentümerfreigaben stehen weiterhin auf `false`. Das JSON ist als menschliches Abnahmeformular für künftige echte `catalogue_spec_evidence` gedacht, **kein Importskript mit automatischer Freigabe**.

## Ergebnis C – 171 Hersteller-Rohzeilen: Wie die Datenbank sinnvoll wächst

Die Datei `tests/integration/step8-plan-next-batches.py` analysiert den **unveränderlichen ursprünglichen Hersteller-Importpilot**, ohne Production, Preisangebote oder Produktbilder zu verändern. Ergebnis:

| Kategorie | Quellzeilen im Pilot | Für nächste Recherche in balancierter Auswahl |
| --- | ---: | ---: |
| Propeller | 122 | 6 |
| Flight Controller | 14 | 6 |
| ESC | 12 | 6 |
| Empfänger | 10 | 6 |
| Motoren | 5 | 5 |
| Rahmen | 3 | 3 |
| Kameras | 3 | 3 |
| Akkus | 2 | 2 |
| **Summe** | **171** | **37** |

Hersteller-Websites nach Domain: **71 HQProp**, **50 Foxeer**, **33 Team BlackSheep**, **17 SpeedyBee**. Diese 171 Einträge sind **Quellzeilen**, nicht 171 verifizierte Produkte; insbesondere 122/171 Propeller bedeuten stark einseitige Quellabdeckung.

Die kommende **37er-Recherchewarteschlange** ist bewusst gleichmäßiger verteilt und mit Herstellername, Quell-URL, Kategorie, fehlenden Pflichtfeldern sowie manuellen Review-Hinweisen versehen. **31/37 Einträge** haben mindestens ein fehlendes technisches Pflichtfeld; nur sechs haben in diesem automatischen Schema-Audit keine solchen Lücken (Identität und EU-Händler sind trotzdem noch **nicht verifiziert**). Es wurde ein identischer normalisierter Hersteller-Modell-Varianten-Fingerprint als möglicher Duplikathinweis erkannt: nur ein Hinweis, keine automatische Produktzusammenführung. Dass der ursprüngliche Import selbst stark von HQProp/Foxeer dominiert wird, zeigt: Für 100–200 ausgewogene Komponenten benötigen wir gezielt zusätzliche offizielle Akku-, Rahmen- und Motorenquellen, nicht noch mehr nahezu gleiche Propeller.

Prüfdatei im GitHub-Actions-Artefakt: `step8-results/balanced-source-triage.json`, zusammen mit `live-eu-offers.json`. Die 37 sind ausschließlich **interne Prüfvorschläge**, `publication_approved=false`, `identity_verified=false`, `offer_verified=false`.

## Vorgehen ab hier (weiterhin mit manueller Freigabe)

1. Die ersten drei zuverlässig auslesbaren Händlerangebote (HQProp, TBS Nano **SE**, TBS Lucid **6S**) mit dem exakt passenden Herstellerdatensatz und einer unabhängigen Prüfung verbinden. CNHL-Akku bei unklarem Lagerstatus zurückhalten; keine falsche „auf Lager“-Kennzeichnung.
2. Für die ersten vier prüfen und unterschreiben: Herstelleridentität/Varianten- und Mengenabweichungen, alle 13 Pflichtfelder und Quelle sowie aktuelle EU-EUR-Lagerangebote. Die Rechte an Produktfotos sind unbestätigt; neutrale `ImageOff`-Symbole nur nach ausdrücklicher Medienpolicy-Abnahme.
3. Erst nach separater Eigentümerentscheidung die Step-7-Freigabemigration (**bislang ausschließlich auf QA-Branch**) kontrolliert zur Installation vorschlagen und nach Prüfung die konkreten Produkte freigeben. Keine automatische Veröffentlichung allein aufgrund eines Parser-Ergebnisses.
4. Nach diesem ersten End-to-End-Nachweis die **37er-Quellliste** durchgehen und echte zusätzliche Herstellerquellen für unterversorgte Kategorien ergänzen. Zuerst Qualität im Bereich 50–100 bestätigter Komponenten, dann 100–200, anschließend skalieren. Zeitabhängige Händlerpreise bleiben vom stabilen Hersteller-Katalog getrennt.
5. Die Website liest ausschließlich freigegebene `catalogue_public_runtime_products`; bei unverifizierten Bildrechten wird kein externes Herstellerfoto kopiert.

## Nachweis

**[Erfolgreiche CI 39306845048](https://github.com/3pbrodi/drone-core-builder/actions/runs/39306845048)**: 16/16 Unit- und Review-Packet-Tests, Deno-Check, Live-HTTP-Überprüfung, originaler 171-Pilot und balancierte QA-Warteschlange. Alle Einträge des Live-/Skalierungsartefakts bleiben unverifiziert.

Die bereits bestehende lokale 24-Migrationen- und Negativ-Publikationsprüfung aus Schritt 7 ist ebenfalls grün: [CI 39299600571](https://github.com/3pbrodi/drone-core-builder/actions/runs/39299600571). Dieser Schritt 8 enthält **keine neue SQL-Migration, keine Production-Schreibzugriffe und keinen Merge**.

**Freigabestatus: technischer Verbesserungs-/Rechercheschritt BESTANDEN; neue Produkte öffentlich veröffentlichen: NEIN.**

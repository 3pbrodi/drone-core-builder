# DroneCores — Schritt 8: 37 echte Herstellerquellen prüfen und isoliert als Prüffälle erfassen

**Ausgeführt: 19. Oktober 2026.** Arbeit ausschließlich auf `qa/step8-37-product-source-audit-20261019`. Kein Production-Import, keine neue Veröffentlichung, keine Datenbankmigration auf dem gehosteten Supabase-Projekt, kein Merge nach `main` oder `feature`.

## Ziel und Ergebnis

Wir bauen die Produktdatenbank ausgehend von **originalen Herstellerquellen** aus, aber erkennen klar den Unterschied zwischen einer gefundenen Quellzeile, einem *vollständigen FPV-Bauteil*, einer belegten Produkteigenschaft und einem **freigegebenen öffentlichen Produkt**. Der bisherige 171er Pilot war stark propellerlastig und enthielt irreführende Zubehör-Kategorisierungen.

**Isolierte GitHub-Tests:** [Run 39310524214](https://github.com/3pbrodi/drone-core-builder/actions/runs/39310524214) erfolgreich. [Erweiterte 37er-Manifesttests](https://github.com/3pbrodi/drone-core-builder/actions/runs/39311228978) prüfen auch die Kategorieausschlüsse.

### Belastbare Zahlen

| Arbeitsschritt | Resultat |
|---|---:|
| Historische Hersteller-Quellzeilen insgesamt | 171 |
| Ausgewogene Quellzeilen der ersten erweiterten Prüfcharge | 37 |
| Hersteller-URLs mit HTTP/HTML-Antwort | 37 |
| Automatisch **plausible Produkttitel-Übereinstimmungen** | 13 |
| Produkt-/Variantenidentitäten, deren Originalseite nur einen unspezifischen Shop-Titel oder eine mehrdeutige Überschrift liefert | 24 |
| Klar falsch kategorisierte Zubehörartikel | 4 |
| Nach Vorsortierung **potenzielle vollständige Komponenten** | **33** |
| Einträge mit fehlenden technischen Pflichtangaben aus dem Altimport | 31 |
| **Formal unabhängig bestätigte neue Produkte** | **0** |
| In Production neu veröffentlichte Produkte | **0** |

**Achtung:** HTTP 200 allein bedeutet **nicht**, dass die genaue Produktvariante bestätigt wurde. Bei TBS antworten manche Produkt-URLs mit einer allgemeinen Überschrift „SHOP“; auch ein plausibel passender Produkttitel reicht nicht aus, um korrekte Variante, Lieferumfang oder technischen Wert als `verified` zu markieren. Deshalb **alle** Identitäts-/Spezifikationsfreigaben vorerst `false`.

### Welche vier Quellzeilen sind kein vollständiger Bauteil?

- **#129** – TBS Battery Anti-slip Pad (3pcs): Akku-Haltepad, **kein Akku**.
- **#148** – TBS Ummagrip Battery Pad: Klebepad, **kein Akku**.
- **#138** – TBS ETHIX Mr Steele V2 NSK Bearings (2pcs): **Ersatzmotorlager**, kein Motor.
- **#161** – SpeedyBee Carbon Fiber Arm for FS225 V2 (1pc): **Ersatzarm**, kein kompletter Frame.

Sie bleiben ausschließlich als gesperrte Recherche-/Qualitätsfehlernachweise erhalten. Der spätere öffentliche Bauteilkatalog darf daraus **keine** `battery`, `motors` oder `frame`-Auswahlprodukte generieren. Es gibt unter den zwei ursprünglich als `battery` eingeordneten Herstellerzeilen daher **0 echte Akku-Modelle**; unser separat recherchierter CNHL-3S-Akku aus Schritt 5 ist ausdrücklich **nicht** automatisch in den alten 171 Quellzeilen enthalten. In der Originalquelle kommen zudem Multi-Komponenten-Bundles vor, die nicht fälschlich als einzelne Empfänger erscheinen dürfen.

### Nach Kategorien

| Kategorie | Geprüfte Quellzeilen | Klar falsche Zubehörzeilen | Potenzielle Komponenten |
| --- | ---: | ---: | ---: |
| Propeller | 6 | 0 | 6 |
| Flight Controller | 6 | 0 | 6 |
| ESC | 6 | 0 | 6 |
| Empfänger | 6 | 0 | 6 |
| Motoren | 5 | 1 | 4 |
| Frames | 3 | 1 | 2 |
| Kameras | 3 | 0 | 3 |
| Akkus | 2 | 2 | **0** |
| **Summe** | **37** | **4** | **33** |

Die „potenziellen Komponenten“ sind nach Modellbezeichnung plausibel, aber weiterhin **nicht** technisch vollständig, nicht als genaues Händlerangebot verifiziert und **nicht** publikationsfähig.

## Was tatsächlich getestet wurde

### 1. Hersteller-Quellprüfung

Der auf offizielle Herstellerdomains beschränkte Deno-Runner rief die 37 Quell-URLs aus `www.hqprop.com`, `www.foxeer.com`, `www.speedybee.com` und `www.team-blacksheep.com` per HTTPS ab, wertete sichtbare Titel-/Modellhinweise aus und schrieb nur **maschinenlesbare Nachweise** (keine fremden HTML-Kopien/Fotos).

Der ursprüngliche TBS-Abruf wurde durch die Shopdarstellung irritiert. Mit einer bewährten, offen erkennbaren Verifier-User-Agent-Kennung waren alle 37 HTTP-Seiten erreichbar; bei 24 bleibt die exakte Modell-/Variantenbestätigung trotzdem aus. Fehler und Modellzweifel werden getrennt von Netzwerkausfällen dokumentiert.

Die dauerhaft im Repository versionierte Prüfliste ist `qa/step8-round-20261019/37-source-evidence-review.json` und enthält pro Zeile Pilot-ID, Hersteller, Modellbezeichnung, Original-Hersteller-URL, Kategorieprüfung, Titel-/Identitätswarnung, fehlende technische Felder und alle noch offenen Freigaben.

### 2. Echter Datenbankweg – aber isoliert

Die zweite CI-Arbeit startete eine **wegwerfbare lokale Supabase-Instanz** mit den **24 Repository-Migrationen**, initialisierte die bestehenden Hersteller-Adapter, und übertrug die 37 Originalquellzeilen aus dem unveränderten Hersteller-Importarchiv als `catalogue_import_rows` mit Status **`needs_review`**. Die vier falsch einsortierten Zubehörzeilen erhielten zusätzlich ihren Ausschlussgrund.

Negativtests bestätigten nach dem Import:

- 37 Zeilen in `catalogue_import_rows`, **alle 37 `needs_review`**.
- Acht vertretene Originalquellkategorien; Originalquellen ausschließlich erlaubte Herstellerdomains.
- **0** neue `catalogue_products`, **0** Händlerangebote, **0** importierte Produktfotos, **0** Eigentümerfreigaben und **0** öffentliche Runtime-Produkte.
- Fehlende Pflichtfelder bleiben offen; ein Titelmatch ist keine Verifikation.
- Die Testdatenbank wurde ohne Backup gestoppt und gelöscht. **Production blieb unberührt.**

Die reproduzierbaren Skripte sind `tests/integration/step8-plan-next-batches.py`, `step8-stage-37-review-only.py`, `step8-assert-37-review-only.sql` und `step8-audit-37-official-pages.ts`.

## Bereits bestehende erste vier sorgfältiger erforschte Produkte

Die CNHL 1300mAh **3S**, HQProp ETHIX P2 Pickle **4er-Pack**, TBS Crossfire Nano RX **SE** und TBS Lucid **6S** sind separat im Step-5/6/7/8-QA-Verlauf dokumentiert. Beim letzten EU-Händler-Direktcheck vom **19. Oktober** lieferte HQProp 2,99 EUR/in stock, Crossfire Nano SE 29,90 EUR/in stock, Lucid ESC 59,90 EUR/in stock und CNHL 14,39 EUR/unklarer Bestand. Diese Momentaufnahmen sind keine Dauerpreise oder formalen Abnahmen; spätestens 24 Stunden später müssen sie vor einer Veröffentlichung neu geprüft werden.

Die Bildrechte bleiben ebenfalls gesperrt. Nur das bereits lizenzierte, neutrale `ImageOff`-UI-Symbol ist als sichere Darstellungsoption vorbereitet, jedoch noch **nicht vom Eigentümer als Freigaberichtlinie angenommen**; kein Drittanbieterfoto wurde übernommen.

## Priorität für den nächsten echten Katalogzuwachs

1. **Zuerst die vier Hersteller-Identitäten und 13 Pflichtfeldbelege unabhängig abnehmen**, Verwechslungen von Varianten/GTIN/Steckern sowie Akku-Zellenzahl beseitigen. Die tatsächliche menschliche Review-/Ownerfreigabe kann durch einen Parser oder CI-Test **nicht vorgetäuscht** werden.
2. Drei bislang technisch auslesbare EU-Angebote (HQProp, TBS Nano SE, TBS Lucid 6S) erneut zeitnah prüfen und mit exaktem Händlerartikel und Packungsgröße einem einzigen freigegebenen Produkt zuordnen; CNHL solange **unbestimmt**, bis der Bestand sicher auslesbar oder unabhängig dokumentiert ist.
3. **Neue tatsächliche Akku-Herstellerquellen** (z. B. CNHL und Tattu) und weitere echte Rahmen/Motoren/Kameras recherchieren, denn der originale 171er Import enthält nur Akku-Zubehör, keine echten Akkuartikel.
4. Die 31 Produkte mit fehlenden technischen Pflichtfeldern bearbeiten; nicht alles massenweise als `verified` markieren. Zubehör und unklare Bundles im Audit belassen, aber **aus dem Konfigurator ausschließen**.
5. Erst nach dokumentierter Bildrichtlinie, vollständigen Hersteller-/EU-Evidence-Nachweisen, erfolgreichem SQL-Freigabegate und **gesonderter Eigentümerzustimmung** konkrete freigegebene Produkte in Production übernehmen.

**Freigabeentscheidung:** Schritt 8 – **Quellenprüfung und isolierter Importtest ausgeführt und technisch erfolgreich**, **0 neue Produkte publikationsbereit**. Unser eigentlicher Langfristmaßstab ist die Zahl korrekt identifizierter, belegter, EU-angebotener und öffentlich freigegebener FPV-Komponenten – nicht die bloße Menge alter Quellzeilen.

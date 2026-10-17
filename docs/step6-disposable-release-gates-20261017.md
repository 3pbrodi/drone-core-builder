# DroneCores — Schritt 6: Freigabegates und erneute isolierte Supabase-Abnahme

**Stand 17.10.2026 · ausschließlich QA-Branch `qa/step6-disposable-release-20261017` · kein Production-Write und keine Website-Freigabe.**

## Fertiggestellt

1. **13 exakte technische Pflichtfeld-Nachweise aus Schritt 5** werden in einer von 23 Repository-Migrationen frisch aufgebauten *disposable* Supabase-Instanz als `pending_review` simuliert; 4 zugehörige Identitätsnachweise ebenso. Die vier Kandidaten sind `candidate` und `selectable=false`. Mindestens vier weitere Importzeilen verbleiben `needs_review`. Die vier ausgewählten Kandidaten behalten ihre offiziellen ursprünglichen Import-IDs.
2. **Fehlerhafte Einheitenzuordnung korrigiert:** Laut SQL-Datenmodell repräsentieren `voltage`, `minVoltage`, `maxVoltage` **Akkuzellenzahlen**, nicht Nominalspannung in Volt. CNHL 3S→3, TBS Lucid 3–6S→3 bzw. 6. Die Verbraucheransicht darf 11,1 V bzw. 22,2 V als getrennte *nominelle Anzeige* verwenden; sie dürfen **nicht** in die kanonischen Felder wandern. Maschineller Schutz in `tests/step6-schema-semantics.test.ts` und `tests/integration/step6-local-review-assert.sql`.
3. **TBS Lucid Steckernachweis:** Für `escInput` gilt Herstellerhandbuch `https://www.team-blacksheep.com/media/files/tbs-lucid-manual.pdf`: `8-pin JST-SH 1.0mm ESC-to-FC cable`. DShot 300/600 ist lediglich das Signalprotokoll. Unbestätigte Produktausführung und Varianten bleiben gesperrt.
4. **Eigene rechtssichere Bildstrategie:** Das bestehende React-Frontend zeigt bei fehlendem/fehlerhaftem `product.image` bereits eine neutrale `ImageOff`-Lucide-Grafik (`src/components/BuildInterface.tsx`). `qa/step6-neutral-image-preview.html` illustriert vier entsprechende QA-Karten **ohne fremde Fotos**. Der zusätzliche reine QA-Promotionsgate `src/lib/catalogue-step6-release-gate.ts` erlaubt erst nach ausdrücklicher Policy-Abnahme einen neutralen Icon-Modus oder nach Dokumentation einer erlaubten Bildlizenz ein Produktfoto. **Dieser zusätzliche Gate ist nicht in Production deployed oder in die SQL-Freigabe integriert**.
5. **Frische Händlerbeobachtung statt Suchcache:** Isolierter GitHub-Runner hat am 17.10.2026 vier offizielle Händler-URLs direkt per HTTP abgerufen; alle HTTP 200 / Modell eindeutig. Die Einzelbeobachtung ist dokumentiert in `qa/step6-live-offer-snapshot-20261017.json` und dem Actions-Artefakt.

## Unmittelbar gemessene Angebote (Snapshot; nicht verifiziert)

| Produkt | Händler | Gelesener Preis | Gelesener Bestand | Status |
|---|---|---:|---|---|
| CNHL Black 1300mAh 3S | Rotorama | nicht eindeutig | unklar | blockiert |
| HQProp Ethix P2 Pickle, 4 Stk. | RCTech | 2,99 EUR | unklar | blockiert |
| TBS Crossfire Nano RX **SE** | RCTech | 29,90 EUR | in stock | **weiterhin human-review-pending** |
| TBS Lucid **6S** 4×60A ESC | RCTech | 59,90 EUR | in stock | **weiterhin human-review-pending** (älterer Kategorie-Cache zeigte Ausverkauf) |

**Wichtig:** Preis/Bestand können innerhalb von Minuten wechseln; CI-Snapshot liefert nur Belege für die eine Abfrage. Daten werden **nicht als `verified` gespeichert**. Vor einer echten Freigabe müssen identische Variante, GTIN/SKU, Lager/Preis und Versandland durch Reviewer bestätigt werden, spätestens wenn der Snapshot älter als 24 Stunden ist. Der ESC-Cache-Widerspruch ist menschlich aufzulösen.

## Automatische Releasesperre

Der Pure-Function-Gate `checkStep6Release` blockiert, sofern **irgendeine** der folgenden Bedingungen nicht erfüllt ist:

- Formale Bestätigung von Hersteller-/Variantenidentität und allen Pflichtfeldwerten durch Reviewer
- Aktuelles (max. 24h), direktes **HTTPS-Produktangebot** in EUR mit eindeutig passendem Modell, Variante und Packgröße, Preis und Bestand
- Keine widersprüchlichen Lager-/Angebotsdaten; `in_stock` zwingend in diesem Pre-Release-Prozess
- Nachgewiesene Lizenz für externe Produktbilder **oder** manuell genehmigte neutrale `ImageOff`-Darstellung
- Separate ausdrückliche Freigabe des Eigentümers zur Veröffentlichung

Die SQL-Publikationsfunktion wird in der isolierten Datenbank für **alle vier Kandidaten tatsächlich aufgerufen und muss jedes Mal fehlschlagen**; der Build prüft außerdem die 4 exakt gefundenen Wiederholungsimporte, 0 öffentlich sichtbare Produkte, 0 Händlerangebote und 0 importierte fremde Bilder.

## Grenzen / nächster Schritt

**Noch nicht abgeschlossen:** Die formale menschliche Abnahme und ein produktives Deployment dieser neuen zusätzlichen Review-Regeln, eine vollständig und aktuell verifizierte Preis-/Bestandsliste (2/4 Angebote derzeit nicht eindeutig), rechtssichere Bildpolicy-Genehmigung und deine separate Veröffentlichungsfreigabe. **Keiner** der vier Kandidaten ist automatisch publishable.

**Proof:** [Erfolgreicher (vorheriger) isolierter vollständiger Lauf](https://github.com/3pbrodi/drone-core-builder/actions/runs/39032727787). [Neuester Lauf inkl. Zellenzahlprüfungen](https://github.com/3pbrodi/drone-core-builder/actions/runs/39032855460).

**Sicherheit:** kein `main`-Merge, keine Produktionstabellen/Website/Edge Functions verändert, keine Secret-Ausgabe, keine Händlerdaten in Production, lokale Postgres-Container per `supabase stop --no-backup` zerstört. Nur GitHub Draft-PR zur Kontrolle.

# DroneCores – Schritt 9: prüfbare Hersteller-, Technik-, EU-Händler- und Bildnachweise

Stand: 2026-10-19. **Die hier implementierte Qualitätssperre ist isolierter QA-Code und nicht bereits eine Production-Freigabe.**

## Ergebnis

Die bisher aus 171 Hersteller-Rohzeilen ausgewählte 37er-Quelle wurde geprüft und als **37 `needs_review`-Importzeilen** erfolgreich in einer vollständig wegwerfbaren Supabase-Instanz getestet. Vier Zeilen sind offensichtlich Zubehör und keine vollständigen FPV-Komponenten (2 Akkupads, 1 Ersatzlager-Set, 1 Rahmenarm). Nur 33 Einträge sind weitere *potenzielle Komponenten*. Bei 31/37 fehlen technische Pflichtdaten aus dem Altimport, und nur 13 Herstellerüberschriften lieferten einen plausiblen Modellfamilien-Titelmatch. Weitere 24 zeigten insbesondere bei TBS keine unterscheidbare Variante. HTTP-200 ist **kein** Herstellernachweis über die exakte Variante.

Die erste Vierercharge hat offizielle Hersteller-Kernangaben und voneinander abgrenzbare Händlerartikel. Die behaupteten **13 Pflichtfeldwerte** stehen in den Quellnachweisen, wurden aber **nicht** von einer unabhängigen Person formell freigegeben. Eine Prüfung von fehlenden oder rechtlich nicht lizenzierten Drittanbieterbildern lässt sich nicht durch einen technischen HTTP-Abruf ersetzen.

## Was dieser Arbeitsschritt tatsächlich verbessert

- **Neuer reiner Prüffunktions-Baustein:** `src/lib/catalogue-evidence-dossier.ts`. Er verlangt für jedes *einzelne* Pflichtfeld: Wert, Einheit, exakte Quelle, konkrete Belegstelle, genau passende Variante, Verifikationsstatus `verified`, Reviewer und Datum. Eine bloß erreichbare Hersteller-URL oder mit dem Titel verwandte Variante genügt nicht.
- **Händlerangebot:** separate exakte Shop-URL, EUR-Preis größer null, bestätigte Lieferung in die EU, eindeutig passende Packung/Variante, `in_stock`, frischer UTC-Abruf (höchstens 24h alt) und Reviewer. Bestandslücken oder widersprüchliche Preise werden nicht angenommen.
- **Bilder:** bestehendes neutrales `ImageOff`-Symbol mit Lucide ISC-Lizenz als vorgeschlagene Alternative. Auf Nutzungsrechte fremder Produktfotos wird **nicht** geschlossen; für echte Fotos sind konkret dokumentierter Rechtegeber bzw. Nachweis, Rechte-URL und Reviewer erforderlich. Für den neutralen Bildmodus fehlt weiterhin die explizite Richtlinienfreigabe.
- **Eigentümerfreigabe:** eine eigene Bedingung, die nicht aus Quellen-Treffer oder HTML übernommen werden kann.
- **Negative Tests:** alle vier historischen Produkte müssen gesperrt bleiben, selbst wenn eine neue Herstellerseite erreichbar oder ein Shop-Angebot zeitweilig lieferbar ist.

## Priorisierung anhand echter Herstellerangaben

1. **TBS Crossfire Nano RX SE**, kein Standard-Nano-RX: Hersteller belegt die Immortal-T-V2-Antenne, CRSF, 868–915 MHz, Eingang 3,3–8,4 V; RCTech exakte SKU `TBS_CROSS_NANO_SE`, GTIN `741587426158`, letzter direkter Stand 29,90 EUR/in stock (19.10.2026). Nicht unabhängig freigegeben; Foto-Lizenz fehlt.
2. **TBS Lucid 6S 60A 4-in-1 ESC**, nicht 8S: Hersteller 3–6S, 4×60A, AM32; für `escInput` muss das offizielle Pinout (`8-pin JST-SH 1.0mm`) im technischen Review signiert werden. RCTech exakte SKU `TBS_LUCID_ESC`, GTIN `703674150797`, zuletzt 59,90 EUR/in stock. Ehemals widersprechende Shop-Cache-Lagerhinweise nicht ungeprüft ignorieren.
3. **HQProp ETHIX P2 Pickle 2CW+2CCW 4er-Pack**: Herstellerbezug, 5,1 Zoll, Hersteller-Modellcode `EthixP2-PK-PC`, andere GTIN `9313448340470`, zuletzt RCTech 2,99 EUR/in stock. Definitive Foto-/Produktabnahme offen.
4. **CNHL Black V2 1300mAh 3S 130C XT60 Einzelakku**: Herstellerlagerkennung `1301303BK`, `batteryMah=1300`, `voltage=3` ist im Datenbankschema eine **Zellenzahl**, nicht 11,1 Volt. Rotorama 14,39 EUR, **Bestand automatisiert nicht widerspruchsfrei bestätigt**; daher nicht veröffentlichen.

Preis-/Bestandsbeobachtungen sind Momentaufnahmen vom **19. Oktober 2026**, keine dauerhaft feststehenden Händlerpreise. RCTech bietet Staffelpreise für manche Artikel an: für einzelne Empfänger nicht versehentlich die 3er-/6er-Mengenrabatte als Einzelpreis interpretieren.

## Ungeklärte Punkte, die nicht durch weitere automatische Importe gelöst werden können

1. **Foto-Nutzungsrechte:** Für die vier fremden Original-Produktfotos liegt keine Genehmigung zur Wiederveröffentlichung auf DroneCores vor. Keine Bilder herunterladen, hotlinken oder als `verified` markieren. Lizenzierter neutraler Platzhalter ist technisch verfügbar, **aber noch nicht ausdrücklich als Produktdarstellung genehmigt**.
2. **Formelle unabhängige Nachweisprüfung:** Der Reviewer muss tatsächlich Produktidentität, exakte Variante, Packmenge und 13 technische Felder mit Originalbelegstelle bestätigen; automatisches Crawlen ersetzt diese Bestätigung nicht.
3. **Echtzeit EU-Angebot:** Direkt vor einer Freigabe müssen EUR-Preis, Bestand, Liefergebiet, passende Einzelartikel-/Packung und Zeitstempel neu überprüft werden. Der CNHL-Shopstatus ist derzeit maschinell unklar.
4. **Eigentümer-Publikationsfreigabe:** Ohne konkrete Zustimmung werden weder Produktionsdaten hinzugefügt noch `selectable` umgestellt.
5. **Integration der bestehenden gestapelten QA-Branches:** PRs #10–#15 liegen aufeinander aufbauend im Entwurfszustand. Die Step-7-SQL-Sperre ist bislang **nicht** in Production und muss vor einer sicheren Veröffentlichung geprüft und kontrolliert integriert werden.
6. **Legacy-Formatierung:** Ein vollständiger `bun run lint` für den gesamten gestapelten QA-Branch meldet viele ältere Prettier-Abweichungen. Dies ist Formatierungsschuld, kein Nachweis dafür, dass die fachliche Beweisführung korrekt oder falsch ist. Der Step-9-Workflow prüft den neuen Code separat sowie den Gesamtbuild. Die Integrationsbereinigung bleibt gesonderte Aufgabe.

## Sichere Skalierung

**Stabiles Herstellerprodukt und exakte Spezifikation** werden getrennt von **zeitlich veränderlichem Händlerangebot** und **Bild-Lizenzbeleg** gespeichert. Automatisch ausgelesene Werte bleiben zunächst `source_observed`. Erst nach source-excerpt- und Reviewer-Signatur werden sie `verified`. Fehlende Hersteller-Quellen aus den Kategorien Akku, Frame und Motor sollen ergänzt werden; 122/171 alte Quellzeilen sind Propeller, zwei vermeintliche Akkus sogar Zubehör.

Ein neu gewonnener Herstellerdatensatz darf bereits als interne `needs_review`-Zeile vorhanden sein. Er zählt nicht als verifiziertes, öffentlich eingebundenes Produkt, bevor die komplette Prüfmatrix und die Production-RLS-/SQL-Gates bestanden sind.

**Derzeitige Release-Entscheidung für neue Produkte: NO-GO.** Vollständige, rechtlich belegbare Foto-Lizenzen und formelle menschliche Datenfreigaben können nicht simuliert werden. Der nächste sichere technische Schritt ist eine echte Quellen- und Shop-Nachweisprüfung je gewähltem Kandidaten samt Freigabe des neutralen Icons; danach isolierte Integrationsmigration und nur nach Eigentümerfreigabe die Produktion-Promotion.

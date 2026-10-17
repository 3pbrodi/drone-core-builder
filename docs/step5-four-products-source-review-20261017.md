# DroneCores — Schritt 5: Hersteller-/Pflichtfeldprüfung für vier Kandidaten

**Prüfdatum: 2026-10-17** · **Arbeit: ausschließlich QA-Dokumentation/Tests, keine Production-Importe, kein Deployment und keine Publikation.**

## Ausgangslage

Die vier bisher nur in der isolierten Supabase-Testumgebung angelegten Kandidaten aus Schritt 4 wurden anhand **offizieller Hersteller-Produktseiten**, eines **TBS-Herstellerhandbuchs** sowie passender **EU-Händlerseiten** neu geprüft. Der lokale Datenbanktest aus Schritt 4 war bereits erfolgreich, die kurzlebige lokale DB ist inzwischen gelöscht. Die aktuell hier geschriebenen Nachweise sind **im Repository versionierte Prüfvorschläge**, nicht als `verified` markierte Production-Supabase-Einträge.

Die Datenbank `catalogue_category_field_requirements` verlangt genau **13 Pflichtfeldtypen** für diese vier Kategorien: Akku 2, Propeller 1, Receiver 6, ESC 4. **Alle 13** sind nun mit konkretem Wert und Quelle erfasst. Werte und Produktidentitäten erfordern vor `verified` noch Reviewer-Unterschrift, aktuelle Händlerdaten und Bildrechtsklärung.

## 1. CNHL Black Series V2.0 1300mAh 3S 130C XT60 — Akku

**Offizielle Quelle:** https://chinahobbyline.com/de/products/cnhl-black-series-1300mah-11-1v-3s-130c-lipo-battery-with-xt60-plug

- Hersteller-Lagernummer **1301303BK**, keine erfundene SKU.
- Genau **3S1P / 11,1 V / 1300 mAh**; Entladung 130C kontinuierlich, XT60, JST-XH Balancer, ungefähr 113g; **ein Akku** pro Packung.
- Distinkt zum vorhandenen und veröffentlichten **6S**-Modell mit SKU `1301306BK`; darf nicht zusammengeführt werden.
- EU-Anbieterhinweis: Rotorama (Tschechien), **14,39 EUR**, zuletzt indiziert „auf Lager“, aber Lagerstatus/Preis müssen unmittelbar vor Publikation live erneut bestätigt werden.
- Herstellerseite enthält unterschiedliche Kombinationen aus Packgröße und Herkunftslager; Preise des **2er-Packs** oder eines anderen Herkunftslagers sind keinesfalls als Preis des EU-Einzelakkus zu verwenden.
- Noch gesperrt: formale Reviewer-Abnahme, tagesaktuelles Einzelakku-Angebot, Bildrechte/konforme bildlose Darstellung, Eigentümerfreigabe.

## 2. HQProp ETHIX P2 Pickle 5,1×2,9×3 — Propeller

**Hersteller:** https://www.hqprop.com/ethix-p2-pickle-prop-2cw2ccw-poly-carbonate-p0459.html

- Modellkennung **EthixP2-PK-PC**; **GTIN 9313448340470 ist keine Hersteller-SKU**. Die GTIN war im ursprünglichen Import irreführend als eindeutige Kennung behandelt worden. RCTech-Artikelnummer und die auf der HQProp-Seite dargestellte Modellkennung passen überein.
- **5,1 Zoll Durchmesser**, 2,9 Zoll Steigung, 3 Blätter, Polycarbonat, 5-mm-Welle, 3,8g je Propeller; **vier Propeller**, nämlich 2× CW und 2× CCW.
- Ursprünglicher Rotorama-Hinweis: **3,69 EUR**, inzwischen ausdrücklich **nicht auf Lager**: https://www.rotorama.de/product/ethix-p2-pickle
- Neue mögliche EU-Angebote: **RCTech Deutschland 2,99 EUR**, exakt dieselbe Händler-SKU und GTIN, laut aktuell indizierter Kategorie lieferbar: https://www.rctech.de/?a=7000&lang=eng · https://www.rctech.de/propeller?availability=1&ed=1. Zusätzlich FPV24 3,99 EUR, exact model https://www.fpv24.com/de/hqprop/hqprop-ethix-p2-pickle-prop-poly-51-zoll-3-blatt-propeller-2cw2ccw (älteres Indiz).
- **Hinweis zu abweichenden Drittanbieterdaten:** FPV24 nennt im Text an einer Stelle inkonsistent „5,1 Zoll (45 mm)“. Für technische Werte bleibt die Herstellerangabe **5,1 Zoll** maßgeblich; keine unplausible Millimeterumrechnung übernehmen.
- Noch gesperrt: frischer RCTech-Einzelartikel-Abruf und manuelle Freigabe, Bildrechte/platzhalterbasierte UI-Freigabe.

## 3. TBS Crossfire Nano RX Special Edition (SE) — Empfänger

**Hersteller:** https://www.team-blacksheep.com/products/prod:crossfire_nano_se

- **SE-Variante** enthält *Immortal-T V2* Antenne; nicht mit bereits veröffentlichtem **normalen Nano RX** oder **Diversity Nano RX** verwechseln.
- Sechs Pflichtfeldbelege aus der offiziellen Produktseite: `receiverProtocol` = TBS Crossfire, `receiverSignalInterface` = CRSF, `receiverFrequencyMinMhz` = 868, `receiverFrequencyMaxMhz` = 915, `receiverMinVoltageV` = 3,3, `receiverMaxVoltageV` = 8,4.
- EU-Anbieter: RCTech **29,90 EUR**, spezifische Händler-SKU **TBS_CROSS_NANO_SE**, GTIN **741587426158**, indizierte Verfügbarkeit lieferbar: https://www.rctech.de/tbs-crossfire-nano-rx-longrange-empfaenger-se.
- Händler-SKU ist keine automatisch bestätigte offizielle TBS-Manufacturer-SKU, deshalb Hersteller-SKU im Datensatz weiterhin leer statt erfinden.
- Noch gesperrt: neue Shop-Prüfung und formale Freigabe/Medienrecht.

## 4. TBS Lucid 6S 60A 4-in-1 ESC

**Hersteller:** https://www.team-blacksheep.com/products/prod:lucid_4in1  
**Offizielles TBS-Handbuch (PDF):** https://www.team-blacksheep.com/media/files/tbs-lucid-manual.pdf  
**Nachgesehene Handbuchkopie (Revision 2024-06-01):** https://www.flyingtech.co.uk/wp-content/uploads/2024/07/tbs-lucid-manual.pdf (S. 6 und 10)

- Originalhersteller spezifiziert **4×60 A Dauerstrom, 70 A Spitze, 3–6S LiPo**, AM32, 34×44 mm.
- Das Handbuchdiagramm kennzeichnet explizit das **8-PIN ESC Cable JST SH 1.0 mm** zwischen ESC und Flugcontroller; das ist das gesuchte `escInput`. DShot 300/600 ist nur das *Signalprotokoll*, **kein Steckertyp**.
- `minVoltage` **11,1 V**, `maxVoltage` **22,2 V** sind **berechnete Nominalspannungen** aus 3S und 6S × 3,7 V. Damit **nicht** maximale Zell-Ladespannung (4,2 V/Zelle) oder tatsächliche Eingangsgrenzen behaupten; die Berechnung ist ausdrücklich als *abnahmebedürftig* markiert.
- RCTech Angebotskennung `TBS_LUCID_ESC`, GTIN 703674150797, **59,90 EUR**. Shop-Fund widersprüchlich: Detailseite meldet „sofort verfügbar“, Kategorienübersicht teilweise „ausverkauft“. Aktueller Lagerstatus ist **UNGEKLÄRT**: https://www.rctech.de/tbs-lucid-60a-6s-4-in-1-esc.
- **Kein Ersatz durch 8S-Variante**, keinen FC+ESC-Stack-Preis als Einzel-ESC-Preis interpretieren.
- Noch gesperrt: widerspruchsfreie Echtzeit-Verfügbarkeit, nominale Spannungskonvention abzeichnen, Bildrechte/Reviewer-Abnahme.

## Übersicht — Produktfreigabe

| Kandidat | Herstelleridentität | Pflichtfelder dokumentiert | EU-Angebotslage | Öffentlich freigabefähig? |
| --- | --- | --- | --- | --- |
| CNHL 3S 1300 | Modell/Stock No eindeutig | 2/2, ungeprüfte Evidence | 14,39 EUR Rotorama, Frische offen | **Nein** |
| HQProp P2 Pickle | SKU und GTIN sauber getrennt | 1/1, ungeprüfte Evidence | RCTech 2,99 EUR indiziert lieferbar; Rotorama ausverkauft | **Nein** |
| TBS Nano RX SE | Offizielles Antennen-Bundle klar | 6/6, ungeprüfte Evidence | RCTech 29,90 EUR, Frische offen | **Nein** |
| TBS Lucid 6S | 6S vs 8S eindeutig | 4/4, teils berechnete Nominalwerte | RCTech 59,90 EUR, widersprüchlicher Bestand | **Nein** |

### Noch erforderlich für Schritt 6 / Freigabe

1. **Automatisierter unmittelbarer Live-Checkout der Händlerbeobachtung** (kein Kauf): exakte URL/SKU/Pack-Match, EUR-Bruttopreis, Lieferland, Bestand und beobachteter Zeitpunkt; Widersprüche sperren den Datensatz. Vorher sind alle angegebenen Preise **Rechercheergebnisse und keine geprüften Production-Angebote**.
2. **Reviewer** kennzeichnet jede Identität und jeden Pflichtfeldbeleg bewusst `verified`; bei abgeleiteten Nominalspannungen das Bedeutungsmodell im Konfigurator prüfen.
3. **Bildrechte**: rechtlich belegbare Hersteller-/Händler-Lizenz oder eine ausdrücklich geprüfte bildlose/selbstgestaltete Platzhalteransicht; Fotos dürfen nicht allein wegen öffentlicher URL übernommen werden.
4. **Ausschließlich isolierter Test** der geänderten Evidence-Stagingdaten, inklusive negativer Veröffentlichungstests und visuellem Konfigurator-Preview. Anschließend separate Nutzerfreigabe vor Production-Promotion.

**Änderungsumfang dieses PRs:** nur `qa/`, `docs/` und ein offline Bun-Test unter `tests/`. **Keine Product-DB-Writes, keine Production-Updates, kein Main-Merge und kein Website-Deployment** durch diese Änderung.

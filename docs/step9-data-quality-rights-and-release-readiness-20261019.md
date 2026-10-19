# DroneCores – Schritt 9: Datenqualität bis zur überprüfbaren Freigabereife

**Datum:** 2026-10-19 · **Status:** Qualitätsprüfung und technische Schutzmaßnahmen im QA-Branch; noch kein Production-Rollout, keine öffentliche Veröffentlichung.

## Grundsatz

Ein HTTP-200-Herstellerlink, zutreffender Produktname oder eine Händlerpreis-Anzeige ist **nicht gleichbedeutend** mit einer vollständig geprüften Produktvariante, korrekten technischen Daten, nachgewiesenen Bildnutzungsrechten oder einem zum Zeitpunkt der Veröffentlichung gültigen EU-Händlerangebot. Jeder Teil hat eine eigene Nachweis- und Freigabestufe.

## 1. Offizielle Herstellerquellen – was verbessert wurde

Die 37 Herstellerseiten aus dem alten Pilot sind weiterhin 37 **Recherchekandidaten**, nicht 37 Produktfreigaben. Die Titelprüfung der TBS-Seiten übersprang früher fälschlich `SHOP` als allgemeine `<h1>`-Überschrift. Der neue produktbezogene H1-/OG-Selektor unter `src/lib/catalogue-source-title.ts` kann echte Modellüberschriften extrahieren und prüft kritische Tokens wie **6S/8S, SE/Standard und Motorgrößen/KV**. Er ignoriert Script-/Style-Markup. Beim letzten vollständigen Quelllauf ergaben sich **36/37 modellnahe Titelhinweise** statt früher 13/37. Dies ist ausdrücklich nur ein **Hinweis für den Reviewer**, keine automatisch gewährte Verifikation.

Aus der alten 37er-Quellliste wurden **4 Zubehörfehlklassifizierungen** ausgeschlossen (zwei Akku-Haltepads, Motorlager und Frame-Ersatzarm). 33 verbleiben als mögliche vollständige Komponenten, davon 31 historische Zeilen mit Pflichtfeldlücken. Besonders wichtig: Die alte 171er-Quelle lieferte **keinen** vollständigen LiPo-Akku. Der echte CNHL-3S-Kandidat wird separat geführt.

## 2. Acht priorisierte Hersteller-Produktgruppen

Das Forschungsdossier `qa/step9-eight-source-backed-handoff.json` enthält **8 Produktfamilien und 41 dokumentierte Datenbehauptungen**, davon die vier bereits bekannten Kandidaten: CNHL 1300mAh 3S, HQProp P2 Pickle, TBS Crossfire Nano RX **SE**, TBS Lucid 6S ESC. Zusätzlich wurden SpeedyBee Bee35 Frame, SpeedyBee 1404 4600KV Motor, HQProp Direct Drive 6x3B CCW und Foxeer Mini Standard Razer FPV-Kamera auf Herstellerquellen und technische Merkmale untersucht.

**Nicht auf Basis des Dossiers freigeben:**

- CNHL-3S: genaue Hersteller-SKU `1301303BK` und Einzelpackung stehen fest, aber Händler-SKU und live belegte Lieferbarkeit fehlen.
- HQProp P2: 5,1 Zoll, 2,9 Pitch, 2CW+2CCW und Trennung Hersteller-SKU `EthixP2-PK-PC` / GTIN `9313448340470`; ein frisches exaktes EUR-Einzelangebot und die Nachprüfung des vierteiligen Sets sind erforderlich.
- Nano RX SE: Herstellerangaben zu CRSF, 868–915 MHz, 3,3–8,4 V und Immortal-T V2 sind dokumentiert. Die **SE-Variante** muss explizit vom bestehenden Standard-Nano-RX unterschieden werden.
- Lucid 6S: 60A pro Kanal, 3–6S, **8-poliges JST-SH-1,0-mm-Kabel** gemäß Herstellerhandbuch. DShot300/600 ist das Signalprotokoll, nicht der Stecker. RCTech-Kategoriekarte und Produktseite melden widersprüchlichen Bestand; **ausdrücklich HOLD**, bis der Händler die Variante/Verfügbarkeit klärt.
- SpeedyBee Bee35: Standard / Pro / LED / O4P-SE nicht ohne ausgewählte genaue Option zusammenführen.
- SpeedyBee 1404 4600KV: V2/V3 und Einzel-/Viererpackungen trennen; Motor-Mount-Pattern für die genaue Variante noch nicht belegt.
- HQProp 6x3B CCW: **einzelner Flugzeug-/Fixed-Wing-Propeller**, keine vierteilige FPV-Quadcopter-Garnitur; für den Multirotor-Konfigurator nicht ohne zusätzliche Eignungsprüfung freigeben.
- Foxeer Razer: CVBS/Analogschnittstelle und 4,5–25 V sind Herstellerangaben; **4:3/16:9 und 1,8-/2,1-mm-Linsenoptionen** benötigen exakte Variantenidentität.

Die 41 Claims sind recherchiert und quellengebunden, aber formal noch **`pending_human_review`**. Der Eigentümer hat weder spezifische Veröffentlichungsanweisungen noch die neutrale Bildpolitik genehmigt. Alle acht bleiben daher `HOLD`.

## 3. Händlerangebote und technische Konflikte

`src/lib/catalogue-evidence-reconciliation.ts` testet, ob eine Händlerseite die genaue SKU, GTIN und Packungsgröße mit einem EUR-Preis, eindeutigem `in_stock` und einem Zeitpunkt innerhalb von 24 Stunden belegt. Eine widersprechende Händler-Kategoriekarte sperrt das Angebot – insbesondere bei TBS Lucid **6S**. Suchmaschinen-Indizes sind keine live geprüften Händlerquellen. Der neue Prüfcode darf **keinen** Bestandsnachweis selbst als vom Menschen freigegeben markieren.

Die Produktseiten-/Händlerpreise sind Momentaufnahmen. Eine Veröffentlichung muss die Preisliste neu abfragen; alte Nachweise dürfen die Auslieferung **nicht** als aktuell bestätigen.

## 4. Kritisches Bildrechteproblem in der bestehenden Produktion

**Lesende Supabase-Prüfung vom 19.10.:**

- 25 Produkte insgesamt, 24 im öffentlichen Konfigurator; 25 Händlerangebote.
- 25 `catalogue_product_images`-Zeilen, 24 davon technisch `verification_status='verified'` und passend zum Modell.
- **Alle 24 technisch verifizierten Bilder haben in der Datenbank weder `license_name` noch `license_url`.** Eine technische Bild-URL-Prüfung ist kein urheberrechtlicher Nutzungsnachweis.
- Ein Händlerangebot für Tattu R-Line V5 1550mAh 6S vom **28.09.2026**, 46,90 EUR und vormals `in_stock`, ist veraltet; diese Beobachtung darf nicht als heutiger Lagerbestand gelten.

Die Image-Refresh-Edge-Funktion konnte bisher im `apply`-Modus öffentlich erreichbare OG-/JSON-LD-Fotos ohne Lizenznachweis als `verified` setzen. In der QA-Version wurde `apply` durch einen **HTTP-409-Fail-Closed** gesperrt; `dry_run` bleibt als Forschungsmodus erhalten. Dies ist noch **nicht produktiv deployed**.

Die **zusätzliche vorgeschlagene SQL-Migration** `20261019230000_catalogue_runtime_licensed_images_and_fresh_offers.sql` setzt am **öffentlichen Snapshot** an: Nur Fotos mit registrierter Lizenz werden ausgeliefert; bei fehlendem Nachweis wird das Bild im öffentlichen Datensatz NULL und die bereits bestehende `ImageOff`-Komponente zeigt ein neutrales Icon. Angebote mit fehlender, zukünftiger oder über 24 Stunden alter Zeitangabe werden bei Neuaufbau des Snapshots nicht als aktuelle Preise gezeigt. Der Trigger ist als **Initialschutz** gedacht; eine Live-Uhrzeit-basierte Aktualisierung braucht zusätzlich einen regelmäßigen Snapshot-Refresh oder dynamische Anzeigeprüfung. **Erst nach ausdrücklicher Freigabe für einen sichtbaren Website-Effekt in Production installieren** – alle bestehenden 24 Fotos hätten dann wegen fehlenden Lizenzrecords neutrale Icons.

Die generische `ImageOff`-Lucide-Grafik steht unter ISC-Lizenz; Copyright-/Lizenzhinweise müssen erhalten bleiben. Ohne Lizenz-/Rechtebeleg keinerlei ungeprüfte Hersteller- oder Händlerfotos herunterladen, hotlinken oder als Nutzungsrecht markieren.

## 5. Technische Prüfungen und verbleibende externe Blocker

- Quellprüfung gegen echte Herstellerseiten, damit weder falsch kategorisierte Zubehörartikel noch verwechselte Varianten importiert werden.
- Hersteller-Pflichtfeld-, Einheiten- und GTIN/SKU-Nachweise werden einzeln protokolliert.
- Preis-/Bestandsreconciliation sperrt widersprüchliche oder veraltete Händlerbelege.
- Bildrechte- und Angebotsschutz wird auf einer **wegwerfbaren lokalen** Supabase-Instanz mit Repository-Migrationen getestet, niemals mit einem direkten Production-Eingriff.
- Der eigentliche Promotion-Vorgang wird weiterhin durch die **vorgeschlagene** Step-7-Eigentümer-/Reviewer-/Bildpolicy-/EU-Angebot-Migration geschützt. Diese ist noch nicht in Production installiert.

**Nicht selbst lösbar ohne Nachweis oder Benutzerentscheidung:** Rechtsverbindliche Bildnutzungslizenz der Rechteinhaber; Freigabe des neutralen Icon-Modus; formale unabhängige Datenabnahme; Eigentümergenehmigung für einen Production-Rollout; exakte aktuelle Händlerverfügbarkeit bei widersprüchlicher Quelle; Variantenwahl bei Optionsartikeln.

## Freigabeentscheidung

**Technische QA-Verarbeitung: weitgehend vorbereitet und getestet.** `verified` im rechtlichen, zeitnahen und fachlichen Sinne bedeutet jedoch: Hersteller/Variante + technische Felder + aktuelle EU-Händlerangebote + Nutzungsrechte/akzeptierter neutraler Bildmodus + Eigentümerfreigabe. **0 der acht Forschungsprodukte dürfen heute automatisch veröffentlicht werden.** Production und deployed Frontend bleiben bis zur expliziten Genehmigung unverändert.

Wir können weitere echte Produkte in isolierte Review-Chargen aufnehmen; das Ziel bleibt der Aufbau einer **großen, aber verlässlichen** Drohnen-Komponentendatenbank, nicht das Hochzählen nicht verifizierter Listen.

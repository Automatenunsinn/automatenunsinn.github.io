Beschrieben in Patent DE10142537A1
https://worldwide.espacenet.com/patent/search/family/007697142/publication/DE10142537A1?q=pn%3DDE10142537A1

Atmel geht an.

Liest per BDM das RAM aus und errechnet die Checksumme.

Wenn DB leer (oder Checksumme falsch?) -> sendet EEPROM Inhalt an CPU per BDM.

Dieser EEPROM Inhalt ist ein Bootloader.

Schreibt diesen an Stelle 0x3c0

CPU startet damit.

Das Programm wartet auf Daten per seriell.

Direkt an den seriell Pins der CPU.

Schreibt die empfangenen Daten nach 0x400

Dieser "Loader" hat seine Base-Adresse bei 0x400

Prüft den Header und wertet diesen aus um den Schlüssel zu bestimmen.

Wartet auch auf Daten per seriell aber macht noch XOR darauf und schreibt diese nach 0x1000.


Laut Patent ist der Key im EEPROM

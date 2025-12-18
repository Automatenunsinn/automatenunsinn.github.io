Atmel geht an.
Macht ??? Checksumme laut Patent
DB leer -> sendet EEPROM Inhalt an CPU per BDM
Schreibt diesen an Stelle 0x3c0
CPU startet mit dem Programm aus EEPROM
Das Programm wartet auf Daten per seriell am DB-Stecker,
Schreibt diese nach 0x400
"Loader" hat seine Base-Adresse bei 0x400
(was ist mit dem header)
Wartet auch auf Daten per seriell aber macht noch XOR darauf und schreibt diese nach 0x1000

Kandidaten Key:
0x2F160759 (aus Loader)
XMBRXMBV@HSFN (aus Loader)
R
J (aus EEPROM)
0xFA (aus EEPROM)
Laut Patent ist der Key im EEPROM
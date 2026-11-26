const descriptions = {
  'atmega.html': 'Tool zum Flashen eines ATmega48 über Arduino as ISP.',
  'bpatcher.html': 'Tool zum Patchen von EPROMs für Bally Wulff Automaten. Behebt den NVRAM Init Fehler und setzt das Datum, um die Uhrprobleme zu beheben.',
  'bw.html': 'Kostenloser Online-Rechner zur Generierung von Freischaltcodes für Bally Wulff Gamestation und Action Star Automaten.',
  'db.html': 'Anleitung zur Reparatur von ADP Datenbanken.',
  'dbwrite.html': 'Tool zum Beschreiben von ADP Datenbanken über WebSerial. Unterstützt verschiedene Modulgrößen und Datumseinstellungen für die Reparatur von Spielautomaten.',
  'game.html': 'Ein einfaches Slot Machine Spiel als Spaßprojekt von Automatenunsinn. Drehe die Walzen und versuche, den Jackpot zu knacken!',
  'index.html': 'Kostenlose Web-Tools für deutsche Spielautomaten (ADP/Merkur, Bally-Wulff). Freischaltcode Generator, Powertool, Zulassungskarten, Datenbank-Tools und mehr.',
  'isp.html': 'Tool zum Beschreiben des Arduino Nano der Automatentreff Programmierstation für die Reparatur von Spielautomaten.',
  'pt.html': 'Kostenloser Online-Rechner für Merkur PowerTool Codes aus dem Abrufcode oder der Volumeseriennummer.',
  'readout.html': 'Tool zum Auslesen von ADP Datenbanken. Hiermit kann man den Inhalt der Datenbank sichern und später mit dem Serial Tool wieder auf die Datenbank laden.',
  'roul.html': 'Rechner für Sm_ausl_Rol Registrierungscodes.',
  'sm.html': 'Anleitung zum Reparieren von Bally Wulff Spielmodulen. Hilfe beim Fehler NVRAM INIT ? der durch eine leere Batterie ausgelöst wird',
  'sound.html': 'Tool zum Beschreiben von ADP Soundkarten über WebSerial.',
  'splitter.html': 'Tool zum Zusammenfügen oder Aufteilen von 16-Bit-ROMs in 8-Bit-ROMs.',
  'st25.html': 'Generator für NSM ST25 Timekeeper-Daten.',
  'teileliste.html': 'Teilekatalog für ADP/Merkur Spielautomaten. Eine hilfreiche Übersicht für die Reparatur und Wartung von Geldspielgeräten.',
  'tk.html': 'Generator für ST M48T18 Datum und Uhrzeit.',
  'vdai.html': 'Tool zum Auslesen von Spielautomaten nach dem VDAI Standard.',
  'zl.html': 'Kostenloser Online-Rechner zur Generierung von Freischaltcodes für ADP/Merkur Spielautomaten (Walzen- und Bildschirmgeräte).',
  'zlk.html': 'Generator und Flasher für Zulassungskarten: ZLK V1 (AT90S1200) und ZLK V2 (ATmega48) für ADP/Merkur Spielautomaten.'
};

module.exports = {
  eleventyComputed: {
    description: (data) => descriptions[data.page.inputPath.split('/').pop()],
    permalink: (data) => {
      const fileName = data.page.inputPath.split('/').pop();
      if (fileName === 'sitemap.xml.njk') return 'sitemap.xml';
      if (fileName === 'robots.txt.njk') return 'robots.txt';
      return fileName;
    }
  }
};

'use strict';
/* Deutsche Texte für Nimbus */
module.exports = {
  // interface
  'ui.private': 'Privat', 'ui.newTab': 'Neuer Tab', 'ui.back': 'Zurück', 'ui.forward': 'Vorwärts', 'ui.reload': 'Neu laden', 'ui.stop': 'Laden abbrechen',
  'ui.home': 'Startseite', 'ui.protection': 'Schutz vor Werbung und Trackern', 'ui.bookmarks': 'Lesezeichen', 'ui.downloads': 'Downloads', 'ui.split': 'Geteilte Ansicht',
  'ui.history': 'Verlauf', 'ui.toggleTabs': 'Tabs seitlich/oben', 'ui.menu': 'Menü', 'ui.siteInfo': 'Informationen zur Website', 'ui.search': 'Suchen',
  'ui.addressPlaceholder': 'Suchen oder Adresse eingeben', 'ui.bookmarkThis': 'Lesezeichen für diese Seite', 'ui.collapseSidebar': 'Seitenleiste ein-/ausklappen',
  'ui.splitSwap': 'Seiten tauschen', 'ui.splitClose': 'Geteilte Ansicht beenden', 'ui.zoomReset': 'Zoom zurücksetzen',
  'sug.searchWith': 'mit {engine} suchen', 'sug.switchToTab': 'Zum Tab wechseln',
  'find.placeholder': 'Auf der Seite suchen', 'find.prev': 'Vorheriger Treffer', 'find.next': 'Nächster Treffer', 'find.close': 'Suche schließen',
  'find.matchCase': 'Groß-/Kleinschreibung', 'find.count': '{i} von {n}', 'find.none': 'Keine Treffer',
  'site.secure': 'Verbindung ist sicher', 'site.insecure': 'Verbindung ist nicht sicher', 'site.notSecure': 'Nicht sicher', 'site.file': 'Lokale Datei',
  'site.secureLong': 'Die Verbindung zu dieser Website ist verschlüsselt.', 'site.insecureLong': 'Daten, die du hier eingibst, können von anderen mitgelesen werden.',
  'site.internal': 'Interne Seite oder lokale Datei.', 'site.permissions': 'Berechtigungen', 'site.clearData': 'Website-Daten löschen', 'site.settings': 'Website-Einstellungen',
  'shield.title': 'Schutz auf {host}', 'shield.titleGeneric': 'Schutz', 'shield.toggle': 'Werbung, Tracker und Drittanbieter-Cookies blockieren',
  'shield.blocked': 'Anfragen auf dieser Seite blockiert', 'shield.onHint': 'Falls die Seite nicht richtig funktioniert, schalte den Schutz hier aus.',
  'shield.offHint': 'Der Schutz ist für diese Website ausgeschaltet.', 'shield.notApplicable': 'Auf dieser Seite gibt es nichts zu blockieren.',
  'shield.disabledGlobally': 'Der Werbeblocker ist in den Einstellungen ausgeschaltet.', 'shield.settings': 'Schutz-Einstellungen',

  // tabs + groups
  'tab.new': 'Neuer Tab rechts', 'tab.newTab': 'Neuer Tab', 'tab.untitled': 'Ohne Titel', 'tab.reload': 'Neu laden', 'tab.duplicate': 'Duplizieren',
  'tab.pin': 'Anheften', 'tab.unpin': 'Loslösen', 'tab.mute': 'Stummschalten', 'tab.unmute': 'Ton einschalten', 'tab.addToGroup': 'Zu Gruppe hinzufügen',
  'tab.newGroup': 'Neue Gruppe', 'tab.removeFromGroup': 'Aus Gruppe entfernen', 'tab.splitWith': 'Geteilte Ansicht mit …', 'tab.moveToNewWindow': 'In neues Fenster verschieben',
  'tab.sleep': 'Tab schlafen legen', 'tab.sleeping': 'schläft (spart Arbeitsspeicher)', 'tab.close': 'Tab schließen', 'tab.closeOthers': 'Andere Tabs schließen',
  'tab.closeRight': 'Tabs rechts schließen', 'tab.reopenClosed': 'Geschlossenen Tab wiederherstellen',
  'group.unnamed': 'Gruppe ohne Namen', 'group.rename': 'Umbenennen …', 'group.color': 'Farbe', 'group.collapse': 'Einklappen', 'group.expand': 'Ausklappen',
  'group.newTab': 'Neuer Tab in Gruppe', 'group.ungroup': 'Gruppe auflösen', 'group.close': 'Gruppe schließen', 'group.name': 'Name der Gruppe',
  'group.namePlaceholder': 'z. B. Recherche', 'group.tabs': '{count} Tabs',
  'color.blue': 'Blau', 'color.red': 'Rot', 'color.yellow': 'Gelb', 'color.green': 'Grün', 'color.pink': 'Pink', 'color.purple': 'Lila', 'color.cyan': 'Türkis', 'color.orange': 'Orange', 'color.grey': 'Grau',

  // context menu
  'ctx.openLinkNewTab': 'Link in neuem Tab öffnen', 'ctx.openLinkNewWindow': 'Link in neuem Fenster öffnen', 'ctx.openLinkPrivate': 'Link in privatem Fenster öffnen',
  'ctx.openLinkSplit': 'Link in geteilter Ansicht öffnen', 'ctx.saveLinkAs': 'Ziel speichern unter …', 'ctx.copyLink': 'Link-Adresse kopieren', 'ctx.copyLinkText': 'Link-Text kopieren',
  'ctx.openImageNewTab': 'Bild in neuem Tab öffnen', 'ctx.saveImageAs': 'Bild speichern unter …', 'ctx.copyImage': 'Bild kopieren', 'ctx.copyImageAddress': 'Bildadresse kopieren',
  'ctx.searchImage': 'Bild mit {engine} suchen', 'ctx.play': 'Abspielen', 'ctx.pause': 'Pause', 'ctx.loop': 'Wiederholen', 'ctx.showControls': 'Steuerelemente anzeigen',
  'ctx.saveVideoAs': 'Video speichern unter …', 'ctx.saveAudioAs': 'Audio speichern unter …', 'ctx.copyMediaAddress': 'Medienadresse kopieren', 'ctx.pip': 'Bild-im-Bild',
  'ctx.undo': 'Rückgängig', 'ctx.redo': 'Wiederholen', 'ctx.cut': 'Ausschneiden', 'ctx.copy': 'Kopieren', 'ctx.paste': 'Einfügen', 'ctx.pastePlain': 'Als reinen Text einfügen',
  'ctx.selectAll': 'Alles auswählen', 'ctx.noSuggestions': 'Keine Vorschläge', 'ctx.addToDictionary': 'Zum Wörterbuch hinzufügen', 'ctx.searchFor': 'Mit {engine} nach „{text}“ suchen',
  'ctx.openAsUrl': 'Als Adresse öffnen', 'ctx.back': 'Zurück', 'ctx.forward': 'Vorwärts', 'ctx.reload': 'Neu laden', 'ctx.savePageAs': 'Seite speichern unter …',
  'ctx.print': 'Drucken …', 'ctx.translate': 'Seite übersetzen', 'ctx.viewSource': 'Seitenquelltext anzeigen', 'ctx.inspect': 'Untersuchen',

  // main menu
  'menu.newTab': 'Neuer Tab', 'menu.newWindow': 'Neues Fenster', 'menu.newPrivateWindow': 'Neues privates Fenster', 'menu.history': 'Verlauf', 'menu.downloads': 'Downloads',
  'menu.bookmarks': 'Lesezeichen', 'menu.bookmarkPage': 'Lesezeichen für diese Seite …', 'menu.manageBookmarks': 'Lesezeichen verwalten', 'menu.showBookmarksBar': 'Lesezeichenleiste immer anzeigen',
  'menu.extensions': 'Erweiterungen', 'menu.zoom': 'Zoom ({zoom} %)', 'menu.zoomIn': 'Vergrößern', 'menu.zoomOut': 'Verkleinern', 'menu.zoomReset': 'Originalgröße',
  'menu.fullscreen': 'Vollbild', 'menu.find': 'Suchen …', 'menu.print': 'Drucken …', 'menu.savePage': 'Seite speichern unter …', 'menu.view': 'Ansicht',
  'menu.splitView': 'Geteilte Ansicht', 'menu.verticalTabs': 'Tabs seitlich anzeigen', 'menu.focusMode': 'Fokus-Modus (Oberfläche ausblenden)', 'menu.theme': 'Farbschema',
  'menu.customize': 'Aussehen anpassen …', 'menu.tools': 'Werkzeuge', 'menu.devtools': 'Entwicklerwerkzeuge', 'menu.viewSource': 'Seitenquelltext', 'menu.translate': 'Seite übersetzen',
  'menu.clearData': 'Browserdaten löschen …', 'menu.taskManager': 'Task-Manager', 'menu.settings': 'Einstellungen', 'menu.about': 'Über Nimbus', 'menu.help': 'Hilfe', 'menu.quit': 'Beenden',
  'theme.system': 'System', 'theme.light': 'Hell', 'theme.dark': 'Dunkel',

  // dialogs
  'dialog.cancel': 'Abbrechen', 'dialog.ok': 'OK', 'dialog.done': 'Fertig', 'dialog.save': 'Speichern', 'dialog.wait': 'Warten', 'dialog.killPage': 'Seite beenden',
  'dialog.unresponsive': '„{title}“ reagiert nicht.', 'dialog.leave': 'Verlassen', 'dialog.stay': 'Bleiben', 'dialog.leavePage': 'Diese Seite verlassen?',
  'dialog.leavePageDetail': 'Vorgenommene Änderungen werden eventuell nicht gespeichert.', 'dialog.closeWindow': 'Fenster schließen',
  'dialog.closeWindowTabs': 'Fenster mit {count} Tabs schließen?', 'dialog.dontAskAgain': 'Nicht mehr fragen',
  'save.complete': 'Webseite, komplett', 'save.single': 'Webseite, eine Datei (MHTML)', 'save.pdf': 'PDF-Dokument', 'save.failed': 'Speichern fehlgeschlagen',
  'task.total': 'Nimbus verwendet {mb} MB in {count} Prozessen.', 'task.hint': 'Tipp: Inaktive Tabs schlafen automatisch (Einstellungen › Tabs).', 'task.sleepAll': 'Hintergrund-Tabs schlafen legen',

  // permissions
  'perm.prompt': '{origin} möchte: {what}', 'perm.allow': 'Erlauben', 'perm.block': 'Blockieren', 'perm.ask': 'Fragen', 'perm.askDefault': 'Standard (fragen)',
  'perm.remember': 'Entscheidung für diese Website merken',
  'perm.notifications': 'Benachrichtigungen anzeigen', 'perm.geolocation': 'Deinen Standort verwenden', 'perm.media': 'Kamera und Mikrofon verwenden',
  'perm.media.video': 'Kamera verwenden', 'perm.media.audio': 'Mikrofon verwenden', 'perm.clipboard': 'Zwischenablage lesen', 'perm.midi': 'MIDI-Geräte verwenden',
  'perm.fullscreen': 'Vollbild', 'perm.pointerLock': 'Mauszeiger/Tastatur sperren', 'perm.openExternal': 'Externe Programme öffnen', 'perm.openExternalApp': '„{scheme}:“-Links mit einer App öffnen',
  'perm.idleDetection': 'Erkennen, wann du das Gerät nutzt', 'perm.windowManagement': 'Fenster auf allen Bildschirmen verwalten', 'perm.sensors': 'Bewegungssensoren',
  'perm.hid': 'HID-Geräte', 'perm.serial': 'Serielle Anschlüsse', 'perm.usb': 'USB-Geräte',
  'auth.title': 'Anmeldung erforderlich', 'auth.proxyTitle': 'Proxy-Anmeldung erforderlich', 'auth.text': '{host} verlangt Benutzername und Passwort',
  'auth.user': 'Benutzername', 'auth.password': 'Passwort', 'auth.signIn': 'Anmelden',
  'screen.title': '{origin} möchte deinen Bildschirm teilen', 'screen.share': 'Teilen', 'screen.entire': 'Ganzer Bildschirm ({name})', 'screen.audio': 'Systemton mitteilen',

  // bookmarks
  'bm.bar': 'Lesezeichenleiste', 'bm.other': 'Weitere Lesezeichen', 'bm.folder': 'Ordner', 'bm.empty': '(leer)', 'bm.openAll': 'Alle öffnen ({count})',
  'bm.edit': 'Lesezeichen bearbeiten', 'bm.editFolder': 'Ordner bearbeiten', 'bm.rename': 'Umbenennen …', 'bm.delete': 'Löschen', 'bm.addFolder': 'Neuer Ordner',
  'bm.newFolder': 'Neuer Ordner', 'bm.manage': 'Lesezeichen verwalten', 'bm.added': 'Lesezeichen hinzugefügt', 'bm.name': 'Name', 'bm.url': 'Adresse',
  'bm.folderLabel': 'Ordner', 'bm.folderName': 'Ordnername', 'bm.barEmpty': 'Ziehe Links hierher oder drücke Strg+D, um Lesezeichen anzulegen.',
  'bm.fileTypes': 'Lesezeichen (HTML, JSON)', 'bm.imported': 'Importiert am {date}', 'bm.manager': 'Lesezeichen', 'bm.search': 'Lesezeichen durchsuchen',
  'bm.addBookmark': 'Neues Lesezeichen', 'bm.emptyFolder': 'Dieser Ordner ist leer.', 'bm.items': '{count} Einträge',

  // downloads
  'dl.title': 'Downloads', 'dl.empty': 'Noch keine Downloads.', 'dl.showAll': 'Alle Downloads', 'dl.openFolder': 'Verwalten', 'dl.paused': 'pausiert',
  'dl.cancel': 'Abbrechen', 'dl.show': 'Im Ordner anzeigen', 'dl.retry': 'Erneut versuchen', 'dl.open': 'Öffnen', 'dl.pause': 'Pausieren', 'dl.resume': 'Fortsetzen',
  'dl.remove': 'Aus Liste entfernen', 'dl.clear': 'Liste leeren', 'dl.search': 'Downloads durchsuchen',
  'dl.state.completed': 'Fertig', 'dl.state.cancelled': 'Abgebrochen', 'dl.state.interrupted': 'Unterbrochen', 'dl.state.progressing': 'Läuft',

  // history
  'hist.title': 'Verlauf', 'hist.search': 'Verlauf durchsuchen', 'hist.clear': 'Verlauf löschen …', 'hist.clearConfirm': 'Verlauf für diesen Zeitraum wirklich löschen?',
  'hist.empty': 'Hier erscheinen besuchte Seiten.', 'hist.noResults': 'Keine Treffer.', 'hist.more': 'Mehr laden', 'hist.remove': 'Aus Verlauf entfernen',
  'hist.today': 'Heute', 'hist.yesterday': 'Gestern', 'hist.visits': 'Besuche',
  'range.hour': 'Letzte Stunde', 'range.day': 'Letzte 24 Stunden', 'range.week': 'Letzte 7 Tage', 'range.month': 'Letzte 4 Wochen', 'range.all': 'Gesamter Zeitraum',

  // new tab
  'nt.customize': 'Anpassen', 'nt.searchWith': 'Mit {engine} suchen oder Adresse eingeben', 'nt.addTile': 'Hinzufügen', 'nt.editTile': 'Kachel bearbeiten',
  'nt.tileName': 'Name', 'nt.tileUrl': 'Adresse', 'nt.remove': 'Entfernen', 'nt.greetNight': 'Gute Nacht', 'nt.greetMorning': 'Guten Morgen',
  'nt.greetDay': 'Mahlzeit', 'nt.greetAfternoon': 'Schönen Nachmittag', 'nt.greetEvening': 'Guten Abend',

  // errors
  'err.retry': 'Erneut versuchen', 'err.continueHttp': 'Unverschlüsselt fortfahren', 'err.advanced': 'Erweitert', 'err.code': 'Fehlercode',
  'err.certIssuer': 'Zertifikat ausgestellt von: {issuer}', 'err.proceed': 'Trotzdem zu {host} (unsicher)',
  'err.generic.title': 'Diese Seite kann nicht geladen werden', 'err.generic.text': 'Beim Laden von {host} ist ein Fehler aufgetreten.',
  'err.offline.title': 'Keine Internetverbindung', 'err.offline.text': 'Nimbus kann gerade keine Verbindung herstellen.', 'err.offline.tips': 'Prüfe Kabel, WLAN oder mobile Daten|Starte den Router neu|Prüfe VPN- oder Proxy-Einstellungen',
  'err.dns.title': 'Adresse nicht gefunden', 'err.dns.text': 'Der Server von {host} wurde nicht gefunden.', 'err.dns.tips': 'Prüfe die Schreibweise der Adresse|Versuche es mit einer Suche|Wechsle unter Einstellungen › Datenschutz den DNS-Modus',
  'err.cert.title': 'Verbindung ist nicht privat', 'err.cert.text': 'Das Sicherheitszertifikat von {host} ist ungültig. Jemand könnte versuchen, deine Daten abzufangen.',
  'err.unreachable.title': 'Website nicht erreichbar', 'err.unreachable.text': '{host} hat die Verbindung abgelehnt oder antwortet nicht.', 'err.unreachable.tips': 'Versuche es später erneut|Prüfe Firewall oder Proxy',
  'err.reset.title': 'Verbindung unterbrochen', 'err.reset.text': 'Die Verbindung zu {host} wurde zurückgesetzt.',
  'err.blocked.title': 'Seite blockiert', 'err.blocked.text': 'Der Zugriff auf {host} wurde blockiert, z. B. durch den Werbeblocker oder eine Erweiterung.', 'err.blocked.tips': 'Schalte den Schutz für diese Website über das Schild-Symbol aus',
  'err.crash.title': 'Diese Seite ist abgestürzt', 'err.crash.text': 'Beim Anzeigen der Seite ist ein Problem aufgetreten. Lade sie neu, um es nochmal zu versuchen.',
  'err.httpsOnly.title': 'Sichere Verbindung nicht verfügbar', 'err.httpsOnly.text': '{host} unterstützt kein HTTPS. Der Nur-HTTPS-Modus hat die unverschlüsselte Verbindung verhindert.',

  // extensions
  'ext.add': 'Hinzufügen', 'ext.confirmInstall': '„{name}“ hinzufügen?', 'ext.permissions': 'Die Erweiterung kann:', 'ext.remove': 'Entfernen',
  'ext.confirmRemove': 'Diese Erweiterung entfernen?', 'ext.lead': 'Nimbus unterstützt Chrome-Erweiterungen. Die meisten populären Erweiterungen (z. B. Passwortmanager, Dark Reader, uBlock Origin Lite) funktionieren; einige Chrome-APIs sind noch nicht verfügbar. In privaten Fenstern sind Erweiterungen deaktiviert.',
  'ext.install': 'Erweiterungen installieren', 'ext.fromStore': 'Chrome Web Store', 'ext.fromStoreHint': 'Öffne den Store und klicke dort auf „Hinzufügen“.', 'ext.openStore': 'Web Store öffnen',
  'ext.byId': 'Per ID oder Store-Link', 'ext.byIdHint': 'Die 32-stellige ID steht in der Adresse der Store-Seite.', 'ext.storePlaceholder': 'ID oder https://chromewebstore.google.com/…',
  'ext.crx': 'Aus Datei (.crx / .zip)', 'ext.crxHint': 'Installiert ein heruntergeladenes Erweiterungspaket.', 'ext.chooseFile': 'Datei wählen …',
  'ext.unpackedLoad': 'Entpackte Erweiterung laden', 'ext.unpackedHint': 'Für Entwickler: Ordner mit manifest.json.', 'ext.chooseFolder': 'Ordner wählen …',
  'ext.updates': 'Automatisch aktualisieren', 'ext.updateNow': 'Jetzt prüfen', 'ext.updated': 'Erweiterungen sind aktuell', 'ext.enable': 'Erweiterungen aktivieren',
  'ext.enableHint': 'Wenn deaktiviert, startet Nimbus ohne Erweiterungen.', 'ext.installedList': 'Installiert', 'ext.none': 'Noch keine Erweiterungen installiert.',
  'ext.disabledGlobally': 'Erweiterungen sind deaktiviert.', 'ext.options': 'Optionen', 'ext.unpacked': 'entpackt', 'ext.installed': 'Erweiterung installiert', 'ext.failed': 'Installation fehlgeschlagen: {error}',

  // import / export
  'io.exported': 'Exportiert', 'io.imported': 'Einstellungen importiert', 'io.invalid': 'Die Datei konnte nicht gelesen werden.', 'io.bmImported': '{count} Lesezeichen importiert',

  // settings: sections
  'set.title': 'Einstellungen', 'set.search': 'Einstellungen durchsuchen', 'set.restart': 'Neustart nötig',
  'sec.appearance': 'Aussehen', 'sec.appearance.lead': 'Farben, Schrift und Abstände der Oberfläche. Änderungen wirken sofort.',
  'sec.layout': 'Layout', 'sec.layout.lead': 'Wo Tabs, Knöpfe und Leisten sitzen.',
  'sec.newtab': 'Neuer Tab', 'sec.newtab.lead': 'Was du beim Öffnen eines neuen Tabs siehst.',
  'sec.search': 'Suche', 'sec.startup': 'Start', 'sec.tabs': 'Tabs', 'sec.privacy': 'Datenschutz & Sicherheit',
  'sec.privacy.lead': 'Nimbus blockiert Werbung, Tracker und Drittanbieter-Cookies standardmäßig.',
  'sec.downloads': 'Downloads', 'sec.shortcuts': 'Tastenkürzel', 'sec.shortcuts.lead': 'Jede Aktion lässt sich mit eigenen Tastenkombinationen belegen.',
  'sec.sites': 'Websites', 'sec.sites.lead': 'Zoom sowie eigene Styles und Skripte pro Website.',
  'sec.extensions': 'Erweiterungen', 'sec.system': 'System', 'sec.data': 'Daten & Sicherung', 'sec.data.lead': 'Übertrage deine Einrichtung zwischen Windows und Linux mit einer einzigen Datei.',
  'sec.about': 'Über Nimbus',

  // settings: appearance
  'set.mode': 'Farbschema', 'set.modeHint': 'Websites folgen dieser Einstellung, wenn sie ein dunkles Design anbieten.', 'set.preset': 'Theme',
  'set.accent': 'Akzentfarbe', 'set.accentHint': 'Für Fokus, Fortschritt und Hervorhebungen.', 'set.useThemeColour': 'Theme-Farbe',
  'set.font': 'Schrift der Oberfläche', 'set.fontCustomPlaceholder': 'Eigene Schrift', 'set.fontSize': 'Schriftgröße',
  'set.density': 'Dichte', 'set.densityHint': 'Höhe von Tabs und Leisten.', 'set.radius': 'Eckenradius', 'set.animations': 'Animationen',
  'set.animationsHint': 'Übergänge und Ladeanimationen.', 'set.forceDark': 'Dunkelmodus für alle Websites erzwingen', 'set.forceDarkHint': 'Färbt auch Seiten ohne dunkles Design um.',
  'set.customColours': 'Eigene Farben', 'set.customColoursHint': 'Überschreibt einzelne Farben des Themes für das aktuelle Farbschema.', 'set.resetColours': 'Farben zurücksetzen',
  'set.uiCss': 'Eigenes CSS für die Oberfläche', 'set.uiCssHint': 'Für Fortgeschrittene: verändert Tabs, Leisten und Menüs beliebig.',
  'preset.nimbus': 'Nimbus', 'preset.graphite': 'Graphit', 'preset.fjord': 'Fjord', 'preset.ember': 'Glut', 'preset.orchid': 'Orchidee', 'preset.contrast': 'Hoher Kontrast',
  'font.system': 'Systemschrift', 'font.humanist': 'Humanistisch', 'font.rounded': 'Abgerundet', 'font.serif': 'Serif', 'font.mono': 'Monospace', 'font.display': 'Bricolage', 'font.custom': 'Eigene …',
  'density.compact': 'Kompakt', 'density.comfortable': 'Normal', 'density.spacious': 'Großzügig',
  'colorKey.frame': 'Rahmen', 'colorKey.toolbar': 'Symbolleiste', 'colorKey.surface': 'Flächen', 'colorKey.text': 'Text', 'colorKey.muted': 'Sekundärtext', 'colorKey.border': 'Linien',

  // settings: layout
  'set.tabs': 'Tabs', 'set.tabPosition': 'Position der Tabs', 'set.tabPositionHint': 'Seitliche Tabs bieten bei vielen Tabs mehr Überblick.',
  'set.compact': 'Kompakter Modus', 'set.compactHint': 'Tabs und Adressleiste in einer Zeile (nur bei Tabs oben).', 'set.tabWidth': 'Tab-Breite',
  'set.tabClose': 'Schließen-Knopf', 'set.newTabPosition': 'Neue Tabs öffnen', 'set.verticalWidth': 'Breite der Seitenleiste',
  'set.toolbar': 'Symbolleiste', 'set.toolbarButtons': 'Knöpfe und Reihenfolge', 'set.toolbarButtonsHint': 'Alles vor der Adressleiste erscheint links, alles danach rechts.',
  'set.addButton': 'Knopf hinzufügen …', 'set.moveUp': 'Nach oben', 'set.moveDown': 'Nach unten', 'set.bookmarksBar': 'Lesezeichenleiste',
  'set.simplifyUrl': 'Vereinfachte Adressen', 'set.simplifyUrlHint': 'Blendet https:// und www. aus, solange die Adressleiste nicht fokussiert ist.',
  'set.statusUrl': 'Linkziel anzeigen', 'set.statusUrlHint': 'Zeigt unten links die Adresse eines Links unter dem Mauszeiger.',
  'set.window': 'Fenster', 'set.titlebar': 'Titelleiste', 'set.titlebarHint': 'Integriert spart Platz; System nutzt die Fensterleiste deines Desktops.',
  'pos.top': 'Oben', 'pos.left': 'Links', 'pos.right': 'Rechts', 'tabw.fixed': 'Fest', 'tabw.fit': 'Füllend', 'tabw.compact': 'Schmal',
  'tabclose.always': 'Immer', 'tabclose.hover': 'Beim Überfahren', 'tabclose.active': 'Nur aktiver Tab', 'tabclose.never': 'Nie',
  'ntpos.afterCurrent': 'Neben dem aktuellen Tab', 'ntpos.end': 'Am Ende', 'bmbar.always': 'Immer', 'bmbar.newtab': 'Nur im neuen Tab', 'bmbar.never': 'Nie',
  'titlebar.integrated': 'Integriert', 'titlebar.system': 'System',
  'tb.back': 'Zurück', 'tb.forward': 'Vorwärts', 'tb.reload': 'Neu laden', 'tb.home': 'Startseite', 'tb.address': 'Adressleiste', 'tb.shield': 'Schutz (Werbeblocker)',
  'tb.bookmark': 'Lesezeichen-Menü', 'tb.extensions': 'Erweiterungen', 'tb.downloads': 'Downloads', 'tb.split': 'Geteilte Ansicht', 'tb.history': 'Verlauf', 'tb.sidebar': 'Tab-Layout umschalten', 'tb.menu': 'Menü',

  // settings: new tab
  'set.background': 'Hintergrund', 'set.backgroundType': 'Art', 'set.backgroundHint': 'Himmel ändert sich mit der Tageszeit.', 'set.pickImage': 'Bild wählen …',
  'set.imageSet': 'Hintergrundbild gesetzt', 'set.dim': 'Abdunkeln', 'set.dimHint': 'Verbessert die Lesbarkeit auf hellen Bildern.',
  'set.ntContent': 'Inhalt', 'set.showClock': 'Uhr', 'set.clock24': '24-Stunden-Format', 'set.showSeconds': 'Sekunden', 'set.showDate': 'Datum',
  'set.showGreeting': 'Begrüßung', 'set.name': 'Dein Name', 'set.nameHint': 'Für die Begrüßung, bleibt lokal.', 'set.showSearch': 'Suchfeld',
  'set.showSpeedDial': 'Schnellwahl', 'set.speedDialHint': 'Ohne eigene Kacheln werden deine meistbesuchten Seiten gezeigt.', 'set.columns': 'Spalten',
  'set.speedDial': 'Kacheln', 'set.customNewTab': 'Eigene Seite statt neuem Tab', 'set.customNewTabHint': 'Leer lassen für die Nimbus-Seite.',
  'bg.sky': 'Himmel', 'bg.color': 'Farbe', 'bg.gradient': 'Verlauf', 'bg.image': 'Bild',

  // settings: search
  'set.defaultEngine': 'Suchmaschine', 'set.defaultEngineHint': 'Wird in der Adressleiste und im neuen Tab verwendet.', 'set.suggestions': 'Suchvorschläge',
  'set.suggestionsHint': 'Eingaben werden dafür an die Suchmaschine gesendet.', 'set.historySuggestions': 'Vorschläge aus dem Verlauf', 'set.bookmarkSuggestions': 'Vorschläge aus Lesezeichen',
  'set.engines': 'Suchmaschinen', 'set.enginesHint': '%s steht für den Suchbegriff. Mit einem Kürzel (z. B. „w Berlin“) suchst du direkt in einer bestimmten Suchmaschine.',
  'search.name': 'Name', 'search.urlHint': 'https://…?q=%s', 'search.keyword': 'Kürzel', 'search.add': 'Suchmaschine hinzufügen', 'search.restore': 'Standard wiederherstellen', 'search.newEngine': 'Neue Suche',

  // settings: startup + tabs
  'set.startupMode': 'Beim Start', 'set.homepage': 'Startseite', 'set.homepageHint': 'Für den Startseiten-Knopf.', 'set.startupUrls': 'Seiten beim Start',
  'set.startupUrlsHint': 'Eine Adresse pro Zeile (für „Bestimmte Seiten öffnen“).',
  'startup.restore': 'Letzte Sitzung wiederherstellen', 'startup.newtab': 'Neuen Tab öffnen', 'startup.home': 'Startseite öffnen', 'startup.urls': 'Bestimmte Seiten öffnen',
  'set.sleep': 'Inaktive Tabs schlafen legen', 'set.sleepHint': 'Spart Arbeitsspeicher; die Seite lädt beim Öffnen neu. Tabs, die Ton abspielen, bleiben wach.',
  'sleep.never': 'Nie', 'sleep.min': 'nach {n} Minuten', 'sleep.hour': 'nach {n} Std.',
  'set.switchToNew': 'Zu neuen Tabs wechseln', 'set.switchToNewHint': 'Bei Mittelklick oder Strg+Klick auf Links.', 'set.middleClose': 'Mittelklick schließt Tab',
  'set.dblNewTab': 'Doppelklick auf freie Fläche öffnet neuen Tab', 'set.scrollSwitch': 'Mit dem Mausrad Tabs wechseln', 'set.confirmClose': 'Vor dem Schließen mehrerer Tabs fragen',
  'set.closedLimit': 'Gemerkte geschlossene Tabs',

  // settings: privacy
  'set.protection': 'Schutz', 'set.adblock': 'Werbe- und Trackerblocker', 'set.adblockHint': 'Lädt Seiten schneller und schützt deine Privatsphäre.',
  'set.adblockLevel': 'Filterlisten', 'ab.ads': 'Nur Werbung', 'ab.adsTracking': 'Werbung und Tracker (empfohlen)', 'ab.full': 'Streng (inkl. Cookie-Banner, Störer)',
  'set.cosmetic': 'Leere Werbeflächen ausblenden', 'set.cosmeticHint': 'Entfernt Platzhalter blockierter Werbung.', 'set.filterStatus': 'Filterstatus',
  'ab.loading': 'Filterlisten werden geladen …', 'ab.ready': 'Stand {date} · {count} blockiert seit Start', 'ab.error': 'Fehler: {error}', 'ab.update': 'Aktualisieren',
  'set.customFilters': 'Eigene Filterregeln', 'set.customFiltersHint': 'Adblock-Plus-Syntax, eine Regel pro Zeile.',
  'set.exceptions': 'Ausnahmen', 'set.exceptionsHint': 'Auf diesen Websites ist der Schutz aus. Eingabe mit Enter bestätigen.', 'set.noExceptions': 'Keine Ausnahmen.',
  'set.thirdPartyCookies': 'Drittanbieter-Cookies', 'set.thirdPartyCookiesHint': 'Verhindert websiteübergreifendes Tracking. Selten nötig für eingebettete Logins.',
  'cookies.block': 'Blockieren', 'cookies.allow': 'Erlauben', 'set.dnt': '„Do Not Track“ senden', 'set.gpc': 'Global Privacy Control senden', 'set.gpcHint': 'Rechtlich anerkanntes Widerspruchssignal gegen Datenverkauf.',
  'set.security': 'Sicherheit', 'set.httpsOnly': 'Nur-HTTPS-Modus', 'set.httpsOnlyHint': 'Lädt Seiten nur verschlüsselt; bei Bedarf kannst du pro Seite unverschlüsselt fortfahren.',
  'set.httpsExceptions': 'HTTPS-Ausnahmen', 'set.doh': 'Sicheres DNS', 'set.dohHint': 'Verschlüsselt DNS-Anfragen (DNS über HTTPS).', 'set.dohServer': 'DNS-Anbieter',
  'doh.off': 'Aus', 'doh.automatic': 'Automatisch', 'doh.secure': 'Immer',
  'set.userAgent': 'User-Agent', 'set.userAgentHint': 'Nur ändern, wenn eine Website den Browser nicht erkennt.', 'ua.default': 'Standard (Chrome-kompatibel)', 'ua.custom': 'Eigener',
  'set.history': 'Verlauf & Daten', 'set.saveHistory': 'Verlauf speichern', 'set.clearOnExit': 'Beim Beenden löschen', 'set.clearOnExitHint': 'Ausgewählte Daten werden beim Schließen entfernt.',
  'set.clearNow': 'Browserdaten löschen', 'set.clearNowHint': 'Wähle Zeitraum und Datenarten.',
  'clear.history': 'Verlauf', 'clear.cookies': 'Cookies und Website-Daten', 'clear.cache': 'Zwischengespeicherte Dateien', 'clear.downloads': 'Download-Liste', 'clear.permissions': 'Website-Berechtigungen',
  'clear.button': 'Daten löschen', 'clear.done': 'Daten gelöscht',
  'set.permissionDefaults': 'Standard-Berechtigungen', 'set.sitePermissions': 'Gespeicherte Website-Berechtigungen', 'set.sitePermissionsHint': 'Entscheidungen, die du auf Websites getroffen hast.', 'set.noSitePerms': 'Noch keine gespeicherten Entscheidungen.',

  // settings: downloads
  'set.downloadDir': 'Speicherort', 'set.change': 'Ändern …', 'set.askWhere': 'Vor jedem Download fragen, wo gespeichert werden soll',
  'set.downloadPanel': 'Download-Knopf hervorheben', 'set.downloadPanelHint': 'Kurze Animation, wenn ein Download beginnt.',

  // settings: shortcuts
  'sc.hint': 'Klicke auf +, um eine Tastenkombination aufzunehmen. Rot markierte Kürzel sind doppelt belegt.', 'sc.resetAll': 'Alle zurücksetzen',
  'sc.add': 'Kürzel hinzufügen', 'sc.press': 'Tasten drücken …', 'sc.reset': 'Zurücksetzen', 'sc.conflict': 'Doppelt belegt',
  'cmd.newTab': 'Neuer Tab', 'cmd.newWindow': 'Neues Fenster', 'cmd.newPrivateWindow': 'Neues privates Fenster', 'cmd.closeTab': 'Tab schließen', 'cmd.closeWindow': 'Fenster schließen',
  'cmd.reopenClosedTab': 'Geschlossenen Tab wiederherstellen', 'cmd.nextTab': 'Nächster Tab', 'cmd.prevTab': 'Vorheriger Tab', 'cmd.selectTab1': 'Tab 1', 'cmd.selectTab2': 'Tab 2',
  'cmd.selectTab3': 'Tab 3', 'cmd.selectTab4': 'Tab 4', 'cmd.selectTab5': 'Tab 5', 'cmd.selectTab6': 'Tab 6', 'cmd.selectTab7': 'Tab 7', 'cmd.selectTab8': 'Tab 8',
  'cmd.selectLastTab': 'Letzter Tab', 'cmd.duplicateTab': 'Tab duplizieren', 'cmd.pinTab': 'Tab anheften/loslösen', 'cmd.muteTab': 'Tab stumm schalten',
  'cmd.focusAddress': 'Adressleiste fokussieren', 'cmd.reload': 'Neu laden', 'cmd.hardReload': 'Neu laden ohne Cache', 'cmd.back': 'Zurück', 'cmd.forward': 'Vorwärts', 'cmd.home': 'Startseite',
  'cmd.find': 'Auf Seite suchen', 'cmd.findNext': 'Nächster Treffer', 'cmd.findPrev': 'Vorheriger Treffer', 'cmd.zoomIn': 'Vergrößern', 'cmd.zoomOut': 'Verkleinern', 'cmd.zoomReset': 'Zoom zurücksetzen',
  'cmd.bookmarkPage': 'Lesezeichen setzen', 'cmd.toggleBookmarksBar': 'Lesezeichenleiste ein/aus', 'cmd.openBookmarks': 'Lesezeichen verwalten', 'cmd.openHistory': 'Verlauf',
  'cmd.openDownloads': 'Downloads', 'cmd.openSettings': 'Einstellungen', 'cmd.openExtensions': 'Erweiterungen', 'cmd.devtools': 'Entwicklerwerkzeuge', 'cmd.viewSource': 'Quelltext anzeigen',
  'cmd.fullscreen': 'Vollbild', 'cmd.focusMode': 'Fokus-Modus', 'cmd.print': 'Drucken', 'cmd.savePage': 'Seite speichern', 'cmd.toggleSplit': 'Geteilte Ansicht',
  'cmd.toggleTabLayout': 'Tabs oben/seitlich', 'cmd.quit': 'Nimbus beenden',

  // settings: sites
  'set.zoom': 'Zoom', 'set.defaultZoom': 'Standard-Zoom', 'set.siteZoom': 'Zoom pro Website', 'set.siteZoomHint': 'Wird automatisch gespeichert, wenn du auf einer Seite zoomst.', 'set.noZoom': 'Keine Einträge.',
  'set.userStyles': 'Eigene Styles (CSS)', 'set.userStylesHint': 'Gestalte beliebige Websites um. „Treffer“: Domains wie example.com, *.example.com oder Adressmuster mit *.',
  'set.userScripts': 'Eigene Skripte (JavaScript)', 'set.userScriptsHint': 'Führt eigenes JavaScript auf passenden Seiten aus. Nur Code verwenden, dem du vertraust.',
  'us.name': 'Name', 'us.match': 'Treffer (Domains/Muster)', 'us.enabled': 'Aktiv', 'us.addStyle': 'Style hinzufügen', 'us.addScript': 'Skript hinzufügen',
  'us.newStyle': 'Neuer Style', 'us.newScript': 'Neues Skript', 'us.runEnd': 'Nach dem Laden', 'us.runStart': 'Beim Seitenstart',

  // settings: system
  'set.language': 'Sprache', 'lang.auto': 'Systemsprache', 'set.defaultBrowser': 'Standardbrowser', 'set.defaultBrowserHint': 'Links aus anderen Programmen in Nimbus öffnen.',
  'set.makeDefault': 'Als Standard festlegen', 'sys.isDefault': 'Nimbus ist Standardbrowser.', 'sys.defaultSet': 'Erledigt – ggf. in den Systemeinstellungen bestätigen.', 'sys.defaultFailed': 'Konnte nicht gesetzt werden.',
  'set.hwAccel': 'Hardwarebeschleunigung', 'set.hwAccelHint': 'Bei Grafikfehlern oder Flackern ausschalten.', 'set.smoothScroll': 'Weiches Scrollen',
  'set.spellcheck': 'Rechtschreibprüfung', 'set.spellLangs': 'Sprachen der Rechtschreibprüfung', 'set.restartNow': 'Nimbus neu starten', 'set.restartButton': 'Neu starten',

  // settings: data
  'set.backup': 'Sicherung', 'set.exportSettings': 'Einstellungen exportieren', 'set.exportSettingsHint': 'Alle Einstellungen, Themes und Lesezeichen als JSON-Datei.',
  'set.importSettings': 'Einstellungen importieren', 'set.importSettingsHint': 'Ersetzt die aktuellen Einstellungen und Lesezeichen.', 'set.export': 'Exportieren …', 'set.import': 'Importieren …',
  'set.bookmarksIo': 'Lesezeichen', 'set.importBookmarks': 'Lesezeichen importieren', 'set.importBookmarksHint': 'HTML-Export aus Chrome, Firefox, Edge oder Safari – oder die Chrome-Datei „Bookmarks“.',
  'set.exportBookmarks': 'Lesezeichen exportieren', 'set.reset': 'Zurücksetzen', 'set.resetSection': 'Bereich zurücksetzen', 'set.resetAll': 'Alles zurücksetzen',
  'set.resetAllHint': 'Setzt alle Einstellungen zurück. Lesezeichen und Verlauf bleiben erhalten.', 'set.resetAllButton': 'Alle Einstellungen zurücksetzen', 'set.resetConfirm': 'Wirklich zurücksetzen?',
  'reset.appearance': 'Aussehen', 'reset.layout': 'Layout', 'reset.newTab': 'Neuer Tab', 'reset.search': 'Suche', 'reset.privacy': 'Datenschutz', 'reset.shortcuts': 'Tastenkürzel', 'reset.tabs': 'Tabs',

  // about
  'about.profile': 'Profilordner', 'about.profileHint': 'Hier liegen Einstellungen, Lesezeichen und Verlauf.', 'about.license': 'Lizenz',
  'about.licenseText': 'Freie Software unter der GNU General Public License v3.', 'about.source': 'Quellcode'
};

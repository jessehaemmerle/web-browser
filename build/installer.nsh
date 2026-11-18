; Registers Nimbus as a web browser so it appears in Windows "Default apps".
!macro customInstall
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus" "" "Nimbus"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\DefaultIcon" "" "$INSTDIR\Nimbus.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\shell\open\command" "" '"$INSTDIR\Nimbus.exe"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities" "ApplicationName" "Nimbus"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities" "ApplicationIcon" "$INSTDIR\Nimbus.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities" "ApplicationDescription" "Schneller, anpassbarer Webbrowser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\URLAssociations" "http" "NimbusURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\URLAssociations" "https" "NimbusURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\FileAssociations" ".html" "NimbusHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\FileAssociations" ".htm" "NimbusHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\FileAssociations" ".xhtml" "NimbusHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\FileAssociations" ".pdf" "NimbusHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\FileAssociations" ".svg" "NimbusHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Nimbus\Capabilities\StartMenu" "StartMenuInternet" "Nimbus"
  WriteRegStr HKCU "Software\RegisteredApplications" "Nimbus" "Software\Clients\StartMenuInternet\Nimbus\Capabilities"
  WriteRegStr HKCU "Software\Classes\NimbusURL" "" "Nimbus URL"
  WriteRegStr HKCU "Software\Classes\NimbusURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\NimbusURL\DefaultIcon" "" "$INSTDIR\Nimbus.exe,0"
  WriteRegStr HKCU "Software\Classes\NimbusURL\shell\open\command" "" '"$INSTDIR\Nimbus.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\NimbusHTML" "" "Nimbus HTML Document"
  WriteRegStr HKCU "Software\Classes\NimbusHTML\DefaultIcon" "" "$INSTDIR\Nimbus.exe,0"
  WriteRegStr HKCU "Software\Classes\NimbusHTML\shell\open\command" "" '"$INSTDIR\Nimbus.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Nimbus"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Nimbus"
  DeleteRegKey HKCU "Software\Classes\NimbusURL"
  DeleteRegKey HKCU "Software\Classes\NimbusHTML"
!macroend

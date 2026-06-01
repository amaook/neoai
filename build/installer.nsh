!macro customInstall
  CreateShortCut "$INSTDIR\卸载 neo.lnk" "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend

!macro customUnInstall
  Delete "$INSTDIR\卸载 neo.lnk"
!macroend

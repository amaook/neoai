!ifndef BUILD_UNINSTALLER
Var /GLOBAL neoInstalledVersion

!macro customInit
  StrCpy $neoInstalledVersion ""

  ${if} $hasPerUserInstallation == "1"
    ReadRegStr $neoInstalledVersion HKCU "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
  ${endif}

  ${if} $neoInstalledVersion == ""
  ${andIf} $hasPerMachineInstallation == "1"
    ReadRegStr $neoInstalledVersion HKLM "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
  ${endif}

  ${if} $neoInstalledVersion != ""
    ${if} $neoInstalledVersion == "${VERSION}"
      MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON1 "已检测到这台电脑已经安装 neo $neoInstalledVersion。$\r$\n$\r$\n继续安装会重新安装/修复当前版本，并保留聊天记录、设置和工作区文件。$\r$\n$\r$\n是否继续？" IDYES neo_continue_existing_install
      Abort
      neo_continue_existing_install:
    ${else}
      MessageBox MB_ICONINFORMATION|MB_OK "已检测到这台电脑安装了 neo $neoInstalledVersion。$\r$\n$\r$\n安装器会将 neo 更新到 ${VERSION}，并保留聊天记录、设置和工作区文件。"
    ${endif}
  ${endif}
!macroend

!macro customInstallMode
  ${if} $hasPerUserInstallation == "1"
  ${andIf} $hasPerMachineInstallation == "0"
    StrCpy $isForceCurrentInstall "1"
  ${elseIf} $hasPerUserInstallation == "0"
  ${andIf} $hasPerMachineInstallation == "1"
    StrCpy $isForceMachineInstall "1"
  ${endif}
!macroend
!endif

!macro customInstall
  CreateShortCut "$INSTDIR\卸载 neo.lnk" "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend

!macro customUnInstall
  Delete "$INSTDIR\卸载 neo.lnk"
!macroend

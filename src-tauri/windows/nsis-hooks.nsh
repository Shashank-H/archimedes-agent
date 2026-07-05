!include LogicLib.nsh
!include nsDialogs.nsh
${Using:StrFunc} UnStrLoc

!ifndef WM_SETTINGCHANGE
  !define WM_SETTINGCHANGE 0x001A
!endif

!ifndef HWND_BROADCAST
  !define HWND_BROADCAST 0xFFFF
!endif

Var AddCliToPathCheckbox
Var AddCliToPathState

Page custom ArchimedesCliOptionsPage ArchimedesCliOptionsLeave

Function ArchimedesCliOptionsPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Command-line access"
  Pop $0
  ${NSD_CreateCheckbox} 0 34u 100% 14u "Add the archimedes command to my user PATH"
  Pop $AddCliToPathCheckbox
  ${NSD_Check} $AddCliToPathCheckbox
  ${NSD_CreateLabel} 0 56u 100% 38u "This installs an archimedes.cmd launcher and updates your user PATH so you can run commands like: archimedes ."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function ArchimedesCliOptionsLeave
  ${NSD_GetState} $AddCliToPathCheckbox $AddCliToPathState
FunctionEnd

Function ArchimedesWriteCliShim
  FileOpen $0 "$INSTDIR\archimedes.cmd" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 '"%~dp0${MAINBINARYNAME}.exe" %*$\r$\n'
  FileClose $0
FunctionEnd

Function ArchimedesAddInstallDirToUserPath
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCpy $1 ";$0;"
  StrCpy $2 ";$INSTDIR;"
  ${StrLoc} $3 $1 $2 ">"
  ${If} $3 == ""
    ${If} $0 == ""
      WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR"
    ${Else}
      WriteRegExpandStr HKCU "Environment" "Path" "$0;$INSTDIR"
    ${EndIf}
    SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}
FunctionEnd

Function un.ArchimedesRemoveInstallDirFromUserPath
  ReadRegStr $0 HKCU "Environment" "Path"
  StrCpy $1 ""
  StrCpy $2 $0

  loop:
    ${If} $2 == ""
      Goto done
    ${EndIf}

    ${UnStrLoc} $4 $2 ";" ">"
    ${If} $4 == ""
      StrCpy $3 $2
      StrCpy $2 ""
    ${Else}
      StrCpy $3 $2 $4
      IntOp $5 $4 + 1
      StrCpy $2 $2 "" $5
    ${EndIf}

    ${If} $3 != ""
    ${AndIf} $3 != "$INSTDIR"
      ${If} $1 == ""
        StrCpy $1 $3
      ${Else}
        StrCpy $1 "$1;$3"
      ${EndIf}
    ${EndIf}
    Goto loop

  done:
    ${If} $1 != $0
      WriteRegExpandStr HKCU "Environment" "Path" "$1"
      SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
    ${EndIf}
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  Call ArchimedesWriteCliShim
  ${If} $AddCliToPathState == ${BST_CHECKED}
    Call ArchimedesAddInstallDirToUserPath
  ${EndIf}
  CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\New Archimedes Window.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "--new-window"
  !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\New Archimedes Window.lnk"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\OpenWithArchimedes" "" "Open with Archimedes"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\OpenWithArchimedes" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\OpenWithArchimedes\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\OpenWithArchimedes" "" "Open with Archimedes"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\OpenWithArchimedes" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\OpenWithArchimedes\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%V"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Folder\shell\OpenWithArchimedes" "" "Open with Archimedes"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Folder\shell\OpenWithArchimedes" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Folder\shell\OpenWithArchimedes\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Drive\shell\OpenWithArchimedes" "" "Open with Archimedes"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Drive\shell\OpenWithArchimedes" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Drive\shell\OpenWithArchimedes\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  !insertmacro UPDATEFILEASSOC
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Call un.ArchimedesRemoveInstallDirFromUserPath
  Delete "$INSTDIR\archimedes.cmd"
  Delete "$SMPROGRAMS\$AppStartMenuFolder\New Archimedes Window.lnk"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\OpenWithArchimedes"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\OpenWithArchimedes"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Folder\shell\OpenWithArchimedes"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Drive\shell\OpenWithArchimedes"
  !insertmacro UPDATEFILEASSOC
!macroend

#define MyAppName "Modify Video"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "Chemauto"
#define MyAppURL "https://github.com/Chemauto/Modify-Video"

[Setup]
AppId={{7E3F5A1C-2B8D-4E64-9C15-A0D83B7F21E4}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
PrivilegesRequired=lowest
OutputDir=..\installer
OutputBaseFilename=ModifyVideo-{#MyAppVersion}-setup
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\ModifyVideo.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; Flags: unchecked

[Files]
Source: "..\dist\ModifyVideo.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userstartmenu}\{#MyAppName}"; Filename: "{app}\ModifyVideo.exe"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\ModifyVideo.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\ModifyVideo.exe"; Description: "Launch Modify Video"; Flags: postinstall skipifsilent nowait

[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\uploads"

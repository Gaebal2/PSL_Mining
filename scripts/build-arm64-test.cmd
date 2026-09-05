@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "ANDROID_HOME=C:\Users\KPN\AppData\Local\Android\Sdk"
set "ANDROID_USER_HOME=C:\Users\KPN\.android"
set "GRADLE_USER_HOME=%PROJECT_ROOT%\.gradle-local"
set "NODE_ENV=production"

if not exist "%ANDROID_HOME%\platform-tools" (
  echo Android SDK not found at %ANDROID_HOME%
  exit /b 1
)

if not exist "%GRADLE_USER_HOME%\wrapper\dists\gradle-9.3.1-bin" (
  echo Gradle 9.3.1 project cache not found at %GRADLE_USER_HOME%
  exit /b 1
)

if not exist "%PROJECT_ROOT%\android\gradlew.bat" (
  echo Android native project not found. Running Expo prebuild once...
  pushd "%PROJECT_ROOT%"
  call npx.cmd expo prebuild --platform android --no-install
  set "PREBUILD_EXIT=%ERRORLEVEL%"
  popd
  if not "%PREBUILD_EXIT%"=="0" exit /b %PREBUILD_EXIT%
) else (
  echo Reusing existing Android native project and build caches.
)

pushd "%PROJECT_ROOT%\android"
call gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --build-cache --offline --no-daemon
set "BUILD_EXIT=%ERRORLEVEL%"
popd

if not "%BUILD_EXIT%"=="0" exit /b %BUILD_EXIT%

copy /Y "%PROJECT_ROOT%\android\app\build\outputs\apk\release\app-release.apk" "%PROJECT_ROOT%\PSL-Mining-arm64-test.apk" >nul

echo.
echo APK: %PROJECT_ROOT%\PSL-Mining-arm64-test.apk
exit /b 0

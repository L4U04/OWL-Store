// pkg_builder/main.cpp
#include <orbis/Sysmodule.h>
#include <orbis/WebBrowserDialog.h>
#include <orbis/UserService.h>
#include <unistd.h>

// Altere para a URL da sua Vercel ou IP do seu servidor na rede local
#define OWL_STORE_URL "http://192.168.1.100:3000"

int main() {
    // Carrega o módulo nativo de WebDialog do Orbis OS
    sceSysmoduleLoadModule(ORBIS_SYSMODULE_WEB_BROWSER_DIALOG);
    sceUserServiceInitialize(NULL);

    OrbisUserServiceUserId userId;
    sceUserServiceGetInitialUser(&userId);

    sceWebBrowserDialogInitialize();

    OrbisWebBrowserDialogParam param;
    sceWebBrowserDialogInitializeParam(&param);
    param.mode = ORBIS_WEB_BROWSER_DIALOG_MODE_DEFAULT;
    param.userId = userId;
    param.url = OWL_STORE_URL;

    // Abre a Owl Store em ecrã inteiro com suporte nativo ao DualShock 4
    sceWebBrowserDialogOpen(&param);

    while (sceWebBrowserDialogUpdateStatus() == ORBIS_COMMON_DIALOG_STATUS_RUNNING) {
        usleep(16666); // 60 FPS loop
    }

    sceWebBrowserDialogTerminate();
    return 0;
}
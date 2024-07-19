import {APP_INITIALIZER, ApplicationConfig} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {provideHttpClient} from "@angular/common/http";
import {provideAnimations} from "@angular/platform-browser/animations";
import {KeycloakService} from "keycloak-angular";

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), {
    provide: APP_INITIALIZER,
    useFactory: initializeKeycloak,
    multi: true,
    deps: [KeycloakService],
  }, KeycloakService, provideHttpClient(), provideAnimations()]
};

export function initializeKeycloak(keycloakService: KeycloakService) {
  return () => keycloakService.init({
    config: {
      url: 'http://192.168.169.128:8081',
      realm: 'moyens_levage',
      clientId: 'angular-web-client',
    },
    initOptions: {
      onLoad: 'login-required',
      checkLoginIframe: false
    },
    enableBearerInterceptor: true,
    bearerExcludedUrls: ['/assets', '/clients/public']
  });
}

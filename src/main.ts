// @ts-ignore
import { platformBrowserDynamic} from "@angular/platform-browser-dynamic";
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import Keycloak from "keycloak-js";
import {KeycloakInitService} from "./app/keycloak-init.service";


platformBrowserDynamic().bootstrapModule(AppComponent)
  .then(appRef =>  {
    const keycloakService = appRef.injector.get(KeycloakInitService);
    return keycloakService.init();
    })
  .catch((err: any) => console.error(err));

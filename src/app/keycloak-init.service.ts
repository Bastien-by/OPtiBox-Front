import { Injectable } from '@angular/core';
import { KeycloakService} from "keycloak-angular";
import { environment } from "../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class KeycloakInitService {
  private keycloak: any;
  constructor(private keycloakService: KeycloakService) {}

  init(){
    return this.keycloak.init({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId,
      },
      initOptions: {
        onLoad: 'login-required',
        checkLoginIframe: false
      }
    });
  }

}


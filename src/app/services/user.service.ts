import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {forkJoin} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private userArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshUsers();
  }

  updateUserInfo(userId: number, userInfo: string) {
    this.userArray = this.userArray.map(user => {
      if (user.id === userId) {
        user.info = userInfo;
      }
      return user;
    });

    // Apply the same refreshUsers logic for the user info
    this.refreshUsers();
  }

  refreshUsers(){
    this.httpClient.get('api/users').subscribe((users: any) => {
      this.userArray = users;

      const requests = this.userArray.map(user =>
        this.httpClient.get(`api/users/info/${user.id}`, { responseType: 'text' })
      );

      forkJoin(requests).subscribe(responses => {
        this.userArray = this.userArray.map((user, index) => {
          user.info = responses[index].split('|');

          user.info[0] = user.info[0].replace('deposit', 'Dépôt');
          user.info[0] = user.info[0].replace('withdraw', 'Retrait');
          user.info[0] = user.info[0].replace('check', 'Contrôle');

          return user;
        });
      });
    });
  }

  getAllUsers() {
    return this.userArray;
  }

  addUser(userSent: any) {

    let user = {
      username: userSent.username,
      password: userSent.password,
      token: userSent.token,
      role: userSent.role
    }

    this.httpClient.post('api/users', user).subscribe(() => {
      this.refreshUsers();
    });
  }

  updateUser(userSent: any){
    let user = {
      id: userSent.id,
      username: userSent.username,
      password: userSent.password,
      token: userSent.token,
      role: userSent.role,
    };
    this.httpClient.post('api/users', user).subscribe((userReceived: any) => {
      this.userArray = this.userArray.map(p => {
        if(p.id === userReceived.id){
          return userReceived;
        }
        return p;
      });

      this.updateUserInfo(userReceived.id, userReceived.info);
    });

  }

  removeUser(id: number){
    this.userArray = this.userArray.filter(user => user.id !== id);
    this.httpClient.delete('api/users/' + id).subscribe(() => {
      this.refreshUsers();
    });

  }
}
